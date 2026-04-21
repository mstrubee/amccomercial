import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Pencil, Settings, CalendarIcon, ChevronRight, ChevronDown } from "lucide-react";
import { Check } from "lucide-react";
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
import { useHitosTemplate, useHitosTemplateMutations, type HitosColumn, type ColumnTipo, type CheckboxAction, type HitosRow } from "@/hooks/useHitosTemplate";

export default function HitosEjecucionPage() {
  const { data, isLoading } = useHitosTemplate();
  const m = useHitosTemplateMutations();

  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColTipo, setNewColTipo] = useState<ColumnTipo>("texto");
  const [newColAction, setNewColAction] = useState<CheckboxAction>("fijar_fecha_y_completar");
  const [newColColor, setNewColColor] = useState("#22c55e");
  const [newColEditable, setNewColEditable] = useState<boolean>(true);

  const [editCol, setEditCol] = useState<HitosColumn | null>(null);
  const [optionsCol, setOptionsCol] = useState<HitosColumn | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("hitos_col_widths") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("hitos_col_widths", JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  const startResize = (e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = currentWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(80, startW + (ev.clientX - startX));
      setColWidths(prev => ({ ...prev, [colId]: w }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const defaults = data?.defaults || [];
  const defaultsMap = useMemo(() => {
    const m = new Map<string, string>();
    defaults.forEach(d => m.set(`${d.row_id}|${d.column_id}`, d.valor));
    return m;
  }, [defaults]);

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
        editable_en_proyecto: newColEditable,
      });
      setNewColName(""); setNewColTipo("texto"); setNewColAction("fijar_fecha_y_completar"); setNewColColor("#22c55e"); setNewColEditable(true);
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

  // Move a row up/down within its sibling group (same parent_id)
  const moveRow = async (row: HitosRow, dir: -1 | 1) => {
    const siblings = rows.filter(r => (r.parent_id ?? null) === (row.parent_id ?? null))
      .sort((a, b) => a.orden - b.orden);
    const idx = siblings.findIndex(r => r.id === row.id);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    await Promise.all(
      reordered.map((r, i) =>
        r.orden === i ? Promise.resolve() : m.updateRow.mutateAsync({ id: r.id, orden: i })
      )
    );
  };

  // Demote: become child of previous sibling
  const demoteRow = async (row: HitosRow) => {
    const siblings = rows.filter(r => (r.parent_id ?? null) === (row.parent_id ?? null))
      .sort((a, b) => a.orden - b.orden);
    const idx = siblings.findIndex(r => r.id === row.id);
    if (idx <= 0) { toast.error("No hay fila previa para anidar"); return; }
    const newParent = siblings[idx - 1];
    const newSiblings = rows.filter(r => r.parent_id === newParent.id).sort((a, b) => a.orden - b.orden);
    await m.updateRow.mutateAsync({ id: row.id, parent_id: newParent.id, orden: newSiblings.length });
    // Resequence old siblings
    const remaining = siblings.filter(r => r.id !== row.id);
    await Promise.all(remaining.map((r, i) => r.orden === i ? Promise.resolve() : m.updateRow.mutateAsync({ id: r.id, orden: i })));
  };

  // Promote: move out one level (become sibling of its parent)
  const promoteRow = async (row: HitosRow) => {
    if (!row.parent_id) { toast.error("Ya está en el nivel raíz"); return; }
    const parent = rows.find(r => r.id === row.parent_id);
    if (!parent) return;
    const grandParentId = parent.parent_id ?? null;
    const newSiblings = rows.filter(r => (r.parent_id ?? null) === grandParentId).sort((a, b) => a.orden - b.orden);
    const parentIdx = newSiblings.findIndex(r => r.id === parent.id);
    // Insert right after parent
    const insertAt = parentIdx + 1;
    // Shift siblings >= insertAt by +1, set row to insertAt
    await m.updateRow.mutateAsync({ id: row.id, parent_id: grandParentId, orden: insertAt });
    await Promise.all(newSiblings.slice(insertAt).map(r => m.updateRow.mutateAsync({ id: r.id, orden: r.orden + 1 })));
    // Resequence old siblings (children of original parent)
    const oldSiblings = rows.filter(r => r.parent_id === parent.id && r.id !== row.id).sort((a, b) => a.orden - b.orden);
    await Promise.all(oldSiblings.map((r, i) => r.orden === i ? Promise.resolve() : m.updateRow.mutateAsync({ id: r.id, orden: i })));
  };

  // Build flat hierarchical list with depth
  type FlatRow = { row: HitosRow; depth: number; numbering: string; ancestorColor: string | null; hasChildren: boolean };
  const flatRows = useMemo(() => {
    const childrenMap = new Map<string | null, HitosRow[]>();
    rows.forEach(r => {
      const key = r.parent_id ?? null;
      const arr = childrenMap.get(key) || [];
      arr.push(r);
      childrenMap.set(key, arr);
    });
    childrenMap.forEach(arr => arr.sort((a, b) => a.orden - b.orden));
    const result: FlatRow[] = [];
    const walk = (parentId: string | null, depth: number, prefix: string, inheritedColor: string | null) => {
      const list = childrenMap.get(parentId) || [];
      list.forEach((r, i) => {
        const numbering = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const ownColor = r.color || null;
        const hasChildren = (childrenMap.get(r.id) || []).length > 0;
        result.push({ row: r, depth, numbering, ancestorColor: inheritedColor, hasChildren });
        if (!collapsed.has(r.id)) {
          walk(r.id, depth + 1, numbering, ownColor || inheritedColor);
        }
      });
    };
    walk(null, 0, "", null);
    return result;
  }, [rows, collapsed]);

  const parentIdsWithChildren = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.parent_id) set.add(r.parent_id); });
    return set;
  }, [rows]);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const collapseAll = () => setCollapsed(new Set(parentIdsWithChildren));
  const expandAll = () => setCollapsed(new Set());

  if (isLoading) return <div className="p-8 text-muted-foreground">Cargando…</div>;

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
        <Button variant="outline" size="sm" onClick={() => {
          const rootRows = rows.filter(r => !r.parent_id);
          m.addRow.mutate({ orden: rootRows.length, parent_id: null });
        }}>
          <Plus className="w-4 h-4 mr-1" /> Agregar fila
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 w-16 text-muted-foreground font-medium">
                <div className="flex items-center gap-1">
                  {(() => {
                    const allCollapsed = parentIdsWithChildren.size > 0 && collapsed.size >= parentIdsWithChildren.size;
                    return (
                      <button
                        type="button"
                        onClick={allCollapsed ? expandAll : collapseAll}
                        className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-muted text-muted-foreground"
                        title={allCollapsed ? "Expandir todas" : "Colapsar todas"}
                        disabled={parentIdsWithChildren.size === 0}
                      >
                        {allCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })()}
                  <span>#</span>
                </div>
              </th>
              {columns.sort((a, b) => a.orden - b.orden).map((col) => (
                <th
                  key={col.id}
                  className="text-left px-3 py-2 text-card-foreground font-semibold relative"
                  style={{ width: colWidths[col.id] ?? 200, minWidth: 80 }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.nombre}</span>
                    <div className="ml-auto flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Mover a la izquierda" onClick={() => moveColumn(col, -1)}><ArrowLeft className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" title="Mover a la derecha" onClick={() => moveColumn(col, 1)}><ArrowRight className="w-3 h-3" /></Button>
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
                  <div
                    onMouseDown={(e) => startResize(e, col.id, colWidths[col.id] ?? 200)}
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60"
                    title="Arrastrar para ajustar ancho"
                  />
                </th>
              ))}
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {flatRows.map(({ row, depth, numbering, ancestorColor, hasChildren }) => {
              const ownColor = row.color || null;
              const effectiveColor = ownColor || ancestorColor;
              const rowBg = effectiveColor
                ? (ownColor ? `${effectiveColor}33` : `${effectiveColor}1A`) // own = ~20% alpha, inherited = ~10%
                : undefined;
              const isCollapsed = collapsed.has(row.id);
              return (
              <tr key={row.id} className="border-t border-border" style={rowBg ? { backgroundColor: rowBg } : undefined}>
                <td className="px-3 py-2 text-muted-foreground" style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}>
                  <div className="flex items-center gap-1.5">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleCollapse(row.id)}
                        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-muted text-muted-foreground"
                        title={isCollapsed ? "Expandir" : "Colapsar"}
                      >
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    ) : (
                      <span className="inline-block w-4" />
                    )}
                    <label className="relative inline-flex items-center cursor-pointer" title="Color de fila">
                      <span
                        className="inline-block w-3.5 h-3.5 rounded border border-border"
                        style={{ backgroundColor: ownColor || (ancestorColor ? `${ancestorColor}66` : "transparent") }}
                      />
                      <input
                        type="color"
                        value={ownColor || "#3b82f6"}
                        onChange={(e) => m.updateRow.mutate({ id: row.id, color: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    {ownColor && (
                      <button
                        type="button"
                        title="Quitar color"
                        className="text-[10px] text-muted-foreground hover:text-destructive"
                        onClick={() => m.updateRow.mutate({ id: row.id, color: null })}
                      >
                        ×
                      </button>
                    )}
                    <span>{numbering}</span>
                  </div>
                </td>
                {columns.sort((a, b) => a.orden - b.orden).map((col) => (
                  <td key={col.id} className="px-2 py-1.5">
                    {col.tipo === "checkbox" ? (
                      <CheckboxDefaultEditor
                        col={col}
                        value={defaultsMap.get(`${row.id}|${col.id}`) || ""}
                        onCommit={(v) => m.upsertRowDefault.mutate({ row_id: row.id, column_id: col.id, valor: v })}
                      />
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
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Subir" onClick={() => moveRow(row, -1)}><ArrowUp className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Bajar" onClick={() => moveRow(row, 1)}><ArrowDown className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Subir nivel (promover)" onClick={() => promoteRow(row)}><ArrowLeft className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Bajar nivel (anidar)" onClick={() => demoteRow(row)}><ArrowRight className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" title="Agregar sub-fila" onClick={() => {
                      const children = rows.filter(r => r.parent_id === row.id);
                      m.addRow.mutate({ orden: children.length, parent_id: row.id });
                    }}><Plus className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={async () => {
                      if (confirm("¿Eliminar fila? Se eliminarán también sus sub-filas.")) {
                        await m.deleteRow.mutateAsync(row.id);
                        toast.success("Fila eliminada");
                      }
                    }}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
              );
            })}
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
            <div>
              <label className="text-xs text-muted-foreground">¿Editable desde proyecto?</label>
              <Select value={newColEditable ? "si" : "no"} onValueChange={(v) => setNewColEditable(v === "si")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No (solo lectura en línea de proyecto)</SelectItem>
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
                      <SelectItem value="descartar">Descartar (tachar la fila completa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newColAction !== "solo_fecha" && newColAction !== "descartar" && (
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
  const [editable, setEditable] = useState<boolean>(col?.editable_en_proyecto !== false);

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
          <div>
            <label className="text-xs text-muted-foreground">¿Editable desde proyecto?</label>
            <Select value={editable ? "si" : "no"} onValueChange={(v) => setEditable(v === "si")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No (solo lectura en línea de proyecto)</SelectItem>
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
                    <SelectItem value="descartar">Descartar (tachar la fila completa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {action !== "solo_fecha" && action !== "descartar" && (
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
              editable_en_proyecto: editable,
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
  tipo: "texto" | "select" | "fecha";
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

  if (tipo === "fecha") {
    // value stored as YYYY-MM-DD; user can type dd-mm-yyyy or pick from calendar
    const dateValue = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
    const display = local && /^\d{4}-\d{2}-\d{2}$/.test(local)
      ? format(parseISO(local), "dd-MM-yyyy")
      : local;
    const handleTyped = (raw: string) => {
      setLocal(raw);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (!raw.trim()) { onCommit(""); return; }
        const parsed = parse(raw, "dd-MM-yyyy", new Date());
        if (isValid(parsed)) onCommit(format(parsed, "yyyy-MM-dd"));
      }, 600);
    };
    return (
      <div className="flex items-center gap-1">
        <Input
          value={display}
          onChange={(e) => handleTyped(e.target.value)}
          onFocus={() => { focusedRef.current = true; }}
          onBlur={() => { focusedRef.current = false; clearTimeout(timer.current);
            if (!local.trim()) { onCommit(""); return; }
            const parsed = parse(local, "dd-MM-yyyy", new Date());
            if (isValid(parsed)) onCommit(format(parsed, "yyyy-MM-dd"));
          }}
          placeholder="dd-mm-aaaa"
          className="h-8 text-xs"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
              <CalendarIcon className="w-3.5 h-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateValue}
              locale={es}
              onSelect={(d) => { onCommit(d ? format(d, "yyyy-MM-dd") : ""); }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
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

function CheckboxDefaultEditor({ col, value, onCommit }: {
  col: HitosColumn;
  value: string;
  onCommit: (v: string) => void;
}) {
  let parsed: { checked: boolean; fecha?: string } = { checked: false };
  try { if (value) parsed = JSON.parse(value); } catch { parsed = { checked: !!value }; }
  const checked = !!parsed.checked;
  const action = col.checkbox_action;
  const showCompletedColor = checked && (action === "fijar_fecha_y_completar" || action === "solo_completar");
  const showFecha = (action === "fijar_fecha_y_completar" || action === "solo_fecha") && checked && parsed.fecha;

  const handleToggle = () => {
    if (checked) {
      onCommit(JSON.stringify({ checked: false }));
    } else {
      const next: any = { checked: true };
      if (action === "fijar_fecha_y_completar" || action === "solo_fecha") {
        next.fecha = format(new Date(), "yyyy-MM-dd");
      }
      onCommit(JSON.stringify(next));
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "h-8 w-full rounded border text-xs flex items-center justify-center gap-1.5 transition-colors",
        showCompletedColor ? "text-white border-transparent" : "border-border bg-background hover:bg-muted/40"
      )}
      style={showCompletedColor ? { backgroundColor: col.checkbox_color } : undefined}
      title={action === "solo_fecha" ? "Marcar fecha" : action === "solo_completar" ? "Marcar completado" : "Marcar completado y fijar fecha"}
    >
      <span className={cn("w-3.5 h-3.5 rounded-sm border flex items-center justify-center", checked ? "bg-white/30 border-white/60" : "border-border")}>
        {checked && <Check className="w-2.5 h-2.5" />}
      </span>
      {showFecha && <span>{format(parseISO(parsed.fecha!), "dd/MM/yy")}</span>}
      {!checked && <span className="text-muted-foreground">—</span>}
    </button>
  );
}