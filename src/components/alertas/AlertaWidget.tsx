import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown, ChevronUp, Circle, ExternalLink } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAlertas, useToggleAlertaCompletada, useCreateAlerta, AlertaWithRelations, AlertaInput } from "@/hooks/useAlertas";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProyectos } from "@/hooks/useProyectos";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { isBefore, startOfDay, addDays, isToday, format } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import CompleteAlertaDialog from "./CompleteAlertaDialog";
import AlertaFormDialog from "./AlertaFormDialog";

export default function AlertaWidget() {
  const [expanded, setExpanded] = useState(false);
  const { data: alertas } = useAlertas();
  const navigate = useNavigate();
  const location = useLocation();
  const toggleCompletada = useToggleAlertaCompletada();
  const createAlerta = useCreateAlerta();
  const { data: empresas } = useEmpresas();
  const { data: proyectosRaw } = useProyectos();
  const { user } = useAuth();

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, email");
      return data || [];
    },
  });

  const [completeTarget, setCompleteTarget] = useState<AlertaWithRelations | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ proyectoId?: string; empresaId?: string; parentAlertaId?: string }>({});

  const today = startOfDay(new Date());
  const endOfWeek = addDays(today, 7);

  const relevantAlertas = useMemo(() => {
    if (!alertas) return [];
    return alertas
      .filter((a) => !a.completada && isBefore(parseLocalDate(a.fecha_seguimiento), endOfWeek))
      .sort((a, b) => parseLocalDate(a.fecha_seguimiento).getTime() - parseLocalDate(b.fecha_seguimiento).getTime());
  }, [alertas, endOfWeek]);

  const proyectosList = useMemo(() => {
    if (!proyectosRaw) return [];
    const seen = new Map<string, { id: string; nombre: string; numero: number }>();
    proyectosRaw.forEach((p) => {
      if (!seen.has(p.nombre)) seen.set(p.nombre, { id: p.id, nombre: p.nombre, numero: p.numero });
    });
    return Array.from(seen.values()).sort((a, b) => a.numero - b.numero);
  }, [proyectosRaw]);

  const vencidasCount = relevantAlertas.filter((a) => isBefore(parseLocalDate(a.fecha_seguimiento), today)).length;
  const hoyCount = relevantAlertas.filter((a) => isToday(parseLocalDate(a.fecha_seguimiento))).length;

  const handleSubmit = (data: AlertaInput & { id?: string }) => {
    if (data.empresa_id === "none") data.empresa_id = null;
    createAlerta.mutate(data);
  };

  if (relevantAlertas.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 w-80">
        <motion.div layout className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="w-4 h-4 text-accent" />
                {vencidasCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />}
              </div>
              <span className="text-sm font-semibold text-card-foreground">Alertas ({relevantAlertas.length})</span>
              {vencidasCount > 0 && (
                <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">{vencidasCount} vencidas</span>
              )}
              {hoyCount > 0 && (
                <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded font-medium">{hoyCount} hoy</span>
              )}
            </div>
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          </button>

          {/* Content */}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <div className="border-t border-border max-h-64 overflow-y-auto">
                  {relevantAlertas.map((a) => {
                    const vencida = isBefore(parseLocalDate(a.fecha_seguimiento), today);
                    const hoy = isToday(parseLocalDate(a.fecha_seguimiento));
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-start gap-2 px-4 py-2.5 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors",
                          vencida && "bg-destructive/5"
                        )}
                      >
                        <button onClick={() => setCompleteTarget(a)} className="mt-0.5 shrink-0">
                          <Circle className={cn("w-4 h-4", vencida ? "text-destructive" : "text-muted-foreground")} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-card-foreground truncate">{a.texto}</p>
                          <button
                            className="text-[10px] text-muted-foreground truncate hover:text-primary flex items-center gap-0.5 group"
                            onClick={(e) => {
                              e.stopPropagation();
                              const params = new URLSearchParams({ highlight: a.proyecto_id });
                              if (location.pathname === "/proyectos") {
                                window.dispatchEvent(new CustomEvent("highlight-proyecto", { detail: a.proyecto_id }));
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
                        <span className={cn("text-[10px] font-medium shrink-0 mt-0.5", vencida ? "text-destructive" : hoy ? "text-warning" : "text-muted-foreground")}>
                          {vencida ? "Vencida" : hoy ? "Hoy" : format(parseLocalDate(a.fecha_seguimiento), "dd MMM", { locale: es })}
                        </span>
                      </div>
                    );
                  })}
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
        onComplete={(id) => toggleCompletada.mutate({ id, completada: true })}
        onCompleteAndCreate={(a) => {
          toggleCompletada.mutate({ id: a.id, completada: true });
          setCreateDefaults({ proyectoId: a.proyecto_id, empresaId: a.empresa_id || undefined, parentAlertaId: a.id });
          setCreateDialogOpen(true);
        }}
      />

      <AlertaFormDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setCreateDefaults({}); }}
        onSubmit={handleSubmit}
        editTarget={null}
        proyectos={proyectosList}
        empresas={empresas || []}
        profiles={profiles || []}
        currentUserId={user?.id || ""}
        defaultProyectoId={createDefaults.proyectoId}
        defaultEmpresaId={createDefaults.empresaId}
        parentAlertaId={createDefaults.parentAlertaId}
      />
    </>
  );
}
