import { useState } from "react";
import { useEstadosProyecto, useCreateEstadoProyecto, useUpdateEstadoProyecto, useDeleteEstadoProyecto, EstadoProyecto } from "@/hooks/useEstadosProyecto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function EstadosProyectoPage() {
  const { data: estados, isLoading } = useEstadosProyecto();
  const createEstado = useCreateEstadoProyecto();
  const updateEstado = useUpdateEstadoProyecto();
  const deleteEstado = useDeleteEstadoProyecto();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EstadoProyecto | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrden = estados?.reduce((m, e) => Math.max(m, e.orden), 0) ?? 0;
    createEstado.mutate({ nombre: name, orden: maxOrden + 1 }, {
      onSuccess: () => setNewName(""),
    });
  };

  const handleUpdate = () => {
    if (!editingId || !editingName.trim()) return;
    updateEstado.mutate({ id: editingId, nombre: editingName.trim() }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteEstado.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Estado (x Proyecto)</h1>
        <p className="text-muted-foreground mt-1">Gestiona los estados disponibles para los proyectos</p>
      </div>

      {/* Add new */}
      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Nuevo estado..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button onClick={handleCreate} disabled={!newName.trim() || createEstado.isPending} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Agregar
        </Button>
      </div>

      {/* List */}
      <div className="border rounded-lg divide-y max-w-md">
        {estados?.map((estado) => (
          <div key={estado.id} className="flex items-center gap-2 px-4 py-3">
            {editingId === estado.id ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                  className="flex-1 h-8"
                  autoFocus
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUpdate} disabled={updateEstado.isPending}>
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{estado.nombre}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(estado.id); setEditingName(estado.nombre); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteTarget(estado)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </>
            )}
          </div>
        ))}
        {(!estados || estados.length === 0) && (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">No hay estados creados</p>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el estado "{deleteTarget?.nombre}". Los proyectos que lo tengan asignado conservarán el valor actual como texto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
