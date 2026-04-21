import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, Settings, CalendarIcon } from "lucide-react";
import { format, parse, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useHitosTemplate, useHitosTemplateMutations, type HitosColumn, type ColumnTipo, type CheckboxAction } from "@/hooks/useHitosTemplate";

export default function HitosEjecucionPage() {
  const { data, isLoading } = useHitosTemplate();
  const m = useHitosTemplateMutations();

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColTipo, setNewColTipo] = useState<ColumnTipo>("texto");
  const [newColAction, setNewColAction] = useState<CheckboxAction>("fijar_fecha_y_completar");
  const [newColColor, setNewColColor] = useState("#22c55e");

  const [editCol, setEditCol] = useState<HitosColumn | null>(null);
  const [optionsCol, setOptionsCol] = useState<HitosColumn | null>(null);

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const defaults = data?.defaults || [];
  const defaultsMap = useMemo(() => {
    const m = new Map<string, string>();
    defaults.forEach(d => m.set(`${d.row_id}|${d.column_id}`, d.valor));
    return m;
  }, [defaults]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

  const handleAddColumn = async () => {
    const name = newColName.trim();
    if (!name) { toast.error("Nombre requerido"); return; }
    if (columns.some(c => c.nombre.toLowerCase() === name.toLowerCase())) {
      toast.error("Ya existe una columna con ese nombre"); return;
    }
    try {
      await m.addColumn.mutateAsync({
        nombre: name, tipo: newColTipo, orden: columns.length,
        checkbox_action: newColTipo === "checkbox" ? newColAction : undefined,
        checkbox_color: newColTipo === "checkbox" ? newColColor : undefined,
      });
      setNewColName(""); setNewColTipo("texto"); setNewColAction("fijar_fecha_y_completar"); setNewColColor("#22c55e");
      setShowAddCol(false);
      toast.success("Columna agregada");
    } catch (e: any) { toast.error(e.message); }
  };

  const moveColumn = async (col: HitosColumn, dir: -1 | 1) => {
    const sorted = [...columns].sort((a, b) => a.orden - b.orden);
    const idx = sorted.findIndex(c => c.id === col.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    // Reorder the array, then re-assign sequential orden values to all columns
    const reordered = [...sorted];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    await Promise.all(
      reordered.map((c, i) =>
        c.orden === i ? Promise.resolve() : m.updateColumn.mutateAsync({ id: c.id, orden: i })
      )
    );
  };

  const moveRow = async (rowId: string, currOrden: number, dir: -1 | 1) => {
    const sorted = [...rows].sort((a, b) => a.orden - b.orden);
    const idx = sorted.findIndex(r => r.id === rowId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    await Promise.all(
      reordered.map((r, i) =>
        r.orden === i ? Promise.resolve() : m.updateRow.mutateAsync({ id: r.id, orden: i })
      )
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-card-foreground">Hitos Ejecución Proyectos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define la plantilla global TIPO de checklist. Las columnas son fijas (solo se gestionan aquí). El contenido de las filas funciona como valores por defecto que se cargan en cada proyecto. En cada proyecto se pueden agregar filas extra, pero no columnas.
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setShowAddCol(true)} size="sm"><Plus className="w-4 h-4 mr-1" /> Agregar columna</Button>
        <Button variant="outline" size="sm" onClick={() => m.addRow.mutate(rows.length)}>
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
                  <td key={col.id} className="px-2 py-1.5">
                    {col.tipo === "fecha" || col.tipo === "checkbox" ? (
                      <span className="text-[11px] text-muted-foreground italic">
                        {col.tipo === "fecha" ? "(fecha — se elige por proyecto)" : `(checkbox — ${col.checkbox_action.split("_").join(" ")})`}
                      </span>
                    ) : (
                      <DefaultCellEditor
                        tipo={col.tipo}
                        options={col.options.map(o => o.valor)}
                        value={defaultsMap.get(`${row.id}|${col.id}`) || ""}
                        onCommit={(v) => m.upsertRowDefault.mutate({ row_id: row.id, column_id: col.id, valor: v })}
                      />
                    )}
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
              <Select value={newColTipo} onValueChange={(v) => setNewColTipo(v as ColumnTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Texto libre</SelectItem>
                  <SelectItem value="select">Lista desplegable</SelectItem>
                  <SelectItem value="fecha">Fecha</SelectItem>
                  <SelectItem value="checkbox">Casilla (checkbox)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newColTipo === "checkbox" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Acción al marcar</label>
                  <Select value={newColAction} onValueChange={(v) => setNewColAction(v as CheckboxAction)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fijar_fecha_y_completar">Fijar fecha y pintar como completada</SelectItem>
                      <SelectItem value="solo_fecha">Solo fijar fecha</SelectItem>
                      <SelectItem value="solo_completar">Solo marcar como completada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newColAction !== "solo_fecha" && (
                  <div>
                    <label className="text-xs text-muted-foreground">Color de completado</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newColColor} onChange={(e) => setNewColColor(e.target.value)} className="h-9 w-14 rounded border border-border bg-transparent cursor-pointer" />
                      <Input value={newColColor} onChange={(e) => setNewColColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                )}
              </>
            )}
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
  const [tipo, setTipo] = useState<ColumnTipo>(col?.tipo || "texto");
  const [action, setAction] = useState<CheckboxAction>(col?.checkbox_action || "fijar_fecha_y_completar");
  const [color, setColor] = useState(col?.checkbox_color || "#22c55e");

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
            <Select defaultValue={col.tipo} onValueChange={(v) => setTipo(v as ColumnTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="texto">Texto libre</SelectItem>
                <SelectItem value="select">Lista desplegable</SelectItem>
                <SelectItem value="fecha">Fecha</SelectItem>
                <SelectItem value="checkbox">Casilla (checkbox)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === "checkbox" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Acción al marcar</label>
                <Select value={action} onValueChange={(v) => setAction(v as CheckboxAction)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fijar_fecha_y_completar">Fijar fecha y pintar como completada</SelectItem>
                    <SelectItem value="solo_fecha">Solo fijar fecha</SelectItem>
                    <SelectItem value="solo_completar">Solo marcar como completada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {action !== "solo_fecha" && (
                <div>
                  <label className="text-xs text-muted-foreground">Color de completado</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-14 rounded border border-border bg-transparent cursor-pointer" />
                    <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={async () => {
            const finalName = (name || col.nombre).trim();
            if (!finalName) { toast.error("Nombre requerido"); return; }
            await m.updateColumn.mutateAsync({
              id: col.id, nombre: finalName, tipo: tipo || col.tipo,
              checkbox_action: tipo === "checkbox" ? action : undefined,
              checkbox_color: tipo === "checkbox" ? color : undefined,
            });
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

function DefaultCellEditor({ tipo, options, value, onCommit }: {
  tipo: "texto" | "select";
  options: string[];
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const focusedRef = useRef(false);

  useEffect(() => { if (!focusedRef.current) setLocal(value); }, [value]);

  const handleChange = useCallback((v: string) => {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(v), 600);
  }, [onCommit]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (tipo === "select") {
    return (
      <Select value={local || undefined} onValueChange={(v) => onCommit(v)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => { focusedRef.current = false; clearTimeout(timer.current); onCommit(local); }}
      className="h-8 text-xs"
      placeholder="—"
    />
  );
}