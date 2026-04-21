import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useHitosTemplate, useHitosTemplateMutations, type HitosColumn } from "@/hooks/useHitosTemplate";

export default function HitosEjecucionPage() {
  const { data, isLoading } = useHitosTemplate();
  const m = useHitosTemplateMutations();

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColTipo, setNewColTipo] = useState<"texto" | "select">("texto");

  const [editCol, setEditCol] = useState<HitosColumn | null>(null);
  const [optionsCol, setOptionsCol] = useState<HitosColumn | null>(null);

  if (isLoading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  const columns = data?.columns || [];
  const rows = data?.rows || [];

  const handleAddColumn = async () => {
    const name = newColName.trim();
    if (!name) { toast.error("Nombre requerido"); return; }
    if (columns.some(c => c.nombre.toLowerCase() === name.toLowerCase())) {
      toast.error("Ya existe una columna con ese nombre"); return;
    }
    try {
      await m.addColumn.mutateAsync({ nombre: name, tipo: newColTipo, orden: columns.length });
      setNewColName(""); setNewColTipo("texto"); setShowAddCol(false);
      toast.success("Columna agregada");
    } catch (e: any) { toast.error(e.message); }
  };

  const moveColumn = async (col: HitosColumn, dir: -1 | 1) => {
    const sorted = [...columns].sort((a, b) => a.orden - b.orden);
    const idx = sorted.findIndex(c => c.id === col.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      m.updateColumn.mutateAsync({ id: col.id, orden: swap.orden }),
      m.updateColumn.mutateAsync({ id: swap.id, orden: col.orden }),
    ]);
  };

  const moveRow = async (rowId: string, currOrden: number, dir: -1 | 1) => {
    const sorted = [...rows].sort((a, b) => a.orden - b.orden);
    const idx = sorted.findIndex(r => r.id === rowId);
    const swap = sorted[idx + dir];
    if (!swap) return;
    await Promise.all([
      m.updateRow.mutateAsync({ id: rowId, orden: swap.orden }),
      m.updateRow.mutateAsync({ id: swap.id, orden: currOrden }),
    ]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-card-foreground">Hitos Ejecución Proyectos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define la plantilla global de checklist que aparecerá bajo cada empresa cuando un proyecto esté en fase «Obra/Ejecución».
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setShowAddCol(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Agregar columna</Button>
        <Button variant="outline" size="sm" onClick={() => m.addRow.mutate(rows.length).valueOf()}>
          <Plus className="w-4 h-4 mr-1" /> Agregar fila
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 w-16 text-muted-foreground font-medium">#</th>
              {columns.sort((a, b) => a.orden - b.orden).map((col) => (
                <th key={col.id} className="text-left px-3 py-2 text-card-foreground font-semibold min-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    <span>{col.nombre}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">({col.tipo})</span>
                    <div className="ml-auto flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Subir" onClick={() => moveColumn(col, -1)}><ArrowUp className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Bajar" onClick={() => moveColumn(col, 1)}><ArrowDown className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Editar" onClick={() => setEditCol(col)}><Pencil className="w-3 h-3" /></Button>
                      {col.tipo === "select" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Opciones" onClick={() => setOptionsCol(col)}><Settings className="w-3 h-3" /></Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" title="Eliminar columna" onClick={async () => {
                        if (confirm(`¿Eliminar columna "${col.nombre}"? Se borrarán todos los valores asociados.`)) {
                          await m.deleteColumn.mutateAsync(col.id);
                          toast.success("Columna eliminada");
                        }
                      }}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </th>
              ))}
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rows.sort((a, b) => a.orden - b.orden).map((row, i) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                {columns.sort((a, b) => a.orden - b.orden).map((col) => (
                  <td key={col.id} className="px-3 py-2 text-muted-foreground italic text-xs">
                    {col.tipo === "select" ? `(lista: ${col.options.map(o => o.valor).join(", ") || "sin opciones"})` : "(texto libre)"}
                  </td>
                ))}
                <td className="px-2 py-2">
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveRow(row.id, row.orden, -1)}><ArrowUp className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveRow(row.id, row.orden, 1)}><ArrowDown className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={async () => {
                      if (confirm("¿Eliminar fila?")) {
                        await m.deleteRow.mutateAsync(row.id);
                        toast.success("Fila eliminada");
                      }
                    }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 2} className="px-3 py-6 text-center text-muted-foreground">Sin filas. Agrega una fila para comenzar.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add column dialog */}
      <Dialog open={showAddCol} onOpenChange={setShowAddCol}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar columna</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Ej: Responsable" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Select value={newColTipo} onValueChange={(v) => setNewColTipo(v as "texto" | "select")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto libre</SelectItem>
                  <SelectItem value="select">Lista desplegable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddCol(false)}>Cancelar</Button>
            <Button onClick={handleAddColumn}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit column */}
      <EditColumnDialog col={editCol} onClose={() => setEditCol(null)} />

      {/* Options dialog */}
      <OptionsDialog col={optionsCol} onClose={() => setOptionsCol(null)} />
    </div>
  );
}

function EditColumnDialog({ col, onClose }: { col: HitosColumn | null; onClose: () => void }) {
  const m = useHitosTemplateMutations();
  const [name, setName] = useState(col?.nombre || "");
  const [tipo, setTipo] = useState<"texto" | "select">(col?.tipo || "texto");

  if (!col) return null;
  return (
    <Dialog open={!!col} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar columna</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nombre</label>
            <Input defaultValue={col.nombre} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select defaultValue={col.tipo} onValueChange={(v) => setTipo(v as "texto" | "select")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="texto">Texto libre</SelectItem>
                <SelectItem value="select">Lista desplegable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={async () => {
            const finalName = (name || col.nombre).trim();
            if (!finalName) { toast.error("Nombre requerido"); return; }
            await m.updateColumn.mutateAsync({ id: col.id, nombre: finalName, tipo: tipo || col.tipo });
            toast.success("Columna actualizada");
            onClose();
          }}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OptionsDialog({ col, onClose }: { col: HitosColumn | null; onClose: () => void }) {
  const m = useHitosTemplateMutations();
  const [newOption, setNewOption] = useState("");
  if (!col) return null;
  return (
    <Dialog open={!!col} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Opciones de «{col.nombre}»</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {col.options.sort((a, b) => a.orden - b.orden).map((o) => (
            <div key={o.id} className="flex items-center gap-2">
              <Input defaultValue={o.valor} onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== o.valor) m.updateOption.mutate({ id: o.id, valor: v });
              }} />
              <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={async () => {
                await m.deleteOption.mutateAsync(o.id);
              }}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {col.options.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin opciones aún.</p>
          )}
        </div>
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Nueva opción" />
          <Button onClick={async () => {
            const v = newOption.trim();
            if (!v) return;
            await m.addOption.mutateAsync({ column_id: col.id, valor: v, orden: col.options.length });
            setNewOption("");
          }}>Agregar</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}