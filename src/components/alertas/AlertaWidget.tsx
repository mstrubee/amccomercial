import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown, ChevronUp, Circle, ExternalLink } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAlertas, useToggleAlertaCompletada, useCreateAlerta, AlertaWithRelations, AlertaInput } from "@/hooks/useAlertas";
import { useClasificacionesAlerta } from "@/hooks/useClasificacionesAlerta";
import { useCategorias } from "@/hooks/useCategorias";
import { getNextClasificacion } from "@/lib/clasificacion-utils";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProyectos } from "@/hooks/useProyectos";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isBefore, startOfDay, addDays, isToday, format } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import CompleteAlertaDialog from "./CompleteAlertaDialog";
import AlertaFormDialog from "./AlertaFormDialog";
import { useThemeSettings } from "@/hooks/useThemeSettings";

type WidgetFilter = "hoy" | "semana" | "mes";

export default function AlertaWidget() {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<WidgetFilter>("semana");
  const { data: alertas } = useAlertas();
  const navigate = useNavigate();
  const location = useLocation();
  const toggleCompletada = useToggleAlertaCompletada();
  const createAlerta = useCreateAlerta();
  const { data: empresas } = useEmpresas();
  const { data: proyectosRaw } = useProyectos();
  const { user } = useAuth();
  const { data: categoriasComerciales } = useCategorias();
  const widgetQc = useQueryClient();
  const { data: themeData } = useThemeSettings();
  const alertPosition = themeData?.theme_alert_position || "bottom-right";

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name");
      return data || [];
    },
  });

  const [completeTarget, setCompleteTarget] = useState<AlertaWithRelations | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ proyectoId?: string; empresaId?: string; parentAlertaId?: string; defaultClasificacionId?: string; defaultSubclasificacionId?: string; defaultCategoriaProyectoId?: string; defaultSubcategoriaProyectoId?: string }>({});
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const { data: clasificacionesAlerta } = useClasificacionesAlerta();

  const today = startOfDay(new Date());
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);

  const allFuture = useMemo(() => {
    if (!alertas) return [];
    return alertas
      .filter((a) => !a.completada && !isBefore(parseLocalDate(a.fecha_seguimiento), today))
      .sort((a, b) => parseLocalDate(a.fecha_seguimiento).getTime() - parseLocalDate(b.fecha_seguimiento).getTime());
  }, [alertas, today]);

  const counts = useMemo(() => {
    const hoy = allFuture.filter((a) => isToday(parseLocalDate(a.fecha_seguimiento))).length;
    const semana = allFuture.filter((a) => parseLocalDate(a.fecha_seguimiento) <= in7).length;
    const mes = allFuture.filter((a) => parseLocalDate(a.fecha_seguimiento) <= in30).length;
    return { hoy, semana, mes };
  }, [allFuture, in7, in30]);

  const filtered = useMemo(() => {
    if (filter === "hoy") return allFuture.filter((a) => isToday(parseLocalDate(a.fecha_seguimiento)));
    if (filter === "semana") return allFuture.filter((a) => parseLocalDate(a.fecha_seguimiento) <= in7);
    return allFuture.filter((a) => parseLocalDate(a.fecha_seguimiento) <= in30);
  }, [allFuture, filter, in7, in30]);

  const proyectosList = useMemo(() => {
    if (!proyectosRaw) return [];
    const seen = new Map<string, { id: string; nombre: string; numero: number }>();
    proyectosRaw.forEach((p) => {
      if (!seen.has(p.nombre)) seen.set(p.nombre, { id: p.id, nombre: p.nombre, numero: p.numero });
    });
    return Array.from(seen.values()).sort((a, b) => a.numero - b.numero);
  }, [proyectosRaw]);

  const handleSubmit = (data: AlertaInput & { id?: string }) => {
    if (data.empresa_id === "none") data.empresa_id = null;
    if (pendingCompleteId) {
      toggleCompletada.mutate({ id: pendingCompleteId, completada: true });
      setPendingCompleteId(null);
    }
    createAlerta.mutate(data);
  };

  if (allFuture.length === 0) return null;

  const tabs: { key: WidgetFilter; label: string; count: number }[] = [
    { key: "hoy", label: "Hoy", count: counts.hoy },
    { key: "semana", label: "7 días", count: counts.semana },
    { key: "mes", label: "30 días", count: counts.mes },
  ];

  return (
    <>
      <div className={cn("fixed z-50 w-80", {
        "bottom-4 right-4": alertPosition === "bottom-right",
        "bottom-4 left-4": alertPosition === "bottom-left",
        "top-4 right-4": alertPosition === "top-right",
        "top-4 left-4": alertPosition === "top-left",
      })}>
        <motion.div layout className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-card-foreground">Alertas ({allFuture.length})</span>
              {counts.hoy > 0 && (
                <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded font-medium">{counts.hoy} hoy</span>
              )}
            </div>
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                {/* Filter tabs */}
                <div className="flex gap-1 px-3 py-2 border-t border-border bg-secondary/20">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={(e) => { e.stopPropagation(); setFilter(t.key); }}
                      className={cn(
                        "flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                        filter === t.key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      {t.label} ({t.count})
                    </button>
                  ))}
                </div>

                <div className="border-t border-border max-h-64 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">Sin alertas en este período</div>
                  ) : (
                    filtered.map((a) => {
                      const hoy = isToday(parseLocalDate(a.fecha_seguimiento));
                      return (
                        <div
                          key={a.id}
                          className="flex items-start gap-2 px-4 py-2.5 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                        >
                          <button onClick={() => setCompleteTarget(a)} className="mt-0.5 shrink-0">
                            <Circle className="w-4 h-4 text-muted-foreground" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-card-foreground truncate">{a.texto}</p>
                            <button
                              className="text-[10px] text-muted-foreground truncate hover:text-primary flex items-center gap-0.5 group"
                              onClick={(e) => {
                                e.stopPropagation();
                                const params = new URLSearchParams({ highlight: a.proyecto_id });
                                if (a.empresa_id) params.set("highlight_empresa", a.empresa_id);
                                if (location.pathname === "/proyectos") {
                                  window.dispatchEvent(new CustomEvent("highlight-proyecto", { detail: { proyectoId: a.proyecto_id, empresaId: a.empresa_id } }));
                                } else {
                                  navigate(`/proyectos?${params.toString()}`);
                                }
                              }}
                            >
                              {a.proyectos ? `#${a.proyectos.numero} ${a.proyectos.nombre}` : ""}
                              {a.empresas ? ` · ${a.empresas.nombre}` : ""}
                              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </div>
                          <span className={cn("text-[10px] font-medium shrink-0 mt-0.5", hoy ? "text-warning" : "text-muted-foreground")}>
                            {hoy ? "Hoy" : format(parseLocalDate(a.fecha_seguimiento), "dd MMM", { locale: es })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <CompleteAlertaDialog
        alerta={completeTarget}
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        categorias={categoriasComerciales}
        onAdvanceCategoria={async (pId, eId, catId, subId) => {
          await supabase.from("proyecto_empresas").update({ categoria_id: catId, subcategoria_id: subId }).eq("proyecto_id", pId).eq("empresa_id", eId);
          widgetQc.invalidateQueries({ queryKey: ["proyectos"] });
        }}
        onComplete={(id) => toggleCompletada.mutate({ id, completada: true })}
        onCompleteAndCreate={(a, advancedCat) => {
          setPendingCompleteId(a.id);
          const lastAc = a.alerta_clasificaciones?.length ? a.alerta_clasificaciones[a.alerta_clasificaciones.length - 1] : null;
          const next = clasificacionesAlerta && lastAc
            ? getNextClasificacion(lastAc.clasificacion_id, lastAc.subclasificacion_id, clasificacionesAlerta)
            : { clasificacionId: "", subclasificacionId: "" };
          setCreateDefaults({ proyectoId: a.proyecto_id, empresaId: a.empresa_id || undefined, parentAlertaId: a.id, defaultClasificacionId: next.clasificacionId, defaultSubclasificacionId: next.subclasificacionId, defaultCategoriaProyectoId: advancedCat?.categoriaId || (a as any).categoria_proyecto_id || undefined, defaultSubcategoriaProyectoId: advancedCat?.subcategoriaId || (a as any).subcategoria_proyecto_id || undefined });
          setCreateDialogOpen(true);
        }}
      />

      <AlertaFormDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setCreateDefaults({}); setPendingCompleteId(null); }}
        onSubmit={handleSubmit}
        editTarget={null}
        proyectos={proyectosList}
        empresas={empresas || []}
        profiles={profiles || []}
        currentUserId={user?.id || ""}
        defaultProyectoId={createDefaults.proyectoId}
        defaultEmpresaId={createDefaults.empresaId}
        parentAlertaId={createDefaults.parentAlertaId}
        defaultClasificacionId={createDefaults.defaultClasificacionId}
        defaultSubclasificacionId={createDefaults.defaultSubclasificacionId}
        defaultCategoriaProyectoId={createDefaults.defaultCategoriaProyectoId}
        defaultSubcategoriaProyectoId={createDefaults.defaultSubcategoriaProyectoId}
      />
    </>
  );
}
