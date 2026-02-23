import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pencil, Trash2, Plus, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import {
  useCategorias,
  useCreateCategoria,
  useUpdateCategoria,
  useDeleteCategoria,
  useCreateSubcategoria,
  useUpdateSubcategoria,
  useDeleteSubcategoria,
  usePromoteToCategoria,
  useDemoteToSubcategoria,
  CategoriaWithSubs,
  SubcategoriaRow,
} from "@/hooks/useCategorias";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/* ── Button config sub-form ── */
function BotonConfig({
  label, bgColor, textColor, onLabelChange, onBgChange, onTextChange, onClear,
}: {
  label: string;
  bgColor: string;
  textColor: string;
  onLabelChange: (v: string) => void;
  onBgChange: (v: string) => void;
  onTextChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2 border border-border rounded p-2 bg-background/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Botón personalizado</span>
        <button type="button" className="text-[10px] text-destructive hover:underline" onClick={onClear}>Quitar botón</button>
      </div>
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Label</Label>
          <Input value={label} onChange={(e) => onLabelChange(e.target.value)} className="h-7 text-xs" placeholder="Texto del botón..." />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fondo</Label>
          <input type="color" value={bgColor} onChange={(e) => onBgChange(e.target.value)} className="w-8 h-7 rounded border border-input cursor-pointer" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Texto</Label>
          <input type="color" value={textColor} onChange={(e) => onTextChange(e.target.value)} className="w-8 h-7 rounded border border-input cursor-pointer" />
        </div>
      </div>
      {label.trim() && (
        <div className="pt-1">
          <span className="text-[10px] text-muted-foreground mr-2">Preview:</span>
          <span className="inline-block px-3 py-1 rounded text-xs font-medium" style={{ backgroundColor: bgColor, color: textColor }}>{label}</span>
        </div>
      )}
    </div>
  );
}

