import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import {
  useCategorias,
  useCreateCategoria,
  useUpdateCategoria,
  useDeleteCategoria,
  useCreateSubcategoria,
  useUpdateSubcategoria,
  useDeleteSubcategoria,
  CategoriaWithSubs,
  SubcategoriaRow,
} from "@/hooks/useCategorias";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CategoriasManagerDialog({ open, onOpenChange }: Props) {
  const { data: categorias } = useCategorias();
  const createCat = useCreateCategoria();
  const updateCat = useUpdateCategoria();
  const deleteCat = useDeleteCategoria();
  const createSub = useCreateSubcategoria();
  const updateSub = useUpdateSubcategoria();
  const deleteSub = useDeleteSubcategoria();

  const [editingCat, setEditingCat] = useState<CategoriaWithSubs | null>(null);
  const [editingSub, setEditingSub] = useState<SubcategoriaRow | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // New category form
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6b7280");
  const [newCatAdj, setNewCatAdj] = useState(false);

  // Edit category form
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState("");
  const [editCatAdj, setEditCatAdj] = useState(false);

  // New subcategory form
  const [newSubCatId, setNewSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState("#6b7280");
  const [newSubAdj, setNewSubAdj] = useState(false);

  // Edit subcategory form
  const [editSubName, setEditSubName] = useState("");
  const [editSubColor, setEditSubColor] = useState("");
  const [editSubAdj, setEditSubAdj] = useState(false);

  const handleCreateCat = () => {
    if (!newCatName.trim()) return;
    const maxOrden = (categorias || []).reduce((max, c) => Math.max(max, c.orden), 0);
    createCat.mutate({ nombre: newCatName.trim(), color: newCatColor, orden: maxOrden + 1, es_adjudicado: newCatAdj });
    setNewCatName("");
    setNewCatColor("#6b7280");
    setNewCatAdj(false);
  };

  const startEditCat = (cat: CategoriaWithSubs) => {
    setEditingCat(cat);
    setEditCatName(cat.nombre);
    setEditCatColor(cat.color);
    setEditCatAdj(cat.es_adjudicado);
  };

  const handleUpdateCat = () => {
    if (!editingCat || !editCatName.trim()) return;
    updateCat.mutate({ id: editingCat.id, nombre: editCatName.trim(), color: editCatColor, es_adjudicado: editCatAdj });
    setEditingCat(null);
  };

  const handleCreateSub = (catId: string) => {
    if (!newSubName.trim()) return;
    const cat = categorias?.find((c) => c.id === catId);
    const maxOrden = (cat?.subcategorias_proyecto || []).reduce((max, s) => Math.max(max, s.orden), 0);
    createSub.mutate({ categoria_id: catId, nombre: newSubName.trim(), color: newSubColor, orden: maxOrden + 1, es_adjudicado: newSubAdj });
    setNewSubName("");
    setNewSubColor("#6b7280");
    setNewSubAdj(false);
    setNewSubCatId(null);
  };

  const startEditSub = (sub: SubcategoriaRow) => {
    setEditingSub(sub);
    setEditSubName(sub.nombre);
    setEditSubColor(sub.color);
    setEditSubAdj(sub.es_adjudicado);
  };

  const handleUpdateSub = () => {
    if (!editingSub || !editSubName.trim()) return;
    updateSub.mutate({ id: editingSub.id, nombre: editSubName.trim(), color: editSubColor, es_adjudicado: editSubAdj });
    setEditingSub(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Administrar Categorías</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6 pb-6">
          <div className="space-y-3">
            {/* Existing categories */}
            {(categorias || []).map((cat) => (
              <div key={cat.id} className="border border-border rounded-lg overflow-hidden">
                {editingCat?.id === cat.id ? (
                  <div className="p-3 space-y-2 bg-secondary/30">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Nombre</Label>
                        <Input value={editCatName} onChange={(e) => setEditCatName(e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Color</Label>
                        <input type="color" value={editCatColor} onChange={(e) => setEditCatColor(e.target.value)} className="w-10 h-8 rounded border border-input cursor-pointer" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={editCatAdj} onCheckedChange={(v) => setEditCatAdj(!!v)} />
                      <span className="text-xs text-muted-foreground">Marca como adjudicado</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdateCat}>Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-card">
                    <button
                      className="p-0.5"
                      onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}
                    >
                      {expandedCat === cat.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-medium text-card-foreground flex-1">{cat.nombre}</span>
                    {cat.es_adjudicado && <span className="text-[10px] font-semibold text-success uppercase">Adj.</span>}
                    {cat.subcategorias_proyecto.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{cat.subcategorias_proyecto.length} sub</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditCat(cat)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => deleteCat.mutate(cat.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Subcategories */}
                {expandedCat === cat.id && (
                  <div className="bg-secondary/20 border-t border-border">
                    {cat.subcategorias_proyecto.map((sub) => (
                      <div key={sub.id}>
                        {editingSub?.id === sub.id ? (
                          <div className="p-3 space-y-2 ml-6 border-b border-border">
                            <div className="flex gap-2 items-end">
                              <div className="flex-1 space-y-1">
                                <Label className="text-xs">Nombre</Label>
                                <Input value={editSubName} onChange={(e) => setEditSubName(e.target.value)} className="h-8 text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Color</Label>
                                <input type="color" value={editSubColor} onChange={(e) => setEditSubColor(e.target.value)} className="w-10 h-8 rounded border border-input cursor-pointer" />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={editSubAdj} onCheckedChange={(v) => setEditSubAdj(!!v)} />
                              <span className="text-xs text-muted-foreground">Marca como adjudicado</span>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleUpdateSub}>Guardar</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingSub(null)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 ml-6 border-b border-border last:border-b-0">
                            <div className="w-3 h-3 rounded-full border border-border flex-shrink-0" style={{ backgroundColor: sub.color }} />
                            <span className="text-xs text-card-foreground flex-1">{sub.nombre}</span>
                            {sub.es_adjudicado && <span className="text-[9px] font-semibold text-success uppercase">Adj.</span>}
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEditSub(sub)}>
                              <Pencil className="w-2.5 h-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => deleteSub.mutate(sub.id)}>
                              <Trash2 className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add subcategory */}
                    {newSubCatId === cat.id ? (
                      <div className="p-3 ml-6 space-y-2">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Nueva subcategoría</Label>
                            <Input value={newSubName} onChange={(e) => setNewSubName(e.target.value)} className="h-8 text-sm" placeholder="Nombre..." />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Color</Label>
                            <input type="color" value={newSubColor} onChange={(e) => setNewSubColor(e.target.value)} className="w-10 h-8 rounded border border-input cursor-pointer" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={newSubAdj} onCheckedChange={(v) => setNewSubAdj(!!v)} />
                          <span className="text-xs text-muted-foreground">Marca como adjudicado</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleCreateSub(cat.id)}>Crear</Button>
                          <Button size="sm" variant="ghost" onClick={() => setNewSubCatId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 px-3 py-2 ml-6 text-xs text-muted-foreground hover:text-card-foreground"
                        onClick={() => setNewSubCatId(cat.id)}
                      >
                        <Plus className="w-3 h-3" /> Agregar subcategoría
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add new category */}
            <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-medium">Nueva categoría</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="h-8 text-sm" placeholder="Nombre de la categoría..." />
                </div>
                <input type="color" value={newCatColor} onChange={(e) => setNewCatColor(e.target.value)} className="w-10 h-8 rounded border border-input cursor-pointer" />
                <Button size="sm" onClick={handleCreateCat} disabled={!newCatName.trim()}>
                  <Plus className="w-3 h-3 mr-1" /> Crear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={newCatAdj} onCheckedChange={(v) => setNewCatAdj(!!v)} />
                <span className="text-xs text-muted-foreground">Marca como adjudicado</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
