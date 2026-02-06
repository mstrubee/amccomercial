import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Loader2, MapPin, Building2, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { useProyectos, useCreateProyecto, useUpdateProyecto, useDeleteProyecto, ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { formatCLP, formatUF, ufToCLP } from "@/data/mock-data";
import ProyectoFormDialog from "@/components/proyectos/ProyectoFormDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ESTADOS_AMC = ["Todos", "Vigente", "Todo Ofrecido", "Sin Respuesta", "Descartado"];

export default function Proyectos() {
  const { data: proyectos, isLoading } = useProyectos();
  const { data: empresas } = useEmpresas();
  const createProyecto = useCreateProyecto();
  const updateProyecto = useUpdateProyecto();
  const deleteProyecto = useDeleteProyecto();

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterEmpresa, setFilterEmpresa] = useState("Todas");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [viewTarget, setViewTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [templateSource, setTemplateSource] = useState<ProyectoWithEmpresas | null>(null);

  const filtered = (proyectos || []).filter((p) => {
    const matchSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.comuna.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === "Todos" || p.estado_amc === filterEstado;
    const matchEmpresa =
      filterEmpresa === "Todas" ||
      p.proyecto_empresas?.some((pe) => pe.empresa_id === filterEmpresa);
    return matchSearch && matchEstado && matchEmpresa;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proyectos</h1>
          <p className="text-muted-foreground mt-1">Base de datos de proyectos</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o comuna..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {ESTADOS_AMC.map((estado) => (
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
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filtrar empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las empresas</SelectItem>
              {empresas?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
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
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto Est. (UF)</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground">{p.numero}</td>
                  <td className="px-5 py-3 font-medium text-card-foreground cursor-pointer hover:underline" onClick={() => setViewTarget(p)}>{p.nombre}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.comuna}</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.estado_obra}</td>
                  <td className="px-5 py-3"><StatusBadge status={p.estado_amc} /></td>
                  <td className="px-5 py-3">
                    <span className={p.adjudicado ? "text-success font-medium" : "text-muted-foreground"}>{p.adjudicado ? "Sí" : "No"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {p.proyecto_empresas?.map((pe) => pe.empresas ? (
                        <span key={pe.id} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground">
                          {pe.empresas.nombre.split(" ")[0]}
                        </span>
                      ) : null)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-card-foreground">
                    {p.monto_estimado ? (
                      <div>
                        <span>{formatUF(p.monto_estimado)}</span>
                        <span className="block text-[10px] text-muted-foreground">{formatCLP(ufToCLP(p.monto_estimado))}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Usar como plantilla" onClick={() => setTemplateSource(p)}>
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(p)}>
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(p)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            {(proyectos || []).length === 0 ? (
              <div>
                <p>No hay proyectos registrados.</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>Crear primer proyecto</Button>
              </div>
            ) : (
              <p>No se encontraron proyectos con los filtros aplicados</p>
            )}
          </div>
        )}
      </motion.div>

      {/* Create dialog */}
      <ProyectoFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        mode="create"
        isLoading={createProyecto.isPending}
        onSubmit={(data) => {
          createProyecto.mutate(data, { onSuccess: () => setShowCreate(false) });
        }}
      />

      {/* Template dialog */}
      {templateSource && (
        <ProyectoFormDialog
          open={!!templateSource}
          onOpenChange={(val) => !val && setTemplateSource(null)}
          mode="create"
          initialData={{ ...templateSource, nombre: `${templateSource.nombre} (copia)` }}
          isLoading={createProyecto.isPending}
          onSubmit={(data) => {
            createProyecto.mutate(data, { onSuccess: () => setTemplateSource(null) });
          }}
        />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <ProyectoFormDialog
          open={!!editTarget}
          onOpenChange={(val) => !val && setEditTarget(null)}
          mode="edit"
          initialData={editTarget}
          isLoading={updateProyecto.isPending}
          onSubmit={(data) => {
            updateProyecto.mutate({ ...data, id: editTarget.id }, { onSuccess: () => setEditTarget(null) });
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteProyecto.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View detail dialog */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {viewTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{viewTarget.nombre}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div className="flex gap-3 flex-wrap">
                  <StatusBadge status={viewTarget.estado_amc} />
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    viewTarget.adjudicado ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {viewTarget.adjudicado ? "Adjudicado" : "No adjudicado"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Dirección</p>
                    <p className="text-card-foreground flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      {viewTarget.direccion || "—"}, {viewTarget.comuna || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Estado Obra</p>
                    <p className="text-card-foreground">{viewTarget.estado_obra || "—"} {viewTarget.fecha_estado_obra ? `— ${new Date(viewTarget.fecha_estado_obra).toLocaleDateString("es-CL")}` : ""}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Monto Estimado</p>
                    <p className="text-card-foreground font-semibold">
                      {viewTarget.monto_estimado ? (
                        <>
                          {formatUF(viewTarget.monto_estimado)}
                          <span className="text-xs text-muted-foreground font-normal ml-2">≈ {formatCLP(ufToCLP(viewTarget.monto_estimado))}</span>
                        </>
                      ) : "—"}
                    </p>
                  </div>
                </div>

                {[
                  { label: "Arquitectura", n: viewTarget.arq_nombre, c: viewTarget.arq_contacto, m: viewTarget.arq_mail, t: viewTarget.arq_telefono },
                  { label: "Constructora", n: viewTarget.const_nombre, c: viewTarget.const_contacto, m: viewTarget.const_mail, t: viewTarget.const_telefono },
                  { label: "ITO", n: viewTarget.ito_nombre, c: viewTarget.ito_contacto, m: viewTarget.ito_mail, t: viewTarget.ito_telefono },
                  { label: "Dueños", n: viewTarget.duenos_nombre, c: viewTarget.duenos_contacto, m: viewTarget.duenos_mail, t: viewTarget.duenos_telefono },
                ].filter((s) => s.n).map(({ label, n, c, m, t }) => (
                  <div key={label} className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Empresa:</span> <span className="text-card-foreground">{n}</span></div>
                      <div><span className="text-muted-foreground">Contacto:</span> <span className="text-card-foreground">{c}</span></div>
                      <div><span className="text-muted-foreground">Email:</span> <span className="text-card-foreground">{m}</span></div>
                      <div><span className="text-muted-foreground">Teléfono:</span> <span className="text-card-foreground">{t}</span></div>
                    </div>
                  </div>
                ))}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Empresas Vinculadas
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {viewTarget.proyecto_empresas?.map((pe) => pe.empresas ? (
                      <span key={pe.id} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {pe.empresas.nombre}
                      </span>
                    ) : null)}
                    {(!viewTarget.proyecto_empresas || viewTarget.proyecto_empresas.length === 0) && (
                      <span className="text-sm text-muted-foreground">Sin empresas vinculadas</span>
                    )}
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
