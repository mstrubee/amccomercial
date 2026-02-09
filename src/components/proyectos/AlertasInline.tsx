import { useState } from "react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { Bell, ChevronDown, ChevronUp, Pencil, Trash2, Circle, CheckCircle2, GitBranch } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";

interface InlineProps {
  alertas: AlertaWithRelations[];
  allAlertas?: AlertaWithRelations[];
  onEdit?: (alerta: AlertaWithRelations) => void;
  onDelete?: (id: string) => void;
  onComplete?: (alerta: AlertaWithRelations) => void;
}

function AlertaItem({ alerta, allAlertas, onEdit, onDelete, onComplete, depth = 0 }: { alerta: AlertaWithRelations; allAlertas?: AlertaWithRelations[]; onEdit?: (a: AlertaWithRelations) => void; onDelete?: (id: string) => void; onComplete?: (a: AlertaWithRelations) => void; depth?: number }) {
  const [showTexto, setShowTexto] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const today = startOfDay(new Date());
  const fechaDate = parseLocalDate(alerta.fecha_seguimiento);
  const isOverdue = !alerta.completada && isBefore(fechaDate, today);
  const titulo = alerta.titulo;

  // Find child alerts
  const children = allAlertas?.filter(a => a.parent_alerta_id === alerta.id && !a.deleted) || [];
  const hasChildren = children.length > 0;

  return (
    <div className={cn("border-l-2 pl-2 py-1", depth > 0 && "ml-3", isOverdue ? "border-destructive" : alerta.completada ? "border-emerald-400" : "border-amber-400")}>
      {/* Row 1: title + date + responsible */}
      <button
        className="w-full text-left"
        onClick={(e) => { e.stopPropagation(); setShowTexto(!showTexto); }}
      >
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {alerta.completada ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              ) : null}
              {titulo && (
                <span className="text-[11px] font-semibold text-amber-700 truncate max-w-[160px]">{titulo}</span>
              )}
              {!titulo && (
                <span className="text-[11px] text-card-foreground truncate max-w-[160px]">{alerta.texto}</span>
              )}
              {showTexto ? <ChevronUp className="w-2.5 h-2.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className={cn(isOverdue && "text-destructive font-medium")}>
                {format(fechaDate, "dd MMM yyyy", { locale: es })}
                {isOverdue && " (vencida)"}
              </span>
              <span className="font-medium">{alerta.responsable_profile?.display_name || alerta.responsable_profile?.email || "—"}</span>
            </div>
          </div>
        </div>
      </button>

      {/* Row 2: expanded texto */}
      {showTexto && titulo && (
        <div className="mt-1 text-[10px] text-card-foreground bg-secondary/30 rounded px-2 py-1">
          {alerta.texto}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1 mt-0.5">
        {!alerta.completada && onComplete && (
          <button
            className="text-muted-foreground hover:text-emerald-600 p-0.5"
            onClick={(e) => { e.stopPropagation(); onComplete(alerta); }}
            title="Completar"
          >
            <Circle className="w-3 h-3" />
          </button>
        )}
        {onEdit && (
          <button
            className="text-muted-foreground hover:text-foreground p-0.5"
            onClick={(e) => { e.stopPropagation(); onEdit(alerta); }}
            title="Editar"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {onDelete && (
          <button
            className="text-muted-foreground hover:text-destructive p-0.5"
            onClick={(e) => { e.stopPropagation(); onDelete(alerta.id); }}
            title="Eliminar"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        {hasChildren && (
          <button
            className={cn("text-muted-foreground hover:text-foreground p-0.5 flex items-center gap-0.5", showChildren && "text-primary")}
            onClick={(e) => { e.stopPropagation(); setShowChildren(!showChildren); }}
            title="Ver seguimientos"
          >
            <GitBranch className="w-3 h-3" />
            <span className="text-[9px]">{children.length}</span>
          </button>
        )}
      </div>

      {/* Inline children tree */}
      {showChildren && hasChildren && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <AlertaItem key={child.id} alerta={child} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AlertasCollapsible({ alertas, allAlertas, onEdit, onDelete, onComplete }: InlineProps) {
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
        <div className="mt-1.5 space-y-1.5">
          {active.map(a => (
            <AlertaItem key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentAlertasDisplay({ alertas, allAlertas, onEdit, onDelete, onComplete }: InlineProps) {
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
        <div className="mt-1.5 space-y-1.5">
          {active.map(a => (
            <AlertaItem key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} />
          ))}
        </div>
      )}
    </div>
  );
}
