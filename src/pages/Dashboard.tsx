import { useMemo } from "react";
import { Building2, FolderKanban, TrendingUp, DollarSign, Bell, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import KpiCard from "@/components/dashboard/KpiCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { formatCLP, formatUF, VALOR_UF } from "@/data/mock-data";
import { useProyectos, ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useAlertas } from "@/hooks/useAlertas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { isBefore, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { data: proyectos, isLoading: loadingP } = useProyectos();
  const { data: empresas, isLoading: loadingE } = useEmpresas();
  const { data: alertas, isLoading: loadingA } = useAlertas();

  const { data: condiciones } = useQuery({
    queryKey: ["condiciones_comerciales_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("condiciones_comerciales")
        .select("*")
        .order("fecha_vigencia", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const today = startOfDay(new Date());

  // --- Computed stats ---
  const stats = useMemo(() => {
    if (!proyectos || !empresas) return null;

    const empresasActivas = empresas.filter(e => e.estado === "Activa").length;

    // Deduplicate projects by name for project count
    const uniqueProjects = new Map<string, ProyectoWithEmpresas[]>();
    proyectos.forEach(p => {
      const key = p.nombre.trim().toLowerCase();
      if (!uniqueProjects.has(key)) uniqueProjects.set(key, []);
      uniqueProjects.get(key)!.push(p);
    });
    const totalProyectos = uniqueProjects.size;

    // Adjudicado: a project group is adjudicado if any row has adjudicado=true
    let adjudicadosCount = 0;
    let noAdjudicadosCount = 0;
    uniqueProjects.forEach(group => {
      if (group.some(p => p.adjudicado)) adjudicadosCount++;
      else noAdjudicadosCount++;
    });

    // Financial: sum monto_cotizacion from proyecto_empresas (in UF)
    let cotizacionAdjudicadaUF = 0;
    let cotizacionPotencialUF = 0;
    proyectos.forEach(p => {
      (p.proyecto_empresas || []).forEach(pe => {
        const monto = pe.monto_cotizacion || 0;
        if (pe.adjudicado) cotizacionAdjudicadaUF += monto;
        else cotizacionPotencialUF += monto;
      });
    });

    // Fees from condiciones_comerciales (latest per empresa)
    const latestCondByEmpresa = new Map<string, typeof condiciones extends (infer T)[] | undefined ? T : never>();
    condiciones?.forEach(c => {
      const existing = latestCondByEmpresa.get(c.empresa_id);
      if (!existing || c.fecha_vigencia > existing.fecha_vigencia) {
        latestCondByEmpresa.set(c.empresa_id, c);
      }
    });

    let totalFeesMensuales = 0;
    const feesPerEmpresa: { nombre: string; fee: number; comision: number }[] = [];
    empresas.filter(e => e.estado === "Activa").forEach(emp => {
      const cond = latestCondByEmpresa.get(emp.id);
      if (cond) {
        totalFeesMensuales += Number(cond.fee_fijo_mensual) || 0;
        feesPerEmpresa.push({
          nombre: emp.nombre,
          fee: Number(cond.fee_fijo_mensual) || 0,
          comision: Number(cond.esquema_comision) || 0,
        });
      }
    });

    // Estado AMC distribution (count unique project groups)
    const estadoAmcCounts = new Map<string, number>();
    uniqueProjects.forEach(group => {
      const estado = group[0].estado_amc || "Sin estado";
      estadoAmcCounts.set(estado, (estadoAmcCounts.get(estado) || 0) + 1);
    });

    // Estado Obra distribution
    const estadoObraCounts = new Map<string, number>();
    uniqueProjects.forEach(group => {
      const estado = group[0].estado_obra || "Sin Información";
      estadoObraCounts.set(estado, (estadoObraCounts.get(estado) || 0) + 1);
    });

    // Alertas stats
    const alertasActivas = alertas?.filter(a => !a.completada) || [];
    const alertasVencidas = alertasActivas.filter(a => isBefore(parseLocalDate(a.fecha_seguimiento), today));

    return {
      empresasActivas,
      empresasTotal: empresas.length,
      totalProyectos,
      adjudicadosCount,
      noAdjudicadosCount,
      cotizacionAdjudicadaUF,
      cotizacionPotencialUF,
      totalFeesMensuales,
      feesPerEmpresa,
      estadoAmcCounts,
      estadoObraCounts,
      alertasActivas: alertasActivas.length,
      alertasVencidas: alertasVencidas.length,
      recentProjects: proyectos.slice(-10).reverse(),
    };
  }, [proyectos, empresas, condiciones, alertas, today]);

  const PIE_COLORS = [
    "hsl(152, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(220, 10%, 50%)",
    "hsl(0, 72%, 51%)", "hsl(210, 80%, 55%)", "hsl(280, 60%, 55%)",
    "hsl(170, 50%, 45%)", "hsl(330, 60%, 50%)",
  ];

  if (loadingP || loadingE || loadingA || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pieDataAmc = Array.from(stats.estadoAmcCounts.entries()).map(([name, value]) => ({ name, value }));
  const pieDataObra = Array.from(stats.estadoObraCounts.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen de gestión comercial AMC</p>
      </motion.div>

      {/* KPIs Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Empresas Activas"
          value={String(stats.empresasActivas)}
          subtitle={`${stats.empresasTotal} total`}
          icon={Building2}
          variant="default"
          delay={0}
        />
        <KpiCard
          title="Proyectos"
          value={String(stats.totalProyectos)}
          subtitle={`${stats.adjudicadosCount} adjudicados`}
          icon={FolderKanban}
          variant="info"
          delay={0.05}
        />
        <KpiCard
          title="Cotización Adjudicada"
          value={formatUF(stats.cotizacionAdjudicadaUF)}
          subtitle={`≈ ${formatCLP(stats.cotizacionAdjudicadaUF * VALOR_UF)}`}
          icon={TrendingUp}
          variant="success"
          delay={0.1}
        />
        <KpiCard
          title="Cotización Potencial"
          value={formatUF(stats.cotizacionPotencialUF)}
          subtitle={`≈ ${formatCLP(stats.cotizacionPotencialUF * VALOR_UF)}`}
          icon={DollarSign}
          variant="warning"
          delay={0.15}
        />
      </div>

      {/* KPIs Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Fees Mensuales"
          value={formatCLP(stats.totalFeesMensuales)}
          subtitle={`${stats.feesPerEmpresa.length} empresas con fee`}
          icon={DollarSign}
          variant="default"
          delay={0.2}
        />
        <KpiCard
          title="Alertas Activas"
          value={String(stats.alertasActivas)}
          subtitle={stats.alertasVencidas > 0 ? `${stats.alertasVencidas} vencidas` : "Ninguna vencida"}
          icon={Bell}
          variant={stats.alertasVencidas > 0 ? "warning" : "info"}
          delay={0.25}
        />
        <KpiCard
          title="Proy. No Adjudicados"
          value={String(stats.noAdjudicadosCount)}
          subtitle="En seguimiento"
          icon={FolderKanban}
          variant="info"
          delay={0.3}
        />
        <KpiCard
          title="Alertas Vencidas"
          value={String(stats.alertasVencidas)}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          variant={stats.alertasVencidas > 0 ? "warning" : "success"}
          delay={0.35}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart - Estado AMC */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">
            Proyectos por Estado AMC
          </h3>
          {pieDataAmc.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieDataAmc} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieDataAmc.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieDataAmc.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium text-card-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
          )}
        </motion.div>

        {/* Pie chart - Estado Obra */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">
            Proyectos por Estado de Obra
          </h3>
          {pieDataObra.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieDataObra} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieDataObra.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[(i + 3) % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieDataObra.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[(i + 3) % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium text-card-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
          )}
        </motion.div>
      </div>

      {/* Fees summary */}
      {stats.feesPerEmpresa.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">
            Fees Mensuales por Empresa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.feesPerEmpresa.map((emp) => (
              <div key={emp.nombre} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{emp.nombre}</p>
                  <p className="text-xs text-muted-foreground">Comisión: {emp.comision}%</p>
                </div>
                <p className="text-sm font-semibold text-card-foreground">{formatCLP(emp.fee)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Fees Mensuales</span>
            <span className="text-lg font-bold text-card-foreground">{formatCLP(stats.totalFeesMensuales)}</span>
          </div>
        </motion.div>
      )}

      {/* Recent projects */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        <div className="p-6 pb-3">
          <h3 className="text-sm font-semibold text-card-foreground">Proyectos Recientes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">N°</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comuna</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado AMC</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado Obra</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Cotización UF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.recentProjects.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin proyectos</td></tr>
              ) : (
                stats.recentProjects.map((p) => {
                  const totalUF = (p.proyecto_empresas || []).reduce((s, pe) => s + (pe.monto_cotizacion || 0), 0);
                  return (
                    <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-3 text-muted-foreground">{p.numero}</td>
                      <td className="px-6 py-3 font-medium text-card-foreground">{p.nombre}</td>
                      <td className="px-6 py-3 text-muted-foreground">{p.comuna}</td>
                      <td className="px-6 py-3"><StatusBadge status={p.estado_amc} /></td>
                      <td className="px-6 py-3 text-muted-foreground text-xs">{p.estado_obra || "—"}</td>
                      <td className="px-6 py-3 text-right font-medium text-card-foreground">
                        {totalUF > 0 ? formatUF(totalUF) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
