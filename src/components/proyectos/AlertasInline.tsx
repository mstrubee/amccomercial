import { useState } from "react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { Bell, ChevronDown, ChevronUp, Pencil, Trash2, Circle, CheckCircle2, GitBranch, Plus, ChevronsUpDown } from "lucide-react";
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
  onShowTree?: (alertaId: string) => void;
  onCreateDependent?: (parentAlerta: AlertaWithRelations) => void;
}

function AlertaItem({ alerta, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent, depth = 0, forceExpand }: {
  alerta: AlertaWithRelations;
  allAlertas?: AlertaWithRelations[];
  onEdit?: (a: AlertaWithRelations) => void;
  onDelete?: (id: string) => void;
  onComplete?: (a: AlertaWithRelations) => void;
  onShowTree?: (id: string) => void;
  onCreateDependent?: (a: AlertaWithRelations) => void;
  depth?: number;
  forceExpand?: boolean;
}) {
  const [showTexto, setShowTexto] = useState(false);
  const [showChildren, setShowChildren] = useState(false);
  const isTextoVisible = forceExpand || showTexto;
  const isChildrenVisible = forceExpand || showChildren;
  const today = startOfDay(new Date());
  const fechaDate = parseLocalDate(alerta.fecha_seguimiento);
  const isOverdue = !alerta.completada && isBefore(fechaDate, today);
  const titulo = alerta.titulo;

  const children = allAlertas?.filter(a => a.parent_alerta_id === alerta.id && !a.deleted) || [];
  const hasChildren = children.length > 0;
  const isPartOfChain = hasChildren || !!alerta.parent_alerta_id;

  return (
    <div className={cn("border-l-2 pl-2 py-1", depth > 0 && "ml-3", isOverdue ? "border-destructive" : alerta.completada ? "border-emerald-400" : "border-amber-400")}>
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
              {isTextoVisible ? <ChevronUp className="w-2.5 h-2.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground shrink-0" />}
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

      {isTextoVisible && titulo && (
        <div className="mt-1 text-[10px] text-card-foreground bg-secondary/30 rounded px-2 py-1">
          {alerta.texto}
        </div>
      )}

      <div className="flex gap-1 mt-0.5">
        {!alerta.completada && onComplete && (
          <button className="text-muted-foreground hover:text-emerald-600 p-0.5" onClick={(e) => { e.stopPropagation(); onComplete(alerta); }} title="Completar">
            <Circle className="w-3 h-3" />
          </button>
        )}
        {onEdit && (
          <button className="text-muted-foreground hover:text-foreground p-0.5" onClick={(e) => { e.stopPropagation(); onEdit(alerta); }} title="Editar">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {onCreateDependent && !alerta.completada && (
          <button className="text-muted-foreground hover:text-primary p-0.5" onClick={(e) => { e.stopPropagation(); onCreateDependent(alerta); }} title="Crear dependiente">
            <Plus className="w-3 h-3" />
          </button>
        )}
        {onDelete && (
          <button className="text-muted-foreground hover:text-destructive p-0.5" onClick={(e) => { e.stopPropagation(); onDelete(alerta.id); }} title="Eliminar">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        {isPartOfChain && onShowTree && (
          <button className="text-muted-foreground hover:text-primary p-0.5 flex items-center gap-0.5" onClick={(e) => { e.stopPropagation(); onShowTree(alerta.id); }} title="Ver árbol de dependencias">
            <GitBranch className="w-3 h-3" />
            {hasChildren && <span className="text-[9px]">{children.length}</span>}
          </button>
        )}
        {hasChildren && (
          <button className={cn("text-muted-foreground hover:text-foreground p-0.5 flex items-center gap-0.5", isChildrenVisible && "text-primary")} onClick={(e) => { e.stopPropagation(); setShowChildren(!showChildren); }} title="Expandir seguimientos">
            {isChildrenVisible ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>
        )}
      </div>

      {isChildrenVisible && hasChildren && (
        <div className="mt-1 space-y-1">
          {children.map(child => (
            <AlertaItem key={child.id} alerta={child} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} depth={depth + 1} forceExpand={forceExpand} />
          ))}
        </div>
      )}
    </div>
  );
}

export function AlertasCollapsible({ alertas, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent }: InlineProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const active = alertas.filter(a => !a.completada && !a.deleted);

  if (active.length === 0) return <span className="text-[10px] text-muted-foreground italic">Sin alertas</span>;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (expanded && expandAll) {
      setExpandAll(false);
      setExpanded(false);
    } else if (expanded) {
      setExpandAll(true);
    } else {
      setExpanded(true);
    }
  };

  return (
    <div>
      <button
        className="flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700"
        onClick={handleToggleExpand}
      >
        <Bell className="w-3 h-3" />
        {active.length} alerta{active.length !== 1 ? "s" : ""}
        <span className="text-[10px]">
          {!expanded ? "· Expandir" : expandAll ? "· Contraer" : "· Expandir"}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          {active.map(a => (
            <AlertaItem key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} forceExpand={expandAll} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentAlertasDisplay({ alertas, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent }: InlineProps) {
  const [expanded, setExpanded] = useState(false);
  const active = alertas.filter(a => !a.completada && !a.deleted);

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
            <AlertaItem key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Full alerts view for popover/dialog - shows active + historical */
export function AlertasFullView({ alertas, allAlertas, onEdit, onDelete, onComplete, onShowTree, onCreateDependent, onCreateNew }: InlineProps & { onCreateNew?: () => void }) {
  const [showHistorical, setShowHistorical] = useState(false);
  const active = alertas.filter(a => !a.completada && !a.deleted);
  const completed = alertas.filter(a => a.completada && !a.deleted);

  // Only show root-level alerts (children shown nested) - use allAlertas for tree context
  const allForTree = allAlertas || alertas;
  const activeRoots = active.filter(a => !a.parent_alerta_id || !allForTree.some(p => p.id === a.parent_alerta_id && !p.deleted));
  const completedRoots = completed.filter(a => !a.parent_alerta_id || !allForTree.some(p => p.id === a.parent_alerta_id && !p.deleted));

  return (
    <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
      {/* Active alerts */}
      {activeRoots.length > 0 ? (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Pendientes ({active.length})</span>
          {activeRoots.map(a => (
            <AlertaItem key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onComplete={onComplete} onShowTree={onShowTree} onCreateDependent={onCreateDependent} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">Sin alertas pendientes</p>
      )}

      {/* Create new */}
      {onCreateNew && (
        <button
          className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-medium"
          onClick={onCreateNew}
        >
          <Plus className="w-3.5 h-3.5" /> Nueva alerta
        </button>
      )}

      {/* Historical (completed) */}
      {completedRoots.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-medium"
            onClick={() => setShowHistorical(!showHistorical)}
          >
            <CheckCircle2 className="w-3 h-3" />
            {completed.length} completada{completed.length !== 1 ? "s" : ""}
            {showHistorical ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showHistorical && (
            <div className="mt-1.5 space-y-1.5 opacity-70">
              {completedRoots.map(a => (
                <AlertaItem key={a.id} alerta={a} allAlertas={allAlertas} onEdit={onEdit} onDelete={onDelete} onShowTree={onShowTree} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
