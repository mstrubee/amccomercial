import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronDown, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCategoriasCliente, useCreateCategoriaCliente, useUpdateCategoriaCliente, useDeleteCategoriaCliente,
  useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente,
  CategoriaCliente, ClienteWithCategoria,
} from "@/hooks/useClientes";

export default function Clientes() {
  const { data: categorias, isLoading: loadingCats } = useCategoriasCliente();
  const { data: clientes, isLoading: loadingClientes } = useClientes();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ClienteWithCategoria | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClienteWithCategoria | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);

  if (loadingCats || loadingClientes) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const filtered = (clientes || []).filter((c) => {
    const contactoMatch = (c.contactos_cliente || []).some(ct =>
      ct.contacto.toLowerCase().includes(search.toLowerCase()) ||
      ct.email.toLowerCase().includes(search.toLowerCase())
    );
    const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) || contactoMatch;
    const matchCat = filterCat === "Todas" || c.categoria_id === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = (categorias || []).map((cat) => ({
    cat,
    items: filtered.filter((c) => c.categoria_id === cat.id),
  })).filter((g) => g.items.length > 0 || filterCat === "Todas");

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Base de datos de contactos por categoría</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowCatManager(true)}>
            <Settings2 className="w-4 h-4" /> Categorías
          </Button>
          <Button className="gap-2" onClick={() => { setEditTarget(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> Nuevo Cliente
          </Button>
        </div>
      </motion.div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, contacto o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[200px] h-10">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todas">Todas las categorías</SelectItem>
            {categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {grouped.map(({ cat, items }) => {
          const isExpanded = expanded[cat.id] ?? true;
          return (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [cat.id]: !isExpanded }))}
                className="flex items-center justify-between w-full p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <h3 className="font-semibold text-card-foreground">{cat.nombre}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {items.length === 0 ? (
                      <div className="px-4 pb-4 text-sm text-muted-foreground text-center">Sin clientes en esta categoría</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-t border-border bg-secondary/20">
                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Nombre</th>
                            <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Contactos</th>
                            <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {items.map((c) => (
                            <tr key={c.id} className="hover:bg-secondary/20 transition-colors align-top">
                              <td className="px-5 py-2.5 font-medium text-card-foreground">{c.nombre}</td>
                              <td className="px-5 py-2.5">
                                {(c.contactos_cliente || []).length === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <div className="space-y-1">
                                    {c.contactos_cliente.map((ct, i) => (
                                      <div key={ct.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                                        <span className="text-card-foreground font-medium min-w-[100px]">{ct.contacto || "—"}</span>
                                        <span>{ct.email || "—"}</span>
                                        <span>{ct.telefono || "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-2.5 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTarget(c); setShowForm(true); }}>
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {grouped.length === 0 && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p>No hay clientes registrados.</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>Crear primer cliente</Button>
          </div>
        )}
      </div>

      <ClienteFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        editTarget={editTarget}
        categorias={categorias || []}
        isLoading={createCliente.isPending || updateCliente.isPending}
        onSubmit={(data) => {
          if (editTarget) {
            updateCliente.mutate({ id: editTarget.id, ...data }, { onSuccess: () => { setShowForm(false); setEditTarget(null); } });
          } else {
            createCliente.mutate(data, { onSuccess: () => setShowForm(false) });
          }
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará <strong>{deleteTarget?.nombre}</strong>. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) deleteCliente.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) }); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoriaClienteManager open={showCatManager} onOpenChange={setShowCatManager} />
    </div>
  );
}

/* ── Client Form Dialog with multiple contacts ── */
function ClienteFormDialog({ open, onOpenChange, editTarget, categorias, isLoading, onSubmit }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTarget: ClienteWithCategoria | null;
  categorias: CategoriaCliente[];
  isLoading: boolean;
  onSubmit: (data: { categoria_id: string; nombre: string; contactos: { contacto: string; email: string; telefono: string }[] }) => void;
}) {
  const [categoriaId, setCategoriaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [contactos, setContactos] = useState<{ contacto: string; email: string; telefono: string }[]>([{ contacto: "", email: "", telefono: "" }]);

  const reset = () => {
    if (editTarget) {
      setCategoriaId(editTarget.categoria_id);
      setNombre(editTarget.nombre);
      const cts = (editTarget.contactos_cliente || []).map(c => ({ contacto: c.contacto, email: c.email, telefono: c.telefono }));
      setContactos(cts.length > 0 ? cts : [{ contacto: "", email: "", telefono: "" }]);
    } else {
      setCategoriaId(categorias[0]?.id || "");
      setNombre("");
      setContactos([{ contacto: "", email: "", telefono: "" }]);
    }
  };

  const updateContacto = (idx: number, field: string, value: string) => {
    setContactos(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const addContacto = () => setContactos(prev => [...prev, { contacto: "", email: "", telefono: "" }]);
  const removeContacto = (idx: number) => setContactos(prev => prev.filter((_, i) => i !== idx));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!nombre.trim() || !categoriaId) return;
          const validContactos = contactos.filter(c => c.contacto || c.email || c.telefono);
          onSubmit({ categoria_id: categoriaId, nombre: nombre.trim(), contactos: validContactos });
        }} className="space-y-4">
          <div className="space-y-1">
            <Label>Categoría *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required
            >
              <option value="">Seleccionar...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Contactos</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addContacto}>
                <Plus className="w-3 h-3" /> Agregar contacto
              </Button>
            </div>
            {contactos.map((ct, idx) => (
              <div key={idx} className="relative rounded-lg border border-border p-3 space-y-2">
                {contactos.length > 1 && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">Contacto {idx + 1}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-destructive hover:text-destructive" onClick={() => removeContacto(idx)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <Input placeholder="Nombre contacto" value={ct.contacto} onChange={(e) => updateContacto(idx, "contacto", e.target.value)} className="h-8 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Email" type="email" value={ct.email} onChange={(e) => updateContacto(idx, "email", e.target.value)} className="h-8 text-sm" />
                  <Input placeholder="Teléfono" value={ct.telefono} onChange={(e) => updateContacto(idx, "telefono", e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Category Manager Dialog ── */
function CategoriaClienteManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: categorias } = useCategoriasCliente();
  const createCat = useCreateCategoriaCliente();
  const updateCat = useUpdateCategoriaCliente();
  const deleteCat = useDeleteCategoriaCliente();

  const [newName, setNewName] = useState("");
  const [editCat, setEditCat] = useState<CategoriaCliente | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteCatTarget, setDeleteCatTarget] = useState<CategoriaCliente | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Categorías de Clientes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {categorias?.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                {editCat?.id === cat.id ? (
                  <form className="flex items-center gap-2 flex-1" onSubmit={(e) => { e.preventDefault(); updateCat.mutate({ id: cat.id, nombre: editName }, { onSuccess: () => setEditCat(null) }); }}>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm flex-1" autoFocus />
                    <Button type="submit" size="sm" className="h-7 text-xs">Ok</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditCat(null)}>×</Button>
                  </form>
                ) : (
                  <>
                    <span className="text-sm font-medium">{cat.nombre}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditCat(cat); setEditName(cat.nombre); }}>
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => setDeleteCatTarget(cat)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return; createCat.mutate({ nombre: newName.trim(), orden: (categorias?.length || 0) + 1 }, { onSuccess: () => setNewName("") }); }}>
              <Input placeholder="Nueva categoría..." value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
              <Button type="submit" size="sm" className="h-8">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteCatTarget} onOpenChange={(v) => !v && setDeleteCatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará <strong>{deleteCatTarget?.nombre}</strong> y todos sus clientes asociados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteCatTarget) deleteCat.mutate(deleteCatTarget.id, { onSuccess: () => setDeleteCatTarget(null) }); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
