import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, CalendarDays, Undo2, TrendingUp } from "lucide-react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { CategoriaWithSubs } from "@/hooks/useCategorias";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";
import { getNextCategoriaComercial } from "@/lib/clasificacion-utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  alerta: AlertaWithRelations | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  onCompleteAndCreate: (alerta: AlertaWithRelations) => void;
  onUncomplete?: (id: string, newDate?: string) => void;
  mode?: "complete" | "uncomplete";
  categorias?: CategoriaWithSubs[];
  onAdvanceCategoria?: (proyectoId: string, empresaId: string, categoriaId: string, subcategoriaId: string | null) => void;
}

export default function CompleteAlertaDialog({ alerta, open, onClose, onComplete, onCompleteAndCreate, onUncomplete, mode = "complete", categorias, onAdvanceCategoria }: Props) {
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [advanceEnabled, setAdvanceEnabled] = useState(true);
  const [selectedCatValue, setSelectedCatValue] = useState<string>("");

  const proyectoId = alerta?.proyecto_id;
  const empresaId = alerta?.empresa_id;

  // Fetch current proyecto_empresa record
  const { data: proyectoEmpresa } = useQuery({
    queryKey: ["proyecto-empresa-for-complete", proyectoId, empresaId],
    queryFn: async () => {
      if (!proyectoId || !empresaId) return null;
      const { data, error } = await supabase
        .from("proyecto_empresas")
        .select("categoria_id, subcategoria_id")
        .eq("proyecto_id", proyectoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!proyectoId && !!empresaId && open && mode === "complete",
  });

  // Compute next suggested category
  const suggested = useMemo(() => {
    if (!categorias || !proyectoEmpresa) return null;
    if (!proyectoEmpresa.categoria_id) {
      // No category yet → suggest the first one
      if (categorias.length === 0) return null;
      const first = categorias[0];
      const subs = first.subcategorias_proyecto || [];
      return { categoriaId: first.id, subcategoriaId: subs.length > 0 ? subs[0].id : "" };
    }
    return getNextCategoriaComercial(proyectoEmpresa.categoria_id, proyectoEmpresa.subcategoria_id, categorias);
  }, [categorias, proyectoEmpresa]);

  // Current category info
  const currentCatInfo = useMemo(() => {
    if (!categorias || !proyectoEmpresa) return null;
    if (!proyectoEmpresa.categoria_id) return { cat: null, sub: null };
    const cat = categorias.find(c => c.id === proyectoEmpresa.categoria_id);
    if (!cat) return { cat: null, sub: null };
    const sub = proyectoEmpresa.subcategoria_id
      ? cat.subcategorias_proyecto.find(s => s.id === proyectoEmpresa.subcategoria_id)
      : null;
    return { cat, sub };
  }, [categorias, proyectoEmpresa]);

  // Initialize selected value when suggested changes
  useEffect(() => {
    if (suggested && (suggested.categoriaId || suggested.subcategoriaId)) {
      const val = suggested.subcategoriaId ? `s:${suggested.subcategoriaId}` : `c:${suggested.categoriaId}`;
      setSelectedCatValue(val);
    } else {
      setSelectedCatValue("");
    }
  }, [suggested]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setAdvanceEnabled(true);
      setNewDate(undefined);
      setCalendarOpen(false);
    }
  }, [open]);

  if (!alerta) return null;

  const today = startOfDay(new Date());
  const isOverdue = isBefore(parseLocalDate(alerta.fecha_seguimiento), today);
  const needsDate = mode === "uncomplete" && isOverdue;
  const showCategorySection = mode === "complete" && !!proyectoId && !!empresaId && !!currentCatInfo && !!categorias && categorias.length > 0;

  const handleClose = () => {
    setNewDate(undefined);
    setCalendarOpen(false);
    onClose();
  };

  const handleAdvanceIfNeeded = () => {
    if (showCategorySection && advanceEnabled && selectedCatValue && onAdvanceCategoria && proyectoId && empresaId) {
      let catId: string;
      let subId: string | null;
      if (selectedCatValue.startsWith("s:")) {
        subId = selectedCatValue.slice(2);
        // Find parent cat
        const parentCat = categorias!.find(c => c.subcategorias_proyecto.some(s => s.id === subId));
        catId = parentCat?.id || "";
      } else {
        catId = selectedCatValue.startsWith("c:") ? selectedCatValue.slice(2) : selectedCatValue;
        subId = null;
      }
      if (catId) {
        onAdvanceCategoria(proyectoId, empresaId, catId, subId);
      }
    }
  };

  // Alert summary section (shared between modes)
  const AlertSummary = () => (
    <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-1">
      {(alerta as any).titulo && (
        <p className="text-sm font-semibold text-foreground">{(alerta as any).titulo}</p>
      )}
      <p className="text-sm text-card-foreground">{alerta.texto}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Proyecto: {alerta.proyectos?.nombre || "—"}</span>
        {alerta.empresas?.nombre && <span>· Empresa: {alerta.empresas.nombre}</span>}
        <span>· {format(parseLocalDate(alerta.fecha_seguimiento), "dd MMM yyyy", { locale: es })}</span>
      </div>
    </div>
  );

  if (mode === "uncomplete") {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-amber-600" />
              Reabrir Alerta
            </DialogTitle>
          </DialogHeader>
          <AlertSummary />
          {needsDate ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Esta alerta tiene fecha vencida. Debes establecer una nueva fecha de seguimiento futura para reactivarla.
              </p>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "dd MMM yyyy", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={(d) => { setNewDate(d || undefined); setCalendarOpen(false); }}
                    disabled={(date) => isBefore(startOfDay(date), today)}
                    defaultMonth={new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ¿Deseas reabrir esta alerta y marcarla como pendiente?
            </p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              disabled={needsDate && !newDate}
              onClick={() => {
                if (onUncomplete) {
                  const dateStr = newDate ? format(newDate, "yyyy-MM-dd") : undefined;
                  onUncomplete(alerta.id, dateStr);
                }
                handleClose();
              }}
            >
              Reabrir alerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Default "complete" mode
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Completar Alerta
          </DialogTitle>
        </DialogHeader>

        {/* Alert summary */}
        <AlertSummary />

        {/* Category advance section */}
        {showCategorySection && (
          <div className="space-y-3 border border-border rounded-lg p-3 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Categoría comercial</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="advance-cat"
                  checked={advanceEnabled}
                  onCheckedChange={(v) => setAdvanceEnabled(!!v)}
                />
                <label htmlFor="advance-cat" className="text-xs text-muted-foreground cursor-pointer">
                  Avanzar
                </label>
              </div>
            </div>

            {/* Current */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Actual:</span>
              {currentCatInfo!.cat ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: currentCatInfo!.sub?.color || currentCatInfo!.cat.color, color: "#fff" }}
                >
                  {currentCatInfo!.cat.nombre}
                  {currentCatInfo!.sub && ` › ${currentCatInfo!.sub.nombre}`}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Sin categoría asignada</span>
              )}
            </div>

            {/* Suggested next */}
            {advanceEnabled && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Avanzar a:</span>
                <Select value={selectedCatValue} onValueChange={setSelectedCatValue}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias!.map((cat) => (
                      <div key={cat.id}>
                        <SelectItem value={`c:${cat.id}`}>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            {cat.nombre}
                          </span>
                        </SelectItem>
                        {cat.subcategorias_proyecto.map((sub) => (
                          <SelectItem key={sub.id} value={`s:${sub.id}`}>
                            <span className="flex items-center gap-1.5 pl-3">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                              <span className="text-muted-foreground">↳</span> {sub.nombre}
                            </span>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          ¿Deseas crear una nueva alerta de seguimiento para esta misma línea?
        </p>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => { handleAdvanceIfNeeded(); onComplete(alerta.id); handleClose(); }}>
            Solo completar
          </Button>
          <Button onClick={() => { handleAdvanceIfNeeded(); onCompleteAndCreate(alerta); handleClose(); }}>
            Completar y crear nueva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
