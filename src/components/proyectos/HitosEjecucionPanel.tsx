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
function CellEditor({ tipo, options, value, onCommit }: {
  tipo: "texto" | "select";
  options: string[];
  value: string;
  onCommit: (v: string) => void;
}) {
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