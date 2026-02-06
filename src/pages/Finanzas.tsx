import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import KpiCard from "@/components/dashboard/KpiCard";
import { mockEmpresas, mockProyectos, formatCLP } from "@/data/mock-data";
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

const adjudicados = mockProyectos.filter((p) => p.adjudicado);
const noAdjudicados = mockProyectos.filter((p) => !p.adjudicado);

const gananciasEfectivas = adjudicados.reduce((sum, p) => sum + (p.montoEstimado || 0) * 0.035, 0);
const gananciasPotenciales = noAdjudicados.reduce((sum, p) => sum + (p.montoEstimado || 0) * 0.035, 0);
const feesTotal = mockEmpresas
  .filter((e) => e.estado === "Activa")
  .reduce((sum, e) => {
    const cc = e.condicionesComerciales[e.condicionesComerciales.length - 1];
    return sum + (cc?.feeFijoMensual || 0);
  }, 0);

const empresaData = mockEmpresas
  .filter((e) => e.estado === "Activa")
  .map((e) => {
    const cc = e.condicionesComerciales[e.condicionesComerciales.length - 1];
    const proyectosVinculados = mockProyectos.filter((p) => p.empresasVinculadas.includes(e.id));
    const comisionesEfectivas = proyectosVinculados
      .filter((p) => p.adjudicado)
      .reduce((sum, p) => sum + (p.montoEstimado || 0) * (cc.esquemaComision / 100), 0);
    const comisionesPotenciales = proyectosVinculados
      .filter((p) => !p.adjudicado)
      .reduce((sum, p) => sum + (p.montoEstimado || 0) * (cc.esquemaComision / 100), 0);

    return {
      nombre: e.nombre.split(" ").slice(0, 2).join(" "),
      fee: cc.feeFijoMensual,
      efectiva: comisionesEfectivas,
      potencial: comisionesPotenciales,
    };
  });

export default function Finanzas() {
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Finanzas</h1>
        <p className="text-muted-foreground mt-1">Análisis financiero — Ganancias efectivas vs. potenciales</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Ganancias Efectivas"
          value={formatCLP(gananciasEfectivas)}
          subtitle={`${adjudicados.length} proyectos adjudicados`}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          title="Ganancias Potenciales"
          value={formatCLP(gananciasPotenciales)}
          subtitle={`${noAdjudicados.length} proyectos pendientes`}
          icon={BarChart3}
          variant="info"
          delay={0.05}
        />
        <KpiCard
          title="Fees Mensuales"
          value={formatCLP(feesTotal)}
          subtitle={`${mockEmpresas.filter((e) => e.estado === "Activa").length} empresas activas`}
          icon={DollarSign}
          variant="warning"
          delay={0.1}
        />
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card rounded-xl border border-border p-6 shadow-sm"
      >
        <h3 className="text-sm font-semibold text-card-foreground mb-6">Ingresos por Empresa</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={empresaData} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 50%)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <YAxis type="category" dataKey="nombre" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" width={140} />
            <Tooltip formatter={(value: number) => formatCLP(value)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 16%, 90%)", fontSize: "12px" }} />
            <Legend />
            <Bar dataKey="efectiva" name="Comisiones Efectivas" fill="hsl(152, 60%, 42%)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="potencial" name="Comisiones Potenciales" fill="hsl(210, 80%, 55%)" radius={[0, 4, 4, 0]} opacity={0.6} />
            <Bar dataKey="fee" name="Fee Mensual" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Detail table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        <div className="p-6 pb-3">
          <h3 className="text-sm font-semibold text-card-foreground">Detalle por Proyecto</h3>
          <p className="text-xs text-muted-foreground mt-1">Clasificación de ganancias por tipo</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comisión Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockProyectos
                .filter((p) => p.estadoAMC !== "Descartado")
                .map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 font-medium text-card-foreground">{p.nombre}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        p.adjudicado
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-info/10 text-info border-info/20"
                      }`}>
                        {p.adjudicado ? "Efectiva" : "Potencial"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {p.montoEstimado ? formatCLP(p.montoEstimado) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-card-foreground">
                      {p.montoEstimado ? formatCLP(p.montoEstimado * 0.035) : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="border-t-2 border-border">
              <tr className="bg-success/5">
                <td className="px-5 py-3 font-semibold text-card-foreground" colSpan={3}>
                  Total Ganancias Efectivas
                </td>
                <td className="px-5 py-3 text-right font-bold text-success">
                  {formatCLP(gananciasEfectivas)}
                </td>
              </tr>
              <tr className="bg-info/5">
                <td className="px-5 py-3 font-semibold text-card-foreground" colSpan={3}>
                  Total Ganancias Potenciales
                </td>
                <td className="px-5 py-3 text-right font-bold text-info">
                  {formatCLP(gananciasPotenciales)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
