import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import MentionTextarea from "@/components/mensajeria/MentionTextarea";
import { useMentionableUsers } from "@/hooks/useMentionableUsers";
import { splitTextWithMentions } from "@/lib/mention-utils";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Check, X, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChecklistDate, formatCompletedDate, daysInMonth } from "@/lib/checklist-date-utils";
import type { ChecklistItem } from "@/hooks/useEmpresaChecklist";
import {
  useProyectoChecklistItems,
  useAddProyectoChecklistItem,
  useToggleProyectoChecklistItem,
  useUpdateProyectoChecklistItemText,
  useUpdateProyectoChecklistItemDate,
  useDeleteProyectoChecklistItem,
  useDeleteProyectoChecklistItemRecursive,
} from "@/hooks/useProyectoChecklist";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  proyectoId: string;
  readOnly?: boolean;
}

export default function ProyectoChecklistPanel({ proyectoId, readOnly }: Props) {
  const { user } = useAuth();
  const { data: items = [] } = useProyectoChecklistItems(proyectoId);
  const { data: mentionUsers = [] } = useMentionableUsers();
  const knownHandles = useMemo(() => new Set(mentionUsers.map((u) => u.handle)), [mentionUsers]);
  const myHandle = useMemo(
    () => (user?.id ? mentionUsers.find((u) => u.user_id === user.id)?.handle : undefined),
    [user?.id, mentionUsers],
  );

  const renderText = (text: string) => {
    const parts = splitTextWithMentions(text, knownHandles);
    if (parts.length === 0) return text;
    return parts.map((p, i) =>
      p.type === "mention" ? (
        <span key={i} className={cn(
          "rounded px-1 font-medium",
          myHandle && p.handle === myHandle ? "bg-primary/25 text-primary" : "bg-primary/10 text-primary",
        )}>{p.value}</span>
      ) : (
        <span key={i}>{p.value}</span>
      ),
    );
  };

  const authorIds = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.created_by) s.add(i.created_by); });
    return Array.from(s);
  }, [items]);
  const { data: authorNames } = useQuery({
    queryKey: ["checklist-authors", authorIds.sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", authorIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { if (p.display_name) map[p.user_id] = p.display_name; });
      return map;
    },
  });

  const addItem = useAddProyectoChecklistItem();
  const toggleItem = useToggleProyectoChecklistItem();
  const updateText = useUpdateProyectoChecklistItemText();
  const updateDate = useUpdateProyectoChecklistItemDate();
  const deleteItem = useDeleteProyectoChecklistItem();
  const deleteRecursive = useDeleteProyectoChecklistItemRecursive();

  const [newItemText, setNewItemText] = useState("");
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateY, setEditDateY] = useState("");
  const [editDateM, setEditDateM] = useState("");
  const [editDateD, setEditDateD] = useState("");

  const [followUpParent, setFollowUpParent] = useState<ChecklistItem | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [subItemParent, setSubItemParent] = useState<ChecklistItem | null>(null);
  const [subItemText, setSubItemText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChecklistItem | null>(null);
  const [confirmRecursive, setConfirmRecursive] = useState(false);

  const tree = useMemo(() => {
    const childrenMap: Record<string, ChecklistItem[]> = {};
    items.forEach(item => {
      const pid = item.parent_id || "root";
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(item);
    });
    return childrenMap;
  }, [items]);

  const completedCount = items.filter(i => i.is_completed).length;
  const totalCount = items.length;
  const hasChildren = (id: string) => (tree[id] || []).length > 0;

  const visibleIds = useMemo(() => {
    if (showCompleted) return null;
    const set = new Set<string>();
    const hasPending = (id: string): boolean => {
      const kids = tree[id] || [];
      let pending = false;
      kids.forEach(k => {
        const childPending = !k.is_completed || hasPending(k.id);
        if (childPending) { set.add(k.id); pending = true; }
      });
      return pending;
    };
    (tree["root"] || []).forEach(r => {
      const childHasPending = hasPending(r.id);
      if (!r.is_completed || childHasPending) set.add(r.id);
    });
    return set;
  }, [showCompleted, tree]);

  const isVisible = (id: string) => visibleIds === null || visibleIds.has(id);

  const handleAddItem = () => {
    const trimmed = newItemText.trim();
    if (!trimmed) return;
    addItem.mutate({ proyecto_id: proyectoId, text: trimmed });
    setNewItemText("");
  };

  const handleToggle = (item: ChecklistItem) => {
    if (!user) return;
    const newVal = !item.is_completed;
    toggleItem.mutate({ id: item.id, proyecto_id: proyectoId, is_completed: newVal, user_id: user.id });
    if (newVal) {
      setFollowUpParent(item);
      setFollowUpText("");
    }
  };

  const handleAddSubItem = () => {
    if (!subItemParent) return;
    const trimmed = subItemText.trim();
    if (!trimmed) return;
    addItem.mutate({ proyecto_id: proyectoId, text: trimmed, parent_id: subItemParent.id });
    setSubItemParent(null);
    setSubItemText("");
  };

  const handleFollowUp = () => {
    if (!followUpParent) return;
    const trimmed = followUpText.trim();
    if (!trimmed) { setFollowUpParent(null); return; }
    addItem.mutate({ proyecto_id: proyectoId, text: trimmed, parent_id: followUpParent.id });
    setFollowUpParent(null);
    setFollowUpText("");
  };

  const startEditText = (item: ChecklistItem) => {
    if (item.is_completed) return;
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEditText = (item: ChecklistItem) => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) {
      updateText.mutate({ id: item.id, proyecto_id: proyectoId, text: trimmed });
    }
    setEditingId(null);
  };

  const startEditDate = (item: ChecklistItem) => {
    const d = new Date(item.created_at);
    setEditingDateId(item.id);
    setEditDateY(String(d.getFullYear() % 100).padStart(2, "0"));
    setEditDateM(String(d.getMonth() + 1));
    setEditDateD(String(d.getDate()));
  };

  const saveEditDate = (item: ChecklistItem) => {
    const fullY = 2000 + parseInt(editDateY || "0");
    const mo = Math.max(1, Math.min(12, parseInt(editDateM || "1")));
    const maxD = daysInMonth(fullY, mo - 1);
    const da = Math.max(1, Math.min(maxD, parseInt(editDateD || "1")));
    const orig = new Date(item.created_at);
    const newDate = new Date(fullY, mo - 1, da, orig.getHours(), orig.getMinutes(), orig.getSeconds());
    updateDate.mutate({ id: item.id, proyecto_id: proyectoId, created_at: newDate.toISOString() });
    setEditingDateId(null);
  };

  const handleDelete = (item: ChecklistItem) => {
    setDeleteTarget(item);
    setConfirmRecursive(false);
  };

  const executeDelete = (recursive: boolean) => {
    if (!deleteTarget) return;
    if (recursive) {
      deleteRecursive.mutate({ id: deleteTarget.id, proyecto_id: proyectoId, allItems: items });
    } else {
      deleteItem.mutate({ id: deleteTarget.id, proyecto_id: proyectoId });
    }
    setDeleteTarget(null);
    setConfirmRecursive(false);
  };

  const renderItem = (item: ChecklistItem, depth: number) => {
    if (!isVisible(item.id)) return null;
    const children = tree[item.id] || [];
    const isEditing = editingId === item.id;
    const isEditingDate = editingDateId === item.id;

    return (
      <div key={item.id}>
        <div
          className="group flex items-start gap-2 py-1 px-1 rounded hover:bg-muted/50"
          style={{ paddingLeft: 8 + depth * 20 }}
        >
          <Checkbox
            checked={item.is_completed}
            onCheckedChange={() => handleToggle(item)}
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5 text-sm">
              {isEditingDate ? (
                <span className="flex items-center gap-0.5">
                  <span className="text-xs text-muted-foreground">20</span>
                  <Input className="w-8 h-6 text-xs p-0.5 text-center" value={editDateY} onChange={e => setEditDateY(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                  <span className="text-xs">.</span>
                  <Input className="w-8 h-6 text-xs p-0.5 text-center" value={editDateM} onChange={e => setEditDateM(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                  <span className="text-xs">.</span>
                  <Input className="w-8 h-6 text-xs p-0.5 text-center" value={editDateD} onChange={e => setEditDateD(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveEditDate(item)}><Check className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingDateId(null)}><X className="w-3 h-3" /></Button>
                </span>
              ) : (
                <span className="text-muted-foreground text-xs cursor-pointer shrink-0" onDoubleClick={() => startEditDate(item)}>
                  {formatChecklistDate(item.created_at)}
                </span>
              )}

              {item.created_by && authorNames?.[item.created_by] && (
                <span className="text-muted-foreground text-xs shrink-0">
                  ({authorNames[item.created_by]})
                </span>
              )}

              {isEditing ? (
                <span className="flex items-center gap-1 flex-1">
                  <MentionTextarea
                    wrapperClassName="flex-1"
                    value={editText}
                    onChange={(v) => setEditText(v)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEditText(item); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-h-[28px] h-7 py-1 text-sm resize-none"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => saveEditText(item)}><Check className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingId(null)}><X className="w-3 h-3" /></Button>
                </span>
              ) : (
                <span
                  className={cn("cursor-default", item.is_completed && "line-through text-muted-foreground")}
                  onDoubleClick={() => startEditText(item)}
                >
                  {renderText(item.text)}
                </span>
              )}

              {item.is_completed && item.completed_at && (
                <span className="text-xs text-muted-foreground">(completado el {formatCompletedDate(item.completed_at)})</span>
              )}
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <Button size="icon" variant="ghost" className="h-6 w-6" title="Agregar sub-ítem" onClick={() => { setSubItemParent(item); setSubItemText(""); }}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
              {!item.is_completed && (
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Editar" onClick={() => startEditText(item)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Eliminar" onClick={() => handleDelete(item)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
        {children.map(child => renderItem(child, depth + 1))}
      </div>
    );
  };

  const rootItems = tree["root"] || [];

  if (totalCount === 0 && readOnly) return null;

  return (
    <div className="space-y-2 w-full" onClick={(e) => e.stopPropagation()}>
      {!readOnly && (
        <div className="flex gap-1">
          <MentionTextarea
            wrapperClassName="flex-1"
            placeholder="Nueva nota — mm.dd para fecha. Ctrl+Enter para agregar. @ para mencionar."
            value={newItemText}
            onChange={(v) => setNewItemText(v)}
            onKeyDown={e => {
              if (e.key !== "Enter") return;
              e.stopPropagation();
              if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
                e.preventDefault();
                handleAddItem();
              }
            }}
            className="h-8 min-h-[32px] py-1 text-xs resize-none bg-sky-300/50 focus-visible:bg-sky-300/50"
            onClick={e => e.stopPropagation()}
          />
          <Button size="icon" variant="outline" className="shrink-0 h-8" onClick={handleAddItem} disabled={!newItemText.trim()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      )}

      {totalCount > 0 && (
        <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium hover:text-foreground transition-colors">
              <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !checklistOpen && "-rotate-90")} />
              Checklist ({completedCount}/{totalCount})
            </CollapsibleTrigger>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowCompleted(v => !v); }}
              className={cn(
                "inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/50 transition-colors",
                showCompleted ? "text-success" : "text-destructive"
              )}
              title={showCompleted ? "Ocultar ítems completados" : "Mostrar también los completados"}
              aria-label={showCompleted ? "Ocultar completados" : "Mostrar completados"}
            >
              {showCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
          <CollapsibleContent>
            <div className="mt-1 max-h-[300px] overflow-y-auto border rounded-md p-1">
              {rootItems.map(item => renderItem(item, 0))}
              {visibleIds && visibleIds.size === 0 && (
                <div className="text-xs text-muted-foreground text-center py-3">
                  No hay ítems pendientes.
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Dialog open={!!followUpParent} onOpenChange={open => { if (!open) setFollowUpParent(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear ítem de seguimiento</DialogTitle>
            <DialogDescription>Referencia: {followUpParent?.text}</DialogDescription>
          </DialogHeader>
          <MentionTextarea placeholder="Texto del sub-ítem de seguimiento..." value={followUpText} onChange={(v) => setFollowUpText(v)} className="min-h-[80px]" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFollowUpParent(null)}>Omitir</Button>
            <Button onClick={handleFollowUp} disabled={!followUpText.trim()}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subItemParent} onOpenChange={open => { if (!open) setSubItemParent(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar sub-ítem</DialogTitle>
            <DialogDescription>Padre: {subItemParent?.text}</DialogDescription>
          </DialogHeader>
          <MentionTextarea placeholder="Texto del sub-ítem..." value={subItemText} onChange={(v) => setSubItemText(v)} className="min-h-[80px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubItemParent(null)}>Cancelar</Button>
            <Button onClick={handleAddSubItem} disabled={!subItemText.trim()}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) { setDeleteTarget(null); setConfirmRecursive(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ítem</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && hasChildren(deleteTarget.id)
                ? "Este ítem tiene sub-ítems. ¿Qué deseas hacer?"
                : `¿Eliminar "${deleteTarget?.text}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setConfirmRecursive(false); }}>Cancelar</AlertDialogCancel>
            {deleteTarget && hasChildren(deleteTarget.id) ? (
              <>
                <Button variant="outline" onClick={() => executeDelete(false)}>Borrar solo la línea</Button>
                {!confirmRecursive ? (
                  <Button variant="destructive" onClick={() => setConfirmRecursive(true)}>Borrar línea y dependientes</Button>
                ) : (
                  <Button variant="destructive" onClick={() => executeDelete(true)}>⚠ Confirmar eliminación total</Button>
                )}
              </>
            ) : (
              <AlertDialogAction onClick={() => executeDelete(false)}>Eliminar</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}