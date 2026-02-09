import { useState } from "react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";

export function AlertasCollapsible({ alertas }: { alertas: AlertaWithRelations[] }) {
  const [expanded, setExpanded] = useState(false);
  const active = alertas.filter(a => !a.completada);

  if (active.length === 0) return <span className="text-[10px] text-muted-foreground italic">Sin alertas</span>;

  return (
    <div>
      <button
        className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <Bell className="w-3 h-3" />
        {active.length} alerta{active.length !== 1 ? "s" : ""}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {active.map(a => {
            const isOverdue = new Date(a.fecha_seguimiento) < new Date(new Date().toDateString());
            return (
              <div key={a.id} className={`text-[10px] border-l-2 pl-1.5 ${isOverdue ? "border-destructive" : "border-amber-400"}`}>
                <div className="truncate max-w-[200px] text-card-foreground">{a.texto}</div>
                <div className={`text-[9px] ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  {new Date(a.fecha_seguimiento).toLocaleDateString("es-CL")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AlertaResponsableList({ alertas }: { alertas: AlertaWithRelations[] }) {
  const active = alertas.filter(a => !a.completada);
  if (active.length === 0) return null;

  return (
    <div className="space-y-1">
      {active.map(a => (
        <div key={a.id} className="text-[10px] leading-tight">
          <div className="font-medium text-card-foreground truncate max-w-[120px]">
            {a.responsable_profile?.display_name || a.responsable_profile?.email || "—"}
          </div>
          <div className="text-muted-foreground">
            {new Date(a.fecha_seguimiento).toLocaleDateString("es-CL")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ParentAlertasDisplay({ alertas }: { alertas: AlertaWithRelations[] }) {
  const [expanded, setExpanded] = useState(false);
  const active = alertas.filter(a => !a.completada);

  if (active.length === 0) return null;

  return (
    <div>
      <button
        className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <Bell className="w-3 h-3" />
        {active.length} alerta{active.length !== 1 ? "s" : ""} del proyecto
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1 space-y-1.5">
          {active.map(a => {
            const isOverdue = new Date(a.fecha_seguimiento) < new Date(new Date().toDateString());
            return (
              <div key={a.id} className={`text-[10px] border-l-2 pl-1.5 ${isOverdue ? "border-destructive" : "border-amber-400"}`}>
                <div className="truncate max-w-[280px] text-card-foreground">{a.texto}</div>
                <div className="flex gap-2 text-[9px] text-muted-foreground">
                  <span className="font-medium">{a.responsable_profile?.display_name || a.responsable_profile?.email || "—"}</span>
                  <span className={isOverdue ? "text-destructive" : ""}>{new Date(a.fecha_seguimiento).toLocaleDateString("es-CL")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
