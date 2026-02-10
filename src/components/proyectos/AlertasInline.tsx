import { useState } from "react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { Bell, ChevronDown, ChevronUp, Pencil, Trash2, Circle, CheckCircle2, GitBranch, Plus } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface InlineProps {
  alertas: AlertaWithRelations[];
  allAlertas?: AlertaWithRelations[];
  onEdit?: (alerta: AlertaWithRelations) => void;
  onDelete?: (id: string) => void;
  onComplete?: (alerta: AlertaWithRelations) => void;
  onShowTree?: (alertaId: string) => void;
  onCreateDependent?: (parentAlerta: AlertaWithRelations) => void;
}

function AlertaChip({ alerta, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent, depth = 0 }: {
  alerta: AlertaWithRelations;
  allAlertas?: AlertaWithRelations[];
  onEdit?: (a: AlertaWithRelations) => void;
  onDelete?: (id: string) => void;
  onComplete?: (a: AlertaWithRelations) => void;
  onShowTree?: (id: string) => void;
  onCreateDependent?: (a: AlertaWithRelations) => void;
  depth?: number;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const today = startOfDay(new Date());
  const fechaDate = parseLocalDate(alerta.fecha_seguimiento);
  const isOverdue = !alerta.completada && isBefore(fechaDate, today);

  const children = allAlertas?.filter(a => a.parent_alerta_id === alerta.id && !a.deleted) || [];
  const hasChildren = children.length > 0;
  const isPartOfChain = hasChildren || !!alerta.parent_alerta_id;

  const titulo = alerta.titulo;
  const displayLabel = titulo || alerta.texto;
  const fechaStr = format(fechaDate, "dd/MM", { locale: es });

  return (
    <div className={cn("inline-flex flex-col", depth > 0 && "ml-3")}>
      <div className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] leading-tight border cursor-pointer transition-colors group",
        isOverdue
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : alerta.completada
            ? "border-emerald-400/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
            : "border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      )}>
        {/* Status icon */}
        {alerta.completada ? (
          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
        ) : !alerta.completada && onComplete ? (
          <button onClick={(e) => { e.stopPropagation(); onComplete(alerta); }} title="Completar" className="hover:scale-125 transition-transform">
            <Circle className="w-2.5 h-2.5 shrink-0" />
          </button>
        ) : null}

        {/* Clickable label */}
        <button
          className="truncate max-w-[120px] font-medium text-left"
          onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
          title={displayLabel}
        >
          {displayLabel.length > 20 ? displayLabel.slice(0, 20) + "…" : displayLabel}
        </button>

        {/* Date */}
        <span className={cn("shrink-0 font-mono", isOverdue && "font-bold")}>
          {fechaStr}
        </span>

        {/* Action icons - visible on hover */}
        <span className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={(e) => { e.stopPropagation(); onEdit(alerta); }} title="Editar" className="hover:text-foreground">
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}
          {onCreateDependent && !alerta.completada && (
            <button onClick={(e) => { e.stopPropagation(); onCreateDependent(alerta); }} title="Crear dependiente" className="hover:text-primary">
              <Plus className="w-2.5 h-2.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(alerta.id); }} title="Eliminar" className="hover:text-destructive">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          )}
          {isPartOfChain && onShowTree && (
            <button onClick={(e) => { e.stopPropagation(); onShowTree(alerta.id); }} title="Ver árbol" className="hover:text-primary">
              <GitBranch className="w-2.5 h-2.5" />
            </button>
          )}
        </span>

        {/* Children toggle */}
        {hasChildren && (
          <button
            className="shrink-0 hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); setShowChildren(!showChildren); }}
            title={`${children.length} dependiente(s)`}
          >
            {showChildren ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            <span className="text-[9px]">{children.length}</span>
          </button>
        )}
      </div>

      {/* Expanded details */}
      {showDetails && (
        <div className="mt-0.5 text-[10px] text-card-foreground bg-secondary/40 rounded px-2 py-1 max-w-[260px]" onClick={(e) => e.stopPropagation()}>
          {titulo && <div className="mb-0.5">{alerta.texto}</div>}
          <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{format(fechaDate, "dd MMM yyyy", { locale: es })}{isOverdue && " (vencida)"}</span>
            <span className="font-medium">{alerta.responsable_profile?.display_name || alerta.responsable_profile?.email || "—"}</span>
          </div>
        </div>
      )}

      {/* Children */}
      {showChildren && hasChildren && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {children.map(child => (
            <AlertaChip key={child.id} alerta={child} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AlertasCollapsible({ alertas, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent }: InlineProps) {
  const [expanded, setExpanded] = useState(false);
  const active = alertas.filter(a => !a.completada && !a.deleted);
  const roots = active.filter(a => !a.parent_alerta_id || !active.some(p => p.id === a.parent_alerta_id));

  if (active.length === 0) return <span className="text-[10px] text-muted-foreground italic">Sin alertas</span>;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <Bell className="w-3 h-3" />
        {active.length} alerta{active.length !== 1 ? "s" : ""}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {roots.map(a => (
            <AlertaChip key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentAlertasDisplay({ alertas, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent }: InlineProps) {
  const [expanded, setExpanded] = useState(false);
  const active = alertas.filter(a => !a.completada && !a.deleted);
  const roots = active.filter(a => !a.parent_alerta_id || !active.some(p => p.id === a.parent_alerta_id));

  if (active.length === 0) return null;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <button
        className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <Bell className="w-3 h-3" />
        {active.length} alerta{active.length !== 1 ? "s" : ""} del proyecto
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {roots.map(a => (
            <AlertaChip key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} />
          ))}
        </div>
      )}
    </div>
  );
}
