import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronDown, Plus, Trash2, CalendarIcon, Check } from "lucide-react";
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
}

export default function HitosEjecucionPanel({ proyectoEmpresaId, empresaName }: Props) {
  const [open, setOpen] = useState(false);
  const { data: template } = useHitosTemplate();
  const { data: peData } = useHitosProyectoEmpresa(open ? proyectoEmpresaId : null);
  const { upsertValue, addExtraRow, deleteExtraRow } = useHitosProyectoEmpresaMutations(proyectoEmpresaId);

  const columns = useMemo(() => (template?.columns || []).slice().sort((a, b) => a.orden - b.orden), [template]);
  const tplRows = useMemo(() => (template?.rows || []).slice().sort((a, b) => a.orden - b.orden), [template]);
  const extraRows = useMemo(() => (peData?.extraRows || []).slice().sort((a, b) => a.orden - b.orden), [peData]);

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

  const totalCells = (tplRows.length + extraRows.length) * columns.length;
  const filledCells = (peData?.values || []).filter(v => v.valor && v.valor.trim().length > 0).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border rounded-lg bg-card/60">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-card-foreground hover:bg-muted/50 transition-colors rounded-t-lg">
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
          <span>Hitos Ejecución{empresaName ? ` — ${empresaName}` : ""}</span>
          <span className="text-muted-foreground">({filledCells}/{totalCells || "—"})</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 pt-1 overflow-x-auto">
          {columns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No hay columnas configuradas. Configura la plantilla en Administración → Hitos Ejecución Proyectos.</p>
          ) : (
            <>
              <table className="w-full text-xs border border-border rounded">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-muted-foreground font-medium w-10">#</th>
                    {columns.map(c => (
                      <th key={c.id} className="px-2 py-1.5 text-left text-card-foreground font-semibold">{c.nombre}</th>
                    ))}
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {tplRows.map((row, idx) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                      {columns.map(c => (
                        <td key={c.id} className="px-2 py-1">
                          <CellEditor
                            col={c}
                            value={valueMap.get(`r:${row.id}|c:${c.id}`) ?? defaultsMap.get(`${row.id}|${c.id}`) ?? ""}
                            onCommit={(v) => upsertValue.mutate({ row_id: row.id, extra_row_id: null, column_id: c.id, valor: v })}
                          />
                        </td>
                      ))}
                      <td></td>
                    </tr>
                  ))}
                  {extraRows.map((row, idx) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1 text-muted-foreground">{tplRows.length + idx + 1}</td>
                      {columns.map(c => (
                        <td key={c.id} className="px-2 py-1">
                          <CellEditor
                            col={c}
                            value={valueMap.get(`e:${row.id}|c:${c.id}`) || ""}
                            onCommit={(v) => upsertValue.mutate({ row_id: null, extra_row_id: row.id, column_id: c.id, valor: v })}
                          />
                        </td>
                      ))}
                      <td className="px-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={async () => {
                          await deleteExtraRow.mutateAsync(row.id);
                        }}><Trash2 className="w-3 h-3" /></Button>
                      </td>
                    </tr>
                  ))}
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
}

/* ── Cell editor with debounced auto-save ── */
function CellEditor({ col, value, onCommit }: {
  col: HitosColumn;
  value: string;
  onCommit: (v: string) => void;
}) {
  const tipo = col.tipo;
  const options = col.options.map(o => o.valor);

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

  if (tipo === "select") {
    return (
      <Select value={local || undefined} onValueChange={(v) => onCommit(v)}>
        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (tipo === "fecha") {
    const dateValue = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-7 text-xs w-full justify-start font-normal", !dateValue && "text-muted-foreground")}>
            <CalendarIcon className="w-3 h-3 mr-1.5" />
            {dateValue ? format(dateValue, "dd MMM yyyy", { locale: es }) : "—"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(d) => {
              if (d) onCommit(format(d, "yyyy-MM-dd"));
              else onCommit("");
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  }

  if (tipo === "checkbox") {
    // value JSON: { checked: boolean, fecha?: string }
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
        if (action === "fijar_fecha_y_completar" || action === "solo_fecha") next.fecha = todayLocalISO();
        onCommit(JSON.stringify(next));
      }
    };

    return (
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "h-7 w-full rounded border text-xs flex items-center justify-center gap-1.5 transition-colors",
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
      className="h-7 text-xs"
    />
  );
}