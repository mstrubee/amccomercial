import { Building2, FolderKanban, TrendingUp, DollarSign } from "lucide-react";
import { motion } from "framer-motion";
import KpiCard from "@/components/dashboard/KpiCard";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { mockEmpresas, mockProyectos, formatCLP } from "@/data/mock-data";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const empresasActivas = mockEmpresas.filter((e) => e.estado === "Activa").length;
const totalProyectos = mockProyectos.length;
const adjudicados = mockProyectos.filter((p) => p.adjudicado);
const noAdjudicados = mockProyectos.filter((p) => !p.adjudicado);

const gananciasPotenciales = noAdjudicados.reduce((sum, p) => sum + (p.montoEstimado || 0) * 0.035, 0);
const gananciasEfectivas = adjudicados.reduce((sum, p) => sum + (p.montoEstimado || 0) * 0.035, 0);
const feesTotal = mockEmpresas
  .filter((e) => e.estado === "Activa")
  .reduce((sum, e) => {
    const cc = e.condicionesComerciales[e.condicionesComerciales.length - 1];
    return sum + (cc?.feeFijoMensual || 0);
  }, 0);

const barData = [
  { mes: "Sep", potencial: 1200000, efectiva: 800000 },
  { mes: "Oct", potencial: 1500000, efectiva: 950000 },
  { mes: "Nov", potencial: 1800000, efectiva: 1100000 },
  { mes: "Dic", potencial: 1400000, efectiva: 1300000 },
  { mes: "Ene", potencial: 2100000, efectiva: 1500000 },
  { mes: "Feb", potencial: 1900000, efectiva: 1700000 },
];

const pieData = [
  { name: "Vigente", value: mockProyectos.filter((p) => p.estadoAMC === "Vigente").length },
  { name: "Todo Ofrecido", value: mockProyectos.filter((p) => p.estadoAMC === "Todo Ofrecido").length },
  { name: "Sin Respuesta", value: mockProyectos.filter((p) => p.estadoAMC === "Sin Respuesta").length },
  { name: "Descartado", value: mockProyectos.filter((p) => p.estadoAMC === "Descartado").length },
];

const PIE_COLORS = [
  "hsl(152, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(220, 10%, 50%)",
  "hsl(0, 72%, 51%)",
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Resumen de gestión comercial AMC</p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Empresas Activas"
          value={String(empresasActivas)}
          subtitle={`${mockEmpresas.length} total`}
          icon={Building2}
          variant="default"
          delay={0}
        />
        <KpiCard
          title="Proyectos"
          value={String(totalProyectos)}
          subtitle={`${adjudicados.length} adjudicados`}
          icon={FolderKanban}
          variant="info"
          delay={0.05}
        />
        <KpiCard
          title="Ganancias Efectivas"
          value={formatCLP(gananciasEfectivas)}
          subtitle="Proyectos adjudicados"
          icon={TrendingUp}
          variant="success"
          delay={0.1}
        />
        <KpiCard
          title="Ganancias Potenciales"
          value={formatCLP(gananciasPotenciales)}
          subtitle="Proyectos no adjudicados"
          icon={DollarSign}
          variant="warning"
          delay={0.15}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">
            Ganancias Mensuales
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 50%)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 50%)" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                formatter={(value: number) => formatCLP(value)}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(220, 16%, 90%)",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="efectiva" name="Efectiva" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="potencial" name="Potencial" fill="hsl(210, 80%, 55%)" radius={[4, 4, 0, 0]} opacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-card-foreground mb-4">
            Estados AMC
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-medium text-card-foreground">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Fees summary */}
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
          {mockEmpresas.filter(e => e.estado === "Activa").map((empresa) => {
            const cc = empresa.condicionesComerciales[empresa.condicionesComerciales.length - 1];
            return (
              <div key={empresa.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{empresa.nombre}</p>
                  <p className="text-xs text-muted-foreground">Comisión: {cc.esquemaComision}%</p>
                </div>
                <p className="text-sm font-semibold text-card-foreground">{formatCLP(cc.feeFijoMensual)}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total Fees Mensuales</span>
          <span className="text-lg font-bold text-card-foreground">{formatCLP(feesTotal)}</span>
        </div>
      </motion.div>

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
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Adjudicado</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockProyectos.slice(0, 5).map((p) => (
                <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-6 py-3 text-muted-foreground">{p.numero}</td>
                  <td className="px-6 py-3 font-medium text-card-foreground">{p.nombre}</td>
                  <td className="px-6 py-3 text-muted-foreground">{p.comuna}</td>
                  <td className="px-6 py-3"><StatusBadge status={p.estadoAMC} /></td>
                  <td className="px-6 py-3">
                    <span className={p.adjudicado ? "text-success font-medium" : "text-muted-foreground"}>
                      {p.adjudicado ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-card-foreground">
                    {p.montoEstimado ? formatCLP(p.montoEstimado) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
