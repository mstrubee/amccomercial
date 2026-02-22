import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import {
  useClasificacionesAlerta,
  useCreateClasificacion,
  useUpdateClasificacion,
  useDeleteClasificacion,
  useCreateSubclasificacion,
  useUpdateSubclasificacion,
  useDeleteSubclasificacion,
  useReorderClasificaciones,
  useReorderSubclasificaciones,
  ClasificacionAlerta,
} from "@/hooks/useClasificacionesAlerta";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

function SortableSubItem({
  s,
  editSubId,
  editSubName,
  setEditSubId,
  setEditSubName,
  handleUpdateSub,
  deleteSub,
}: {
  s: { id: string; nombre: string };
  editSubId: string | null;
  editSubName: string;
  setEditSubId: (id: string | null) => void;
  setEditSubName: (n: string) => void;
  handleUpdateSub: (id: string) => void;
  deleteSub: { mutate: (id: string) => void };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-1", isDragging && "opacity-50")}
    >
      <button {...attributes} {...listeners} className="cursor-grab shrink-0 text-muted-foreground hover:text-foreground">
        <GripVertical className="w-3 h-3" />
      </button>
      {editSubId === s.id ? (
        <div className="flex gap-1 flex-1">
          <Input value={editSubName} onChange={(e) => setEditSubName(e.target.value)} className="h-7 text-sm" onKeyDown={(e) => e.key === "Enter" && handleUpdateSub(s.id)} />
          <Button size="sm" variant="outline" className="h-7" onClick={() => handleUpdateSub(s.id)}>OK</Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditSubId(null)}>✕</Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm text-muted-foreground">• {s.nombre}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditSubId(s.id); setEditSubName(s.nombre); }}>
            <Pencil className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteSub.mutate(s.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </>
      )}
    </div>
  );
}