export default function CategoriasManagerDialog({ open, onOpenChange }: Props) {
  const { data: categorias } = useCategorias();
  const createCat = useCreateCategoria();
  const updateCat = useUpdateCategoria();
  const deleteCat = useDeleteCategoria();
  const createSub = useCreateSubcategoria();
  const updateSub = useUpdateSubcategoria();
  const deleteSub = useDeleteSubcategoria();
  const promoteSub = usePromoteToCategoria();
  const demoteCat = useDemoteToSubcategoria();
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
  const [editCatFecha, setEditCatFecha] = useState(false);
  const [editCatBotonLabel, setEditCatBotonLabel] = useState("");
  const [editCatBotonBg, setEditCatBotonBg] = useState("#3b82f6");
  const [editCatBotonText, setEditCatBotonText] = useState("#ffffff");
  const [editCatBotonActive, setEditCatBotonActive] = useState(false);

  // New subcategory form
  const [newSubCatId, setNewSubCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState("#6b7280");
  const [newSubAdj, setNewSubAdj] = useState(false);

  // Edit subcategory form
  const [editSubName, setEditSubName] = useState("");
  const [editSubColor, setEditSubColor] = useState("");
  const [editSubAdj, setEditSubAdj] = useState(false);
  const [editSubBotonLabel, setEditSubBotonLabel] = useState("");
  const [editSubBotonBg, setEditSubBotonBg] = useState("#3b82f6");
  const [editSubBotonText, setEditSubBotonText] = useState("#ffffff");
  const [editSubBotonActive, setEditSubBotonActive] = useState(false);

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
    setEditCatFecha((cat as any).permite_fecha || false);
    const hasBoton = !!(cat as any).boton_label;
    setEditCatBotonActive(hasBoton);
    setEditCatBotonLabel((cat as any).boton_label || "");
    setEditCatBotonBg((cat as any).boton_bg_color || "#3b82f6");
    setEditCatBotonText((cat as any).boton_text_color || "#ffffff");
  };

  const handleUpdateCat = () => {
    if (!editingCat || !editCatName.trim()) return;
    updateCat.mutate({
      id: editingCat.id, nombre: editCatName.trim(), color: editCatColor, es_adjudicado: editCatAdj, permite_fecha: editCatFecha,
      boton_label: editCatBotonActive && editCatBotonLabel.trim() ? editCatBotonLabel.trim() : null,
      boton_bg_color: editCatBotonActive && editCatBotonLabel.trim() ? editCatBotonBg : null,
      boton_text_color: editCatBotonActive && editCatBotonLabel.trim() ? editCatBotonText : null,
    });
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
    const hasBoton = !!(sub as any).boton_label;
    setEditSubBotonActive(hasBoton);
    setEditSubBotonLabel((sub as any).boton_label || "");
    setEditSubBotonBg((sub as any).boton_bg_color || "#3b82f6");
    setEditSubBotonText((sub as any).boton_text_color || "#ffffff");
  };

  const handleUpdateSub = () => {
    if (!editingSub || !editSubName.trim()) return;
    updateSub.mutate({
      id: editingSub.id, nombre: editSubName.trim(), color: editSubColor, es_adjudicado: editSubAdj,
      boton_label: editSubBotonActive && editSubBotonLabel.trim() ? editSubBotonLabel.trim() : null,
      boton_bg_color: editSubBotonActive && editSubBotonLabel.trim() ? editSubBotonBg : null,
      boton_text_color: editSubBotonActive && editSubBotonLabel.trim() ? editSubBotonText : null,
    });
    setEditingSub(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Administrar Estatus (x Empresa)</DialogTitle>
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
                    <div className="flex items-center gap-2">
                      <Checkbox checked={editCatFecha} onCheckedChange={(v) => setEditCatFecha(!!v)} />
                      <span className="text-xs text-muted-foreground">Permite fecha y alerta</span>
                    </div>
                    {/* Button config */}
                    {editCatBotonActive ? (
                      <BotonConfig
                        label={editCatBotonLabel} bgColor={editCatBotonBg} textColor={editCatBotonText}
                        onLabelChange={setEditCatBotonLabel} onBgChange={setEditCatBotonBg} onTextChange={setEditCatBotonText}
                        onClear={() => { setEditCatBotonActive(false); setEditCatBotonLabel(""); }}
                      />
                    ) : (
                      <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => setEditCatBotonActive(true)}>
                        <Plus className="w-3 h-3" /> Agregar Botón
                      </button>
                    )}
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
                    {(cat as any).permite_fecha && <span className="text-[10px] font-semibold text-amber-500 uppercase">📅</span>}
                    {(cat as any).boton_label && (
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: (cat as any).boton_bg_color || "#3b82f6", color: (cat as any).boton_text_color || "#fff" }}>
                        {(cat as any).boton_label}
                      </span>
                    )}
                    {cat.subcategorias_proyecto.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{cat.subcategorias_proyecto.length} sub</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEditCat(cat)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    {cat.subcategorias_proyecto.length === 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Convertir en sub-estatus">
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(categorias || []).filter((c) => c.id !== cat.id).map((target) => (
                            <DropdownMenuItem key={target.id} onClick={() => demoteCat.mutate({ catId: cat.id, targetCatId: target.id })}>
                              <div className="w-3 h-3 rounded-full border border-border mr-2 flex-shrink-0" style={{ backgroundColor: target.color }} />
                              {target.nombre}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
                            {/* Button config for subcategory */}
                            {editSubBotonActive ? (
                              <BotonConfig
                                label={editSubBotonLabel} bgColor={editSubBotonBg} textColor={editSubBotonText}
                                onLabelChange={setEditSubBotonLabel} onBgChange={setEditSubBotonBg} onTextChange={setEditSubBotonText}
                                onClear={() => { setEditSubBotonActive(false); setEditSubBotonLabel(""); }}
                              />
                            ) : (
                              <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => setEditSubBotonActive(true)}>
                                <Plus className="w-3 h-3" /> Agregar Botón
                              </button>
                            )}
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
                            {(sub as any).boton_label && (
                              <span className="inline-block px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: (sub as any).boton_bg_color || "#3b82f6", color: (sub as any).boton_text_color || "#fff" }}>
                                {(sub as any).boton_label}
                              </span>
                            )}
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEditSub(sub)}>
                              <Pencil className="w-2.5 h-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" title="Promover a estatus" onClick={() => promoteSub.mutate(sub.id)}>
                              <ArrowUp className="w-2.5 h-2.5" />
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
                            <Label className="text-xs">Nuevo sub-estatus</Label>
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
                        onClick={() => { setNewSubCatId(cat.id); setNewSubColor(cat.color); }}
                      >
                        <Plus className="w-3 h-3" /> Agregar sub-estatus
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add new category */}
            <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-medium">Nuevo estatus</Label>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="h-8 text-sm" placeholder="Nombre del estatus..." />
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
