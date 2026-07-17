import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, DollarSign, BarChart3, Loader2 } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import { useProyectos } from "@/hooks/useProyectos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { VALOR_UF } from "@/data/mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatUF(value: number) {
  return `${value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} UF`;
}

export default function Finanzas() {
  const { data: proyectos, isLoading: loadingP } = useProyectos();
  const { data: empresas, isLoading: loadingE } = useEmpresas();

  const stats = useMemo(() => {
    if (!proyectos || !empresas) return null;

    // Aggregate cotizaciones from proyecto_empresas
    let cotizacionAdjudicadaUF = 0;
    let cotizacionPotencialUF = 0;
    let countAdj = 0;
    let countPot = 0;

    // Count unique project names
    const adjNames = new Set<string>();
    const potNames = new Set<string>();

    proyectos.forEach((p) => {
      if (p.estado_amc === "Descartado") return;
      p.proyecto_empresas?.forEach((pe) => {
        const monto = pe.monto_cotizacion || 0;
        if (pe.adjudicado) {
          cotizacionAdjudicadaUF += monto;
          countAdj++;
          adjNames.add(p.nombre);
        } else {
          cotizacionPotencialUF += monto;
          countPot++;
          potNames.add(p.nombre);
        }
      });
    });

    // Fees mensuales from active empresas (latest condicion).
    // fee_fijo_mensual is stored in CLP (see MontoInput), but this whole page
    // reports and charts in UF, so convert before aggregating — otherwise the
    // KPI and the chart bar mix CLP magnitudes into a UF axis.
    const activeEmpresas = empresas.filter((e) => e.estado === "Activa");
    const feesTotal = activeEmpresas.reduce((sum, e) => {
      const cc = e.condiciones_comerciales?.[e.condiciones_comerciales.length - 1];
      return sum + (cc?.fee_fijo_mensual || 0) / VALOR_UF;
    }, 0);

    // Chart data per empresa
    const empresaData = activeEmpresas.map((e) => {
      const cc = e.condiciones_comerciales?.[e.condiciones_comerciales.length - 1];
      const esquema = cc?.esquema_comision || 0;

      const vinculados = proyectos.filter((p) =>
        p.proyecto_empresas?.some((pe) => pe.empresa_id === e.id)
      );

      let efectiva = 0;
      let potencial = 0;
      vinculados.forEach((p) => {
        if (p.estado_amc === "Descartado") return;
        p.proyecto_empresas?.forEach((pe) => {
          if (pe.empresa_id !== e.id) return;
          const comision = (pe.monto_cotizacion || 0) * (esquema / 100);
          if (pe.adjudicado) efectiva += comision;
          else potencial += comision;
        });
      });

      return {
        nombre: e.nombre.split(" ").slice(0, 2).join(" "),
        fee: (cc?.fee_fijo_mensual || 0) / VALOR_UF, // CLP → UF (chart axis is UF)
        efectiva,
        potencial,
      };
    });

    // Detail rows (one per proyecto_empresa link, excluding Descartado)
    const detailRows = proyectos
      .filter((p) => p.estado_amc !== "Descartado")
      .flatMap((p) =>
        (p.proyecto_empresas || []).map((pe) => {
          const emp = empresas.find((e) => e.id === pe.empresa_id);
          const cc = emp?.condiciones_comerciales?.[emp.condiciones_comerciales.length - 1];
          const esquema = cc?.esquema_comision || 0;
          return {
            id: pe.id,
            proyecto: p.nombre,
            empresa: emp?.nombre || "—",
            adjudicado: pe.adjudicado,
            montoUF: pe.monto_cotizacion || 0,
            comisionUF: (pe.monto_cotizacion || 0) * (esquema / 100),
          };
        })
      );

    return {
      cotizacionAdjudicadaUF,
      cotizacionPotencialUF,
      countAdj: adjNames.size,
      countPot: potNames.size,
      feesTotal,
      activeCount: activeEmpresas.length,
      empresaData,
      detailRows,
    };
  }, [proyectos, empresas]);

  if (loadingP || loadingE) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Finanzas</h1>
        <p className="text-muted-foreground mt-1">Análisis financiero — Cotizaciones efectivas vs. potenciales (UF)</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Cotización Adjudicada"
          value={formatUF(stats.cotizacionAdjudicadaUF)}
          subtitle={`${stats.countAdj} proyectos adjudicados`}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          title="Cotización Potencial"
          value={formatUF(stats.cotizacionPotencialUF)}
          subtitle={`${stats.countPot} proyectos pendientes`}
          icon={BarChart3}
          variant="info"
          delay={0.05}
        />
        <KpiCard
          title="Fees Mensuales"
          value={formatUF(stats.feesTotal)}
          subtitle={`${stats.activeCount} empresas activas`}
          icon={DollarSign}
          variant="warning"
          delay={0.1}
        />
      </div>

      {/* Chart */}
      {stats.empresaData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-6">Comisiones por Empresa (UF)</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, stats.empresaData.length * 60)}>
            <BarChart data={stats.empresaData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${v.toFixed(0)} UF`} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={140} />
              <Tooltip formatter={(value: number) => formatUF(value)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
              <Legend />
              <Bar dataKey="efectiva" name="Comisiones Efectivas" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
              <Bar dataKey="potencial" name="Comisiones Potenciales" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} opacity={0.6} />
              <Bar dataKey="fee" name="Fee Mensual" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Detail table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        <div className="p-6 pb-3">
          <h3 className="text-sm font-semibold text-card-foreground">Detalle por Cotización</h3>
          <p className="text-xs text-muted-foreground mt-1">Cotizaciones y comisiones estimadas por empresa vinculada</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cotización (UF)</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comisión Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.detailRows.map((row) => (
                <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-card-foreground">{row.proyecto}</td>
                  <td className="px-5 py-3 text-muted-foreground">{row.empresa}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      row.adjudicado
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-info/10 text-info border-info/20"
                    }`}>
                      {row.adjudicado ? "Efectiva" : "Potencial"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    {formatUF(row.montoUF)}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-card-foreground">
                    {formatUF(row.comisionUF)}
                  </td>
                </tr>
              ))}
              {stats.detailRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No hay cotizaciones registradas
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr className="bg-success/5">
                <td className="px-5 py-3 font-semibold text-card-foreground" colSpan={4}>
                  Total Cotización Adjudicada
                </td>
                <td className="px-5 py-3 text-right font-bold text-success">
                  {formatUF(stats.cotizacionAdjudicadaUF)}
                </td>
              </tr>
              <tr className="bg-info/5">
                <td className="px-5 py-3 font-semibold text-card-foreground" colSpan={4}>
                  Total Cotización Potencial
                </td>
                <td className="px-5 py-3 text-right font-bold text-info">
                  {formatUF(stats.cotizacionPotencialUF)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