function SortableClasifItem({
  c,
  expanded,
  setExpanded,
  editId,
  editName,
  setEditId,
  setEditName,
  handleUpdate,
  deleteClasif,
  editSubId,
  editSubName,
  setEditSubId,
  setEditSubName,
  handleUpdateSub,
  handleCreateSub,
  newSubName,
  setNewSubName,
  deleteSub,
  createSub,
  reorderSubs,
}: {
  c: ClasificacionAlerta;
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  editId: string | null;
  editName: string;
  setEditId: (id: string | null) => void;
  setEditName: (n: string) => void;
  handleUpdate: (id: string) => void;
  deleteClasif: { mutate: (id: string) => void };
  editSubId: string | null;
  editSubName: string;
  setEditSubId: (id: string | null) => void;
  setEditSubName: (n: string) => void;
  handleUpdateSub: (id: string) => void;
  handleCreateSub: (clasificacionId: string) => void;
  newSubName: Record<string, string>;
  setNewSubName: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  deleteSub: { mutate: (id: string) => void };
  createSub: any;
  reorderSubs: { mutate: (items: { id: string; orden: number }[]) => void };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleSubDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = c.subclasificaciones.findIndex(s => s.id === active.id);
    const newIndex = c.subclasificaciones.findIndex(s => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(c.subclasificaciones, oldIndex, newIndex);
    reorderSubs.mutate(reordered.map((s, i) => ({ id: s.id, orden: i + 1 })));
  };

  return (
    <Collapsible open={expanded[c.id]} onOpenChange={(v) => setExpanded(prev => ({ ...prev, [c.id]: v }))}>
      <div ref={setNodeRef} style={style} className={cn("border border-border rounded-lg", isDragging && "opacity-50")}>
        <div className="flex items-center gap-2 px-3 py-2">
          <button {...attributes} {...listeners} className="cursor-grab shrink-0 text-muted-foreground hover:text-foreground">
            <GripVertical className="w-4 h-4" />
          </button>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              {expanded[c.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          {editId === c.id ? (
            <div className="flex gap-1 flex-1">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" onKeyDown={(e) => e.key === "Enter" && handleUpdate(c.id)} />
              <Button size="sm" variant="outline" className="h-7" onClick={() => handleUpdate(c.id)}>OK</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditId(null)}>✕</Button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-sm font-medium">{c.nombre}</span>
              <span className="text-xs text-muted-foreground">{c.subclasificaciones.length} sub</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditId(c.id); setEditName(c.nombre); }}>
                <Pencil className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteClasif.mutate(c.id)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-2 pl-10 space-y-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubDragEnd}>
              <SortableContext items={c.subclasificaciones.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {c.subclasificaciones.map((s) => (
                  <SortableSubItem
                    key={s.id}
                    s={s}
                    editSubId={editSubId}
                    editSubName={editSubName}
                    setEditSubId={setEditSubId}
                    setEditSubName={setEditSubName}
                    handleUpdateSub={handleUpdateSub}
                    deleteSub={deleteSub}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div className="flex gap-1">
              <Input
                value={newSubName[c.id] || ""}
                onChange={(e) => setNewSubName(prev => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Nueva sub-clasificación..."
                className="h-7 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreateSub(c.id)}
              />
              <Button size="sm" variant="outline" className="h-7" onClick={() => handleCreateSub(c.id)} disabled={!newSubName[c.id]?.trim()}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function ClasificacionesAlertaDialog({ open, onClose }: Props) {
  const { data: clasificaciones } = useClasificacionesAlerta();
  const createClasif = useCreateClasificacion();
  const updateClasif = useUpdateClasificacion();
  const deleteClasif = useDeleteClasificacion();
  const createSub = useCreateSubclasificacion();
  const updateSub = useUpdateSubclasificacion();
  const deleteSub = useDeleteSubclasificacion();
  const reorderClasifs = useReorderClasificaciones();
  const reorderSubs = useReorderSubclasificaciones();

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleCreate = () => {
    if (!newName.trim()) return;
    createClasif.mutate({ nombre: newName.trim(), orden: (clasificaciones?.length || 0) + 1 });
    setNewName("");
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    updateClasif.mutate({ id, nombre: editName.trim() });
    setEditId(null);
  };

  const handleCreateSub = (clasificacionId: string) => {
    const name = newSubName[clasificacionId]?.trim();
    if (!name) return;
    const parent = clasificaciones?.find(c => c.id === clasificacionId);
    createSub.mutate({ clasificacion_id: clasificacionId, nombre: name, orden: (parent?.subclasificaciones.length || 0) + 1 });
    setNewSubName(prev => ({ ...prev, [clasificacionId]: "" }));
  };

  const handleUpdateSub = (id: string) => {
    if (!editSubName.trim()) return;
    updateSub.mutate({ id, nombre: editSubName.trim() });
    setEditSubId(null);
  };

  const handleClasifDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !clasificaciones) return;
    const oldIndex = clasificaciones.findIndex(c => c.id === active.id);
    const newIndex = clasificaciones.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(clasificaciones, oldIndex, newIndex);
    reorderClasifs.mutate(reordered.map((c, i) => ({ id: c.id, orden: i + 1 })));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clasificaciones de Alertas</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva clasificación..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* List */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleClasifDragEnd}>
            <SortableContext items={clasificaciones?.map(c => c.id) || []} strategy={verticalListSortingStrategy}>
              {clasificaciones?.map((c) => (
                <SortableClasifItem
                  key={c.id}
                  c={c}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  editId={editId}
                  editName={editName}
                  setEditId={setEditId}
                  setEditName={setEditName}
                  handleUpdate={handleUpdate}
                  deleteClasif={deleteClasif}
                  editSubId={editSubId}
                  editSubName={editSubName}
                  setEditSubId={setEditSubId}
                  setEditSubName={setEditSubName}
                  handleUpdateSub={handleUpdateSub}
                  handleCreateSub={handleCreateSub}
                  newSubName={newSubName}
                  setNewSubName={setNewSubName}
                  deleteSub={deleteSub}
                  createSub={createSub}
                  reorderSubs={reorderSubs}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </DialogContent>
    </Dialog>
  );
}
