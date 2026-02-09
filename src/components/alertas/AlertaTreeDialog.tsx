import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllAlertas, useRestoreAlerta, AlertaWithRelations } from "@/hooks/useAlertas";
import { GitBranch, RotateCcw, CheckCircle2, Circle, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When set, show tree rooted at this alert */
  rootAlertaId?: string | null;
}

interface TreeNode {
  alerta: AlertaWithRelations & { _profilesMap: Record<string, { display_name: string; email: string }> };
  children: TreeNode[];
}

function buildTree(
  alertas: (AlertaWithRelations & { _profilesMap: Record<string, { display_name: string; email: string }> })[],
  rootId?: string | null
): TreeNode[] {
  const byParent = new Map<string | null, typeof alertas>();
  alertas.forEach(a => {
    const key = a.parent_alerta_id || "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(a);
  });

  function build(parentId: string | null): TreeNode[] {
    const children = byParent.get(parentId || "__root__") || [];
    return children.map(a => ({
      alerta: a,
      children: build(a.id),
    }));
  }

  if (rootId) {
    const root = alertas.find(a => a.id === rootId);
    if (root) {
      // Walk up to find the chain root
      let current = root;
      while (current.parent_alerta_id) {
        const parent = alertas.find(a => a.id === current.parent_alerta_id);
        if (!parent) break;
        current = parent;
      }
      return [{
        alerta: current,
        children: build(current.id),
      }];
    }
  }

  return build(null);
}

function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const a = node.alerta;
  const pm = a._profilesMap;
  const hasChildren = node.children.length > 0;

  const getProfileName = (uid: string | null) => {
    if (!uid) return null;
    const p = pm[uid];
    return p ? (p.display_name || p.email) : null;
  };

  return (
    <div className={cn("relative", depth > 0 && "ml-5 border-l border-border pl-3")}>
      <div className={cn(
        "rounded-lg border px-3 py-2 text-xs mb-2",
        a.deleted ? "border-destructive/30 bg-destructive/5 opacity-70" :
        a.completada ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20" :
        "border-border bg-card"
      )}>
        <div className="flex items-start gap-2">
          {hasChildren && (
            <button onClick={() => setExpanded(!expanded)} className="mt-0.5 shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {a.deleted ? (
                <Trash2 className="w-3 h-3 text-destructive shrink-0" />
              ) : a.completada ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
              {a.titulo && <span className="font-semibold text-amber-700">{a.titulo}</span>}
              <span className={cn("truncate", a.completada && "line-through text-muted-foreground", a.deleted && "line-through text-destructive/60")}>{a.texto}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
              <span>📅 {format(parseLocalDate(a.fecha_seguimiento), "dd MMM yyyy", { locale: es })}</span>
              <span>👤 {a.responsable_profile?.display_name || a.responsable_profile?.email || "—"}</span>
              <span>Creada: {format(new Date(a.created_at), "dd/MM/yy HH:mm")} por {getProfileName(a.created_by) || "—"}</span>
              {a.updated_by && <span>Editada por {getProfileName(a.updated_by)}</span>}
              {a.completada && a.completed_by && (
                <span className="text-emerald-700">
                  ✓ Completada: {a.completed_at ? format(new Date(a.completed_at), "dd/MM/yy HH:mm") : ""} por {getProfileName(a.completed_by)}
                </span>
              )}
              {a.deleted && a.deleted_by && (
                <span className="text-destructive">
                  🗑 Eliminada: {a.deleted_at ? format(new Date(a.deleted_at), "dd/MM/yy HH:mm") : ""} por {getProfileName(a.deleted_by)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeView key={child.alerta.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlertaTreeDialog({ open, onClose, rootAlertaId }: Props) {
  const { data: allAlertas, isLoading } = useAllAlertas();

  const tree = useMemo(() => {
    if (!allAlertas) return [];
    return buildTree(allAlertas, rootAlertaId);
  }, [allAlertas, rootAlertaId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Árbol de Alertas
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Historial de seguimiento y dependencias entre alertas</p>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6 pb-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Cargando...</div>
          ) : tree.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No hay alertas con dependencias</div>
          ) : (
            <div className="space-y-2">
              {tree.map(node => (
                <TreeNodeView key={node.alerta.id} node={node} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
