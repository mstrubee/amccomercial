import { useState } from "react";
import { useEstadosAmc, useCreateEstadoAmc, useUpdateEstadoAmc, useDeleteEstadoAmc, EstadoAmc } from "@/hooks/useEstadosAmc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, Loader2, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRESET_COLORS = [
  "#6b7280", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
  "#059669", "#dc2626", "#7c3aed", "#0891b2", "#84cc16",
];

export default function EstadosAmcPage() {
  const { data: estados, isLoading } = useEstadosAmc();
  const createEstado = useCreateEstadoAmc();
  const updateEstado = useUpdateEstadoAmc();
  const deleteEstado = useDeleteEstadoAmc();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6b7280");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EstadoAmc | null>(null);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const maxOrden = estados?.reduce((m, e) => Math.max(m, e.orden), 0) ?? 0;
    createEstado.mutate({ nombre: name, orden: maxOrden + 1, color: newColor }, {
      onSuccess: () => { setNewName(""); setNewColor("#6b7280"); },
    });
  };

  const handleUpdate = () => {
    if (!editingId || !editingName.trim()) return;
    updateEstado.mutate({ id: editingId, nombre: editingName.trim() }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const handleColorChange = (estado: EstadoAmc, color: string) => {
    updateEstado.mutate({ id: estado.id, color });
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
        <h1 className="text-3xl font-bold text-foreground">Estado AMC (x Empresa)</h1>
        <p className="text-muted-foreground mt-1">Gestiona los estados AMC disponibles para las empresas en los proyectos</p>
      </div>

      {/* Add new */}
      <div className="flex gap-2 max-w-lg items-center">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-8 h-8 rounded-md border border-input shrink-0 cursor-pointer"
              style={{ backgroundColor: newColor }}
              title="Color de etiqueta"
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="grid grid-cols-5 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: newColor === c ? "white" : "transparent", boxShadow: newColor === c ? `0 0 0 2px ${c}` : "none" }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2 items-center">
              <Input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-10 h-8 p-0 border-0 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">{newColor}</span>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          placeholder="Nuevo estado AMC..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={!newName.trim() || createEstado.isPending} size="sm">
          <Plus className="w-4 h-4 mr-1" /> Agregar
        </Button>
      </div>

      {/* List */}
      <div className="border rounded-lg divide-y max-w-lg">
        {estados?.map((estado) => (
          <div key={estado.id} className="flex items-center gap-2 px-4 py-3">
            {/* Color picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="w-6 h-6 rounded shrink-0 cursor-pointer border border-input hover:ring-2 hover:ring-ring transition-shadow"
                  style={{ backgroundColor: estado.color }}
                  title="Cambiar color"
                />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: estado.color === c ? "white" : "transparent", boxShadow: estado.color === c ? `0 0 0 2px ${c}` : "none" }}
                      onClick={() => handleColorChange(estado, c)}
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-2 items-center">
                  <Input
                    type="color"
                    value={estado.color}
                    onChange={(e) => handleColorChange(estado, e.target.value)}
                    className="w-10 h-8 p-0 border-0 cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">{estado.color}</span>
                </div>
              </PopoverContent>
            </Popover>

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
                <span
                  className="flex-1 text-sm font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: estado.color + "20", color: estado.color }}
                >
                  {estado.nombre}
                </span>
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
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">No hay estados AMC creados</p>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estado AMC?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el estado AMC "{deleteTarget?.nombre}". Los proyectos que lo tengan asignado conservarán el valor actual como texto.
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
