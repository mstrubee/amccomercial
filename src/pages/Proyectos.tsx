import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, ChevronDown, MapPin, Building2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { mockProyectos, mockEmpresas, formatCLP } from "@/data/mock-data";
import { Proyecto } from "@/types/amc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Proyectos() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("Todos");
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null);

  const estados = ["Todos", "Vigente", "Todo Ofrecido", "Sin Respuesta", "Descartado"];

  const filtered = mockProyectos.filter((p) => {
    const matchSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.comuna.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === "Todos" || p.estadoAMC === filterEstado;
    return matchSearch && matchEstado;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Proyectos</h1>
        <p className="text-muted-foreground mt-1">Base de datos de proyectos</p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o comuna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {estados.map((estado) => (
            <button
              key={estado}
              onClick={() => setFilterEstado(estado)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterEstado === estado
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-secondary"
              }`}
            >
              {estado}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">N°</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comuna</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado Obra</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado AMC</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Adjudicado</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresas</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto Est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedProyecto(p)}
                  className="hover:bg-secondary/20 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 text-muted-foreground">{p.numero}</td>
                  <td className="px-5 py-3 font-medium text-card-foreground">{p.nombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.comuna}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.estadoObra}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.estadoAMC} /></td>
                  <td className="px-5 py-3">
                    <span className={p.adjudicado ? "text-success font-medium" : "text-muted-foreground"}>
                      {p.adjudicado ? "Sí" : "No"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {p.empresasVinculadas.map((eId) => {
                        const emp = mockEmpresas.find((e) => e.id === eId);
                        return emp ? (
                          <span key={eId} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                            {emp.nombre.split(" ")[0]}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-card-foreground">
                    {p.montoEstimado ? formatCLP(p.montoEstimado) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">No se encontraron proyectos</div>
        )}
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedProyecto} onOpenChange={() => setSelectedProyecto(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedProyecto && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedProyecto.nombre}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex gap-3 flex-wrap">
                  <StatusBadge status={selectedProyecto.estadoAMC} />
                  <StatusBadge status={selectedProyecto.adjudicado ? "Activa" : "Inactiva"} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Dirección</p>
                    <p className="text-card-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      {selectedProyecto.direccion}, {selectedProyecto.comuna}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Estado Obra</p>
                    <p className="text-card-foreground">{selectedProyecto.estadoObra} — {new Date(selectedProyecto.fechaEstadoObra).toLocaleDateString("es-CL")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Monto Estimado</p>
                    <p className="text-card-foreground font-semibold">{selectedProyecto.montoEstimado ? formatCLP(selectedProyecto.montoEstimado) : "—"}</p>
                  </div>
                </div>

                {/* Contactos */}
                {[
                  { label: "Arquitectura", data: selectedProyecto.arquitectura },
                  { label: "Constructora", data: selectedProyecto.constructora },
                  { label: "ITO", data: selectedProyecto.ito },
                  { label: "Dueños", data: selectedProyecto.duenos },
                ].filter(c => c.data.nombre).map(({ label, data }) => (
                  <div key={label} className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Empresa:</span> <span className="text-card-foreground">{data.nombre}</span></div>
                      <div><span className="text-muted-foreground">Contacto:</span> <span className="text-card-foreground">{data.contacto}</span></div>
                      <div><span className="text-muted-foreground">Email:</span> <span className="text-card-foreground">{data.mail}</span></div>
                      <div><span className="text-muted-foreground">Teléfono:</span> <span className="text-card-foreground">{data.telefono}</span></div>
                    </div>
                  </div>
                ))}

                {/* Empresas vinculadas */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Empresas Vinculadas
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedProyecto.empresasVinculadas.map((eId) => {
                      const emp = mockEmpresas.find((e) => e.id === eId);
                      return emp ? (
                        <span key={eId} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          {emp.nombre}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
