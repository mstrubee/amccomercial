import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, ChevronRight, Calendar, Pencil, Trash2, PlusCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import {
  useEmpresas,
  useCreateEmpresa,
  useUpdateEmpresa,
  useDeleteEmpresa,
  useAddCondicion,
  useUpdateCondicion,
  EmpresaWithCondiciones,
  CondicionRow,
} from "@/hooks/useEmpresas";
import { formatCLP } from "@/data/mock-data";
import EmpresaFormDialog from "@/components/empresas/EmpresaFormDialog";
import CondicionFormDialog from "@/components/empresas/CondicionFormDialog";
import EditCondicionDialog from "@/components/empresas/EditCondicionDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Empresas() {
  const { data: empresas, isLoading } = useEmpresas();
  const createEmpresa = useCreateEmpresa();
  const updateEmpresa = useUpdateEmpresa();
  const deleteEmpresa = useDeleteEmpresa();
  const addCondicion = useAddCondicion();
  const updateCondicion = useUpdateCondicion();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<EmpresaWithCondiciones | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmpresaWithCondiciones | null>(null);
  const [condicionTarget, setCondicionTarget] = useState<EmpresaWithCondiciones | null>(null);
  const [editCondicion, setEditCondicion] = useState<CondicionRow | null>(null);

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
          <h1 className="text-3xl font-bold text-foreground">Empresas Representadas</h1>
          <p className="text-muted-foreground mt-1">Gestiona las empresas y sus condiciones comerciales</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Nueva Empresa
        </Button>
      </motion.div>

      {(!empresas || empresas.length === 0) && (
        <div className="text-center py-16 text-muted-foreground">
          <p>No hay empresas registradas.</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
            Crear primera empresa
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {empresas?.map((empresa, i) => {
          const condiciones = empresa.condiciones_comerciales || [];
          const condicionActual = condiciones[condiciones.length - 1];
          const isExpanded = expanded === empresa.id;

          return (
            <motion.div
              key={empresa.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between p-5">
                <button
                  onClick={() => setExpanded(isExpanded ? null : empresa.id)}
                  className="flex items-center gap-4 text-left flex-1 min-w-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">{empresa.nombre.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-card-foreground truncate">{empresa.nombre}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Desde {new Date(empresa.fecha_inicio_relacion).toLocaleDateString("es-CL")}
                      {condicionActual && (
                        <> · Fee: {formatCLP(condicionActual.fee_fijo_mensual)} · Comisión: {condicionActual.esquema_comision}%</>
                      )}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <StatusBadge status={empresa.estado} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditEmpresa(empresa)}>
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeleteTarget(empresa)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-border pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5" />
                          Historial de Condiciones Comerciales
                        </h4>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setCondicionTarget(empresa)}>
                          <PlusCircle className="w-3.5 h-3.5" />
                          Nueva Condición
                        </Button>
                      </div>
                      {condiciones.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Sin condiciones comerciales</p>
                      ) : (
                        <div className="space-y-2">
                          {condiciones.map((cc, ci) => {
                            const isCurrent = ci === condiciones.length - 1;
                            return (
                              <div
                                key={cc.id}
                                className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                                  isCurrent ? "bg-success/5 border border-success/20" : "bg-secondary/30"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${isCurrent ? "bg-success" : "bg-muted-foreground/30"}`} />
                                  <div>
                                    <span className="text-card-foreground font-medium">
                                      Fee: {formatCLP(cc.fee_fijo_mensual)} · Comisión: {cc.esquema_comision}%
                                    </span>
                                    {cc.descripcion && (
                                      <span className="text-muted-foreground ml-2 text-xs">— {cc.descripcion}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Desde {new Date(cc.fecha_vigencia).toLocaleDateString("es-CL")}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
                                      Vigente
                                    </span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setEditCondicion(cc)}
                                  >
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Create dialog */}
      <EmpresaFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        mode="create"
        isLoading={createEmpresa.isPending}
        onSubmit={(data) => {
          createEmpresa.mutate(data, { onSuccess: () => setShowCreate(false) });
        }}
      />

      {/* Edit dialog */}
      {editEmpresa && (
        <EmpresaFormDialog
          open={!!editEmpresa}
          onOpenChange={(val) => !val && setEditEmpresa(null)}
          mode="edit"
          initialData={{
            nombre: editEmpresa.nombre,
            estado: editEmpresa.estado,
            fecha_inicio_relacion: editEmpresa.fecha_inicio_relacion,
          }}
          isLoading={updateEmpresa.isPending}
          onSubmit={(data) => {
            updateEmpresa.mutate(
              { id: editEmpresa.id, nombre: data.nombre, estado: data.estado, fecha_inicio_relacion: data.fecha_inicio_relacion },
              { onSuccess: () => setEditEmpresa(null) }
            );
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.nombre}</strong> y todas sus condiciones comerciales. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteEmpresa.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add condicion dialog */}
      {condicionTarget && (
        <CondicionFormDialog
          open={!!condicionTarget}
          onOpenChange={(val) => !val && setCondicionTarget(null)}
          empresaNombre={condicionTarget.nombre}
          isLoading={addCondicion.isPending}
          onSubmit={(data) => {
            addCondicion.mutate(
              { empresa_id: condicionTarget.id, ...data },
              { onSuccess: () => setCondicionTarget(null) }
            );
          }}
        />
      )}

      {/* Edit condicion dialog */}
      {editCondicion && (
        <EditCondicionDialog
          open={!!editCondicion}
          onOpenChange={(val) => !val && setEditCondicion(null)}
          condicion={editCondicion}
          isLoading={updateCondicion.isPending}
          onSubmit={(data) => {
            updateCondicion.mutate(data, { onSuccess: () => setEditCondicion(null) });
          }}
        />
      )}
    </div>
  );
}
