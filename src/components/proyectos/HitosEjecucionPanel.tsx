import { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, CalendarIcon, Check, Eye, EyeOff, FileText, FileSpreadsheet } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { todayLocalISO } from "@/lib/date-utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHitosTemplate, type HitosColumn } from "@/hooks/useHitosTemplate";
import { useHitosProyectoEmpresa, useHitosProyectoEmpresaMutations } from "@/hooks/useHitosProyectoEmpresa";
import { cn } from "@/lib/utils";

interface Props {
  proyectoEmpresaId: string;
  empresaName?: string | null;
  defaultOpen?: boolean;
  draftMode?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

export interface HitosEjecucionPanelHandle {
  save: () => Promise<void>;
  discard: () => void;
  isDirty: () => boolean;
}

const HitosEjecucionPanel = forwardRef<HitosEjecucionPanelHandle, Props>(function HitosEjecucionPanel(
  { proyectoEmpresaId, empresaName, defaultOpen = false, draftMode = false, onDirtyChange },
  ref,
) {
  const [open, setOpen] = useState(defaultOpen);
  const { data: template } = useHitosTemplate();
  const { data: peData } = useHitosProyectoEmpresa(open ? proyectoEmpresaId : null);
  const { upsertValue, addExtraRow, deleteExtraRow } = useHitosProyectoEmpresaMutations(proyectoEmpresaId);

  const columns = useMemo(() => (template?.columns || []).slice().sort((a, b) => a.orden - b.orden), [template]);
  const tplRows = useMemo(() => (template?.rows || []).slice().sort((a, b) => a.orden - b.orden), [template]);
  const extraRows = useMemo(() => (peData?.extraRows || []).slice().sort((a, b) => a.orden - b.orden), [peData]);

  // Children map and collapse state for hierarchical template rows
  const childrenMap = useMemo(() => {
    const m = new Map<string, string[]>();
    tplRows.forEach(r => {
      if (r.parent_id) {
        const arr = m.get(r.parent_id) || [];
        arr.push(r.id);
        m.set(r.parent_id, arr);
      }
    });
    return m;
  }, [tplRows]);
  const depthMap = useMemo(() => {
    const byId = new Map(tplRows.map(r => [r.id, r] as const));
    const cache = new Map<string, number>();
    const depth = (id: string): number => {
      if (cache.has(id)) return cache.get(id)!;
      const r = byId.get(id);
      if (!r || !r.parent_id) { cache.set(id, 0); return 0; }
      const d = depth(r.parent_id) + 1;
      cache.set(id, d);
      return d;
    };
    tplRows.forEach(r => depth(r.id));
    return cache;
  }, [tplRows]);
  // Hierarchical numbering: 1, 1.1, 1.1.1, 1.2, 2, ...
  const numberMap = useMemo(() => {
    const m = new Map<string, string>();
    const roots = tplRows.filter(r => !r.parent_id);
    const assign = (id: string, prefix: string) => {
      m.set(id, prefix);
      const kids = (childrenMap.get(id) || [])
        .map(cid => tplRows.find(r => r.id === cid)!)
        .filter(Boolean)
        .sort((a, b) => a.orden - b.orden);
      kids.forEach((k, i) => assign(k.id, `${prefix}.${i + 1}`));
    };
    roots.forEach((r, i) => assign(r.id, String(i + 1)));
    return m;
  }, [tplRows, childrenMap]);
  const [collapsedRows, setCollapsedRows] = useState<Set<string>>(new Set());
  const isRowVisible = useCallback((id: string): boolean => {
    const byId = new Map(tplRows.map(r => [r.id, r] as const));
    let cur = byId.get(id);
    while (cur?.parent_id) {
      if (collapsedRows.has(cur.parent_id)) return false;
      cur = byId.get(cur.parent_id);
    }
    return true;
  }, [tplRows, collapsedRows]);
  const toggleRow = useCallback((id: string) => {
    setCollapsedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Resolve effective color per template row (own or ancestor's, faded for inherited)
  const rowColorMap = useMemo(() => {
    const all = template?.rows || [];
    const byId = new Map(all.map(r => [r.id, r] as const));
    const cache = new Map<string, { color: string | null; own: boolean }>();
    const resolve = (id: string): { color: string | null; own: boolean } => {
      if (cache.has(id)) return cache.get(id)!;
      const r = byId.get(id);
      if (!r) { const v = { color: null, own: false }; cache.set(id, v); return v; }
      if (r.color) { const v = { color: r.color, own: true }; cache.set(id, v); return v; }
      if (r.parent_id) {
        const parent = resolve(r.parent_id);
        const v = { color: parent.color, own: false };
        cache.set(id, v); return v;
      }
      const v = { color: null, own: false }; cache.set(id, v); return v;
    };
    all.forEach(r => resolve(r.id));
    return cache;
  }, [template]);

  // Build value lookup
  const valueMap = useMemo(() => {
    const m = new Map<string, string>();
    (peData?.values || []).forEach(v => {
      const key = v.row_id ? `r:${v.row_id}|c:${v.column_id}` : `e:${v.extra_row_id}|c:${v.column_id}`;
      m.set(key, v.valor);
    });
    return m;
  }, [peData]);

  // Defaults from template (fallback when no per-project value yet)
  const defaultsMap = useMemo(() => {
    const m = new Map<string, string>();
    (template?.defaults || []).forEach(d => m.set(`${d.row_id}|${d.column_id}`, d.valor));
    return m;
  }, [template]);

  // Draft overlay: pending edits not yet committed
  const [draftMap, setDraftMap] = useState<Map<string, string>>(new Map());
  useEffect(() => { setDraftMap(new Map()); }, [proyectoEmpresaId]);
  useEffect(() => { onDirtyChange?.(draftMap.size > 0); }, [draftMap, onDirtyChange]);

  const stagedValueFor = useCallback((key: string, fallback: string) => {
    return draftMap.has(key) ? (draftMap.get(key) as string) : fallback;
  }, [draftMap]);

  const stageOrCommit = useCallback((row_id: string | null, extra_row_id: string | null, column_id: string, valor: string) => {
    if (draftMode) {
      const key = row_id ? `r:${row_id}|c:${column_id}` : `e:${extra_row_id}|c:${column_id}`;
      setDraftMap(prev => {
        const next = new Map(prev);
        next.set(key, valor);
        return next;
      });
    } else {
      upsertValue.mutate({ row_id, extra_row_id, column_id, valor });
    }
  }, [draftMode, upsertValue]);

  useImperativeHandle(ref, () => ({
    isDirty: () => draftMap.size > 0,
    discard: () => setDraftMap(new Map()),
    save: async () => {
      const entries = Array.from(draftMap.entries());
      for (const [key, valor] of entries) {
        const [rowPart, colPart] = key.split("|");
        const column_id = colPart.slice(2);
        const isTpl = rowPart.startsWith("r:");
        const id = rowPart.slice(2);
        await upsertValue.mutateAsync({
          row_id: isTpl ? id : null,
          extra_row_id: isTpl ? null : id,
          column_id,
          valor,
        });
      }
      setDraftMap(new Map());
    },
  }), [draftMap, upsertValue]);

  // Hitos = leaf rows (template rows without children) + extra rows
  const parentIds = useMemo(() => {
    const s = new Set<string>();
    tplRows.forEach(r => { if (r.parent_id) s.add(r.parent_id); });
    return s;
  }, [tplRows]);
  const leafTplRows = useMemo(() => tplRows.filter(r => !parentIds.has(r.id)), [tplRows, parentIds]);
  const totalHitos = leafTplRows.length + extraRows.length;

  // Completed hito = has any checkbox column marked as checked
  const checkboxCols = useMemo(() => columns.filter(c => c.tipo === "checkbox"), [columns]);
  const isRowCompleted = useCallback((prefix: "r" | "e", rowId: string) => {
    if (checkboxCols.length === 0) return false;
    return checkboxCols.some(c => {
      const k = `${prefix}:${rowId}|c:${c.id}`;
      const raw = stagedValueFor(k, valueMap.get(k) ?? (prefix === "r" ? defaultsMap.get(`${rowId}|${c.id}`) : "") ?? "");
      if (!raw) return false;
      try { const p = JSON.parse(raw); return !!p.checked; } catch { return false; }
    });
  }, [checkboxCols, stagedValueFor, valueMap, defaultsMap]);
  const completedHitos = useMemo(() => {
    let n = 0;
    leafTplRows.forEach(r => { if (isRowCompleted("r", r.id)) n++; });
    extraRows.forEach(r => { if (isRowCompleted("e", r.id)) n++; });
    return n;
  }, [leafTplRows, extraRows, isRowCompleted]);

  // Hide completed (leaf) rows toggle
  const [hideCompleted, setHideCompleted] = useState(false);

  // Get display value for export (text representation of cell value)
  const getDisplayValue = useCallback((prefix: "r" | "e", rowId: string, col: HitosColumn): string => {
    const k = `${prefix}:${rowId}|c:${col.id}`;
    const raw = stagedValueFor(k, valueMap.get(k) ?? (prefix === "r" ? defaultsMap.get(`${rowId}|${col.id}`) : "") ?? "");
    if (!raw) return "";
    if (col.tipo === "checkbox") {
      try {
        const p = JSON.parse(raw);
        if (!p.checked) return "";
        return p.fecha ? `✓ ${format(parseISO(p.fecha), "dd-MM-yyyy")}` : "✓";
      } catch { return raw ? "✓" : ""; }
    }
    if (col.tipo === "fecha") {
      const d = parseISO(raw);
      return isValid(d) ? format(d, "dd-MM-yyyy") : raw;
    }
    return raw;
  }, [stagedValueFor, valueMap, defaultsMap]);

  const exportRows = useCallback(() => {
    const rows: { num: string; cells: string[] }[] = [];
    tplRows.forEach((row, idx) => {
      const cells = columns.map(c => getDisplayValue("r", row.id, c));
      rows.push({ num: numberMap.get(row.id) || String(idx + 1), cells });
    });
    const baseN = tplRows.filter(r => !r.parent_id).length;
    extraRows.forEach((row, idx) => {
      const cells = columns.map(c => getDisplayValue("e", row.id, c));
      rows.push({ num: String(baseN + idx + 1), cells });
    });
    return rows;
  }, [tplRows, extraRows, columns, getDisplayValue, numberMap]);

  const handleExportExcel = useCallback(async () => {
    const XLSX = await import("xlsx");
    const headers = ["#", ...columns.map(c => c.nombre)];
    const data = exportRows().map(r => [r.num, ...r.cells]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hitos Ejecución");
    const fname = `Hitos_${(empresaName || "empresa").replace(/[^\w]/g, "_")}_${format(new Date(), "yyyyMMdd")}.xlsx`;
    XLSX.writeFile(wb, fname);
  }, [columns, exportRows, empresaName]);

  const handleExportPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(`Hitos Ejecución${empresaName ? ` — ${empresaName}` : ""}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Generado: ${format(new Date(), "dd-MM-yyyy HH:mm")} · ${completedHitos}/${totalHitos} completados`, 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["#", ...columns.map(c => c.nombre)]],
      body: exportRows().map(r => [r.num, ...r.cells]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: { 0: { cellWidth: 12 } },
    });
    const fname = `Hitos_${(empresaName || "empresa").replace(/[^\w]/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(fname);
  }, [columns, exportRows, empresaName, completedHitos, totalHitos]);

  // Resizable column widths (persisted per user in localStorage)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("hitos_panel_col_widths") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("hitos_panel_col_widths", JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);
  const startResize = useCallback((e: React.MouseEvent, colId: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = currentWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(60, startW + (ev.clientX - startX));
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
  }, []);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg bg-card/60">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-card-foreground hover:bg-muted/50 transition-colors rounded-t-lg">
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          <span>Hitos Ejecución{empresaName ? ` — ${empresaName}` : ""}</span>
          <span className="text-muted-foreground">({completedHitos}/{totalHitos || "—"})</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pt-1 overflow-x-auto">
          {columns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No hay columnas configuradas. Configura la plantilla en Administración → Hitos Ejecución Proyectos.</p>
          ) : (
            <>
              <div className="flex items-center justify-end gap-1 mb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHideCompleted(v => !v)}
                  className={cn("h-7 text-xs gap-1", hideCompleted && "text-destructive hover:text-destructive")}
                  title={hideCompleted ? "Mostrar todos los hitos" : "Ocultar hitos completados"}
                >
                  {hideCompleted ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {hideCompleted ? "Ver todos" : "Ocultar completados"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportExcel} className="h-7 text-xs gap-1" title="Descargar Excel">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportPDF} className="h-7 text-xs gap-1" title="Descargar PDF">
                  <FileText className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
              <table className="text-xs border border-border rounded" style={{ tableLayout: "fixed", width: "max-content", maxWidth: "100%" }}>
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-muted-foreground font-medium w-10">#</th>
                    {columns.map(c => {
                      const w = colWidths[c.id] || 160;
                      return (
                        <th
                          key={c.id}
                          style={{ width: w, minWidth: w, maxWidth: w, boxSizing: "border-box" }}
                          className="relative px-2 py-1.5 text-left text-card-foreground font-semibold"
                        >
                          <span className="block truncate pr-2">{c.nombre}</span>
                          <span
                            onMouseDown={(e) => startResize(e, c.id, w)}
                            className="absolute top-0 -right-1 h-full w-2 cursor-col-resize select-none hover:bg-primary/40 z-10"
                            title="Arrastra para ajustar el ancho"
                          />
                        </th>
                      );
                    })}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {tplRows.map((row, idx) => {
                    if (!isRowVisible(row.id)) return null;
                    const hasChildren = (childrenMap.get(row.id) || []).length > 0;
                    // Hide completed leaf rows when filter is on
                    if (hideCompleted && !hasChildren && isRowCompleted("r", row.id)) return null;
                    const collapsed = collapsedRows.has(row.id);
                    const depth = depthMap.get(row.id) || 0;
                    return (
                    <tr key={row.id} className="border-t border-border" style={(() => {
                      const c = rowColorMap.get(row.id);
                      if (!c?.color) return undefined;
                      return { backgroundColor: c.own ? `${c.color}33` : `${c.color}1A` };
                    })()}>
                      <td className="px-2 py-1 text-muted-foreground">
                        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 10 }}>
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleRow(row.id)}
                              className="h-4 w-4 inline-flex items-center justify-center rounded hover:bg-muted"
                              title={collapsed ? "Expandir" : "Colapsar"}
                            >
                              {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                          <span>{numberMap.get(row.id) || idx + 1}</span>
                        </div>
                      </td>
                      {columns.map(c => (
                        <td key={c.id} className="px-2 py-1">
                          <CellEditor
                            col={c}
                            allColumns={columns}
                            rowValues={columns.reduce((acc, cc) => {
                              const k = `r:${row.id}|c:${cc.id}`;
                              acc[cc.id] = stagedValueFor(k, valueMap.get(k) ?? defaultsMap.get(`${row.id}|${cc.id}`) ?? "");
                              return acc;
                            }, {} as Record<string, string>)}
                            onCommitOther={(colId, v) => stageOrCommit(row.id, null, colId, v)}
                            value={stagedValueFor(`r:${row.id}|c:${c.id}`, valueMap.get(`r:${row.id}|c:${c.id}`) ?? defaultsMap.get(`${row.id}|${c.id}`) ?? "")}
                            onCommit={(v) => stageOrCommit(row.id, null, c.id, v)}
                          />
                        </td>
                      ))}
                      <td></td>
                    </tr>
                    );
                  })}
                  {extraRows.map((row, idx) => {
                    if (hideCompleted && isRowCompleted("e", row.id)) return null;
                    return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1 text-muted-foreground">{tplRows.filter(r => !r.parent_id).length + idx + 1}</td>
                      {columns.map(c => (
                        <td key={c.id} className="px-2 py-1">
                          <CellEditor
                            col={c}
                            allColumns={columns}
                            rowValues={columns.reduce((acc, cc) => {
                              const k = `e:${row.id}|c:${cc.id}`;
                              acc[cc.id] = stagedValueFor(k, valueMap.get(k) || "");
                              return acc;
                            }, {} as Record<string, string>)}
                            onCommitOther={(colId, v) => stageOrCommit(null, row.id, colId, v)}
                            value={stagedValueFor(`e:${row.id}|c:${c.id}`, valueMap.get(`e:${row.id}|c:${c.id}`) || "")}
                            onCommit={(v) => stageOrCommit(null, row.id, c.id, v)}
                          />
                        </td>
                      ))}
                      <td className="px-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={async () => {
                          await deleteExtraRow.mutateAsync(row.id);
                        }}><Trash2 className="w-3 h-3" /></Button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                  await addExtraRow.mutateAsync(extraRows.length);
                }}>
                  <Plus className="w-3 h-3 mr-1" /> Agregar fila
                </Button>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

export default HitosEjecucionPanel;

/* ── Cell editor with debounced auto-save ── */
function CellEditor({ col, value, onCommit, allColumns, rowValues, onCommitOther }: {
  col: HitosColumn;
  value: string;
  onCommit: (v: string) => void;
  allColumns?: HitosColumn[];
  rowValues?: Record<string, string>;
  onCommitOther?: (columnId: string, valor: string) => void;
}) {
  const tipo = col.tipo;
  const options = col.options.map(o => o.valor);
  const readOnly = col.editable_en_proyecto === false;

  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);

  const handleChange = useCallback((v: string) => {
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(v), 600);
  }, [onCommit]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Detect if any checkbox column in this row that "fija fecha" is checked → lock fecha cells
  const lockedByCheckbox = useMemo(() => {
    if (tipo !== "fecha" || !allColumns || !rowValues) return false;
    return allColumns.some(c => {
      if (c.tipo !== "checkbox") return false;
      if (c.checkbox_action !== "fijar_fecha_y_completar" && c.checkbox_action !== "solo_fecha") return false;
      const raw = rowValues[c.id];
      if (!raw) return false;
      try { const p = JSON.parse(raw); return !!p.checked; } catch { return false; }
    });
  }, [tipo, allColumns, rowValues]);

  if (tipo === "select") {
    return (
      <Select value={local || undefined} onValueChange={(v) => onCommit(v)} disabled={readOnly}>
        <SelectTrigger className="h-7 text-xs" disabled={readOnly}><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (tipo === "fecha") {
    const dateValue = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
    return (
      <DateCellEditor
        value={value}
        dateValue={dateValue}
        disabled={lockedByCheckbox || readOnly}
        onCommit={onCommit}
      />
    );
  }

  if (tipo === "checkbox") {
    // value JSON: { checked: boolean, fecha?: string }
    let parsed: { checked: boolean; fecha?: string } = { checked: false };
    try { if (value) parsed = JSON.parse(value); } catch { parsed = { checked: !!value }; }
    const checked = !!parsed.checked;
    const action = col.checkbox_action;
    const showCompletedColor = checked && (action === "fijar_fecha_y_completar" || action === "solo_completar");
    // Find a fecha column in the same row (if any)
    const fechaCol = allColumns?.find(c => c.tipo === "fecha");
    const writesFecha = action === "fijar_fecha_y_completar" || action === "solo_fecha";
    // Show fecha inside checkbox only when there is no fecha column in the row
    const showFecha = writesFecha && !fechaCol && checked && parsed.fecha;

    const handleToggle = () => {
      if (readOnly) return;
      if (checked) {
        onCommit(JSON.stringify({ checked: false }));
        // No "unlock": we don't clear the fecha column on uncheck (user data preserved)
      } else {
        const next: any = { checked: true };
        if (writesFecha) {
          if (fechaCol && onCommitOther) {
            // Write today into the fecha column ONLY if it's empty
            const existing = rowValues?.[fechaCol.id]?.trim();
            if (!existing) onCommitOther(fechaCol.id, todayLocalISO());
          } else {
            next.fecha = todayLocalISO();
          }
        }
        onCommit(JSON.stringify(next));
      }
    };

    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={readOnly}
        className={cn(
          "h-7 w-full rounded border text-xs flex items-center justify-center gap-1.5 transition-colors disabled:cursor-not-allowed",
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

  return (
    <Input
      value={local}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => { focusedRef.current = false; clearTimeout(timer.current); onCommit(local); }}
      readOnly={readOnly}
      disabled={readOnly}
      tabIndex={readOnly ? -1 : undefined}
      className={cn("h-7 text-xs", readOnly && "pointer-events-none select-none opacity-100 bg-muted/40")}
    />
  );
}

/* ── Date editor: input dd-mm-yyyy + calendar popover ── */
function DateCellEditor({ value, dateValue, disabled, onCommit }: {
  value: string;
  dateValue: Date | undefined;
  disabled: boolean;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(dateValue ? format(dateValue, "dd-MM-yyyy") : "");
  const [open, setOpen] = useState(false);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(dateValue ? format(dateValue, "dd-MM-yyyy") : "");
    }
  }, [dateValue, value]);

  const formatTyping = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return out;
  };

  const tryCommit = (txt: string) => {
    if (!txt.trim()) { onCommit(""); return; }
    const m = txt.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) {
      // revert visible text to last valid value
      setText(dateValue ? format(dateValue, "dd-MM-yyyy") : "");
      return;
    }
    const [, dd, mm, yyyy] = m;
    const iso = `${yyyy}-${mm}-${dd}`;
    const parsed = parseISO(iso);
    if (!isValid(parsed)) {
      setText(dateValue ? format(dateValue, "dd-MM-yyyy") : "");
      return;
    }
    onCommit(iso);
  };

  return (
    <div className="relative w-full">
      <Input
        value={text}
        placeholder="dd-mm-aaaa"
        disabled={disabled}
        onFocus={() => { focusedRef.current = true; }}
        onBlur={() => { focusedRef.current = false; tryCommit(text); }}
        onChange={(e) => setText(formatTyping(e.target.value))}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-7 text-xs pr-7 w-full"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground disabled:opacity-50"
            title="Abrir calendario"
          >
            <CalendarIcon className="w-3 h-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(d) => {
              if (d) onCommit(format(d, "yyyy-MM-dd"));
              else onCommit("");
              setOpen(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}