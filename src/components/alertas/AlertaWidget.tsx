import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ChevronDown, ChevronUp, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { useAlertas, useToggleAlertaCompletada } from "@/hooks/useAlertas";
import { isBefore, startOfDay, addDays, isToday, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function AlertaWidget() {
  const [expanded, setExpanded] = useState(false);
  const { data: alertas } = useAlertas();
  const toggleCompletada = useToggleAlertaCompletada();

  const today = startOfDay(new Date());
  const endOfWeek = addDays(today, 7);

  const relevantAlertas = useMemo(() => {
    if (!alertas) return [];
    return alertas
      .filter((a) => !a.completada && isBefore(new Date(a.fecha_seguimiento), endOfWeek))
      .sort((a, b) => new Date(a.fecha_seguimiento).getTime() - new Date(b.fecha_seguimiento).getTime());
  }, [alertas, endOfWeek]);

  const vencidasCount = relevantAlertas.filter((a) => isBefore(new Date(a.fecha_seguimiento), today)).length;
  const hoyCount = relevantAlertas.filter((a) => isToday(new Date(a.fecha_seguimiento))).length;

  if (relevantAlertas.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <motion.div
        layout
        className="bg-card border border-border rounded-xl shadow-lg overflow-hidden"
      >
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-4 h-4 text-accent" />
              {vencidasCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />
              )}
            </div>
            <span className="text-sm font-semibold text-card-foreground">
              Alertas ({relevantAlertas.length})
            </span>
            {vencidasCount > 0 && (
              <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">
                {vencidasCount} vencidas
              </span>
            )}
            {hoyCount > 0 && (
              <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded font-medium">
                {hoyCount} hoy
              </span>
            )}
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </button>

        {/* Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border max-h-64 overflow-y-auto">
                {relevantAlertas.map((a) => {
                  const vencida = isBefore(new Date(a.fecha_seguimiento), today);
                  const hoy = isToday(new Date(a.fecha_seguimiento));
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-start gap-2 px-4 py-2.5 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors",
                        vencida && "bg-destructive/5"
                      )}
                    >
                      <button
                        onClick={() => toggleCompletada.mutate({ id: a.id, completada: true })}
                        className="mt-0.5 shrink-0"
                      >
                        <Circle className={cn("w-4 h-4", vencida ? "text-destructive" : "text-muted-foreground")} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-card-foreground truncate">{a.texto}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {a.proyectos ? `#${a.proyectos.numero} ${a.proyectos.nombre}` : ""}
                          {a.empresas ? ` · ${a.empresas.nombre}` : ""}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium shrink-0 mt-0.5",
                        vencida ? "text-destructive" : hoy ? "text-warning" : "text-muted-foreground"
                      )}>
                        {vencida ? "Vencida" : hoy ? "Hoy" : format(new Date(a.fecha_seguimiento), "dd MMM", { locale: es })}
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
  );
}
