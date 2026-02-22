import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  useClasificacionesAlerta,
  useCreateClasificacion,
  useUpdateClasificacion,
  useDeleteClasificacion,
  useCreateSubclasificacion,
  useUpdateSubclasificacion,
  useDeleteSubclasificacion,
  ClasificacionAlerta,
} from "@/hooks/useClasificacionesAlerta";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ClasificacionesAlertaDialog({ open, onClose }: Props) {
  const { data: clasificaciones } = useClasificacionesAlerta();
  const createClasif = useCreateClasificacion();
  const updateClasif = useUpdateClasificacion();
  const deleteClasif = useDeleteClasificacion();
  const createSub = useCreateSubclasificacion();
  const updateSub = useUpdateSubclasificacion();
  const deleteSub = useDeleteSubclasificacion();

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
          {clasificaciones?.map((c) => (
            <Collapsible key={c.id} open={expanded[c.id]} onOpenChange={(v) => setExpanded(prev => ({ ...prev, [c.id]: v }))}>
              <div className="border border-border rounded-lg">
                <div className="flex items-center gap-2 px-3 py-2">
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
                    {c.subclasificaciones.map((s) => (
                      <div key={s.id} className="flex items-center gap-1">
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
                    ))}
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
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
