import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronDown, ChevronRight, Settings2, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCategoriasCliente, useCreateCategoriaCliente, useUpdateCategoriaCliente, useDeleteCategoriaCliente,
  useClientes, useCreateCliente, useUpdateCliente, useDeleteCliente,
  CategoriaCliente, ClienteWithCategoria,
} from "@/hooks/useClientes";
import { useCaptadores, useCreateCaptador, useUpdateCaptador, useDeleteCaptador, CaptadorWithCategoria } from "@/hooks/useCaptadores";
import { useAuth } from "@/hooks/useAuth";
import ClienteDetailDialog from "@/components/clientes/ClienteDetailDialog";

export default function Clientes() {
  const { data: categorias, isLoading: loadingCats } = useCategoriasCliente();
  const { data: clientes, isLoading: loadingClientes } = useClientes();
  const { data: captadores, isLoading: loadingCaptadores } = useCaptadores();
  const createCliente = useCreateCliente();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();
  const createCaptador = useCreateCaptador();
  const deleteCaptador = useDeleteCaptador();
  const { isAdmin, roles } = useAuth();

  const isUsuarioTipo1 = roles.includes("usuario_tipo_1");
  const canEdit = isAdmin || isUsuarioTipo1;
  const canDelete = isAdmin;

  const [activeTab, setActiveTab] = useState("clientes");

  if (loadingCats || loadingClientes || loadingCaptadores) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clientes y Captadores</h1>
          <p className="text-muted-foreground mt-1">Base de datos de contactos por categoría</p>
        </div>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="captadores">Captadores</TabsTrigger>
        </TabsList>
        <TabsContent value="clientes" className="mt-4">
          <ClientesTab
            categorias={categorias || []}
            clientes={clientes || []}
            canEdit={canEdit}
            canDelete={canDelete}
            isAdmin={isAdmin}
            onCreate={(data) => createCliente.mutateAsync(data)}
            onDelete={(id) => deleteCliente.mutateAsync(id)}
            createPending={createCliente.isPending}
          />
        </TabsContent>
        <TabsContent value="captadores" className="mt-4">
          <CaptadoresTab
            categorias={categorias || []}
            captadores={captadores || []}
            canEdit={canEdit}
            canDelete={canDelete}
            isAdmin={isAdmin}
            onCreate={(data) => createCaptador.mutateAsync(data)}
            onDelete={(id) => deleteCaptador.mutateAsync(id)}
            createPending={createCaptador.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Clientes Tab ── */
function ClientesTab({ categorias, clientes, canEdit, canDelete, isAdmin, onCreate, onDelete, createPending }: {
  categorias: CategoriaCliente[];
  clientes: ClienteWithCategoria[];
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  onCreate: (data: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  createPending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClienteWithCategoria | null>(null);
  const [showCatManager, setShowCatManager] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ClienteWithCategoria | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-open the client dialog when returning from Proyectos via the back button
  useEffect(() => {
    const openId = (location.state as any)?.openClienteId as string | undefined;
    if (!openId || !clientes.length) return;
    const target = clientes.find(c => c.id === openId);
    if (target) {
      setDetailTarget(target);
      // Clear the state so it doesn't re-open on further navigations
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, clientes]);

  const filtered = (() => {
    // Deduplicate by name within each category — same person can appear twice
    // if two DB records share the same nombre (e.g. created from both Clientes
    // page and project form without checking for existing).
    const seen = new Map<string, boolean>(); // "categoriaId|nombreLower" → seen
    return clientes.filter((c) => {
      const key = `${c.categoria_id}|${c.nombre.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      const contactoMatch = (c.contactos_cliente || []).some(ct =>
        ct.contacto.toLowerCase().includes(search.toLowerCase()) ||
        ct.email.toLowerCase().includes(search.toLowerCase())
      );
      const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) || contactoMatch;
      const matchCat = filterCat === "Todas" || c.categoria_id === filterCat;
      return matchSearch && matchCat;
    });
  })();

  const grouped = categorias.map((cat) => ({
    cat,
    items: filtered.filter((c) => c.categoria_id === cat.id),
  })).filter((g) => g.items.length > 0 || filterCat === "Todas");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, contacto o email..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  const matchingCatIds: Record<string, boolean> = {};
                  clientes.forEach((c) => {
                    const contactoMatch = (c.contactos_cliente || []).some(ct =>
                      ct.contacto.toLowerCase().includes(search.toLowerCase()) || ct.email.toLowerCase().includes(search.toLowerCase())
                    );
                    if (c.nombre.toLowerCase().includes(search.toLowerCase()) || contactoMatch) matchingCatIds[c.categoria_id] = true;
                  });
                  setExpanded(matchingCatIds);
                }
              }} className="pl-9" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[200px] h-10"><SelectValue placeholder="Categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las categorías</SelectItem>
              {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 ml-3">
          {isAdmin && (
            <Button variant="outline" className="gap-2" onClick={() => setShowCatManager(true)}>
              <Settings2 className="w-4 h-4" /> Categorías
            </Button>
          )}
          {canEdit && (
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> Nuevo Cliente
            </Button>
          )}
        </div>
      </div>

      <ContactListView grouped={grouped} expanded={expanded} setExpanded={setExpanded} canDelete={canDelete} onDetail={setDetailTarget} onDelete={setDeleteTarget} entityLabel="clientes" />

      <ClienteDetailDialog open={!!detailTarget} onOpenChange={(v) => !v && setDetailTarget(null)} cliente={detailTarget} categorias={categorias} canEdit={canEdit} canDelete={canDelete} />

      <ClienteFormDialog open={showForm} onOpenChange={setShowForm} categorias={categorias} isLoading={createPending} onSubmit={(data) => { onCreate(data).then(() => setShowForm(false)); }} entityLabel="Cliente" />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará <strong>{deleteTarget?.nombre}</strong> y todos sus contactos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) onDelete(deleteTarget.id).then(() => setDeleteTarget(null)); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isAdmin && <CategoriaClienteManager open={showCatManager} onOpenChange={setShowCatManager} />}
    </div>
  );
}

/* ── Captadores Tab ── */
function CaptadoresTab({ categorias, captadores, canEdit, canDelete, isAdmin, onCreate, onDelete, createPending }: {
  categorias: CategoriaCliente[];
  captadores: CaptadorWithCategoria[];
  canEdit: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  onCreate: (data: any) => Promise<any>;
  onDelete: (id: string) => Promise<any>;
  createPending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CaptadorWithCategoria | null>(null);
  const [detailTarget, setDetailTarget] = useState<CaptadorWithCategoria | null>(null);
  const updateCaptador = useUpdateCaptador();

  const filtered = captadores.filter((c) => {
    const contactoMatch = (c.contactos_captador || []).some(ct =>
      ct.contacto.toLowerCase().includes(search.toLowerCase()) || ct.email.toLowerCase().includes(search.toLowerCase())
    );
    return c.nombre.toLowerCase().includes(search.toLowerCase()) || contactoMatch;
  });

  // Group by categorias_cliente
  const grouped = categorias.map((cat) => ({
    cat,
    items: filtered.filter((c) => c.categoria_id === cat.id),
  })).filter((g) => g.items.length > 0);

  // If no category matches, show all under a "Captadores" group
  const hasGrouped = grouped.some(g => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar captador..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canEdit && (
          <Button className="gap-2 ml-3" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Nuevo Captador
          </Button>
        )}
      </div>

      {/* Simple list for captadores */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>No hay captadores registrados.</p>
            {canEdit && <Button variant="outline" className="mt-4" onClick={() => setShowForm(true)}>Crear primer captador</Button>}
          </div>
        ) : (
          <motion.div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Nombre</th>
                  <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Contactos</th>
                  {canDelete && <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors align-top cursor-pointer" onClick={() => setDetailTarget(c)}>
                    <td className="px-5 py-2.5 font-medium text-card-foreground">{c.nombre}</td>
                    <td className="px-5 py-2.5">
                      {(c.contactos_captador || []).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1.5">
                          {c.contactos_captador.map((ct) => (
                            <div key={ct.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
                              <span className="flex items-center gap-1 text-card-foreground font-medium"><User className="w-3 h-3 text-muted-foreground" />{ct.contacto || "—"}</span>
                              <span className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{ct.email || "—"}</span>
                              <span className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{ct.telefono || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    {canDelete && (
                      <td className="px-5 py-2.5 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>

      {/* Captador detail dialog (reusing same pattern as cliente) */}
      <CaptadorDetailDialog open={!!detailTarget} onOpenChange={(v) => !v && setDetailTarget(null)} captador={detailTarget} canEdit={canEdit} canDelete={canDelete} />

      <ClienteFormDialog open={showForm} onOpenChange={setShowForm} categorias={categorias} isLoading={createPending} onSubmit={(data) => { onCreate(data).then(() => setShowForm(false)); }} entityLabel="Captador" hideCategoryPicker />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar captador?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará <strong>{deleteTarget?.nombre}</strong> y todos sus contactos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteTarget) onDelete(deleteTarget.id).then(() => setDeleteTarget(null)); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ── Shared Contact List View ── */
function ContactListView({ grouped, expanded, setExpanded, canDelete, onDetail, onDelete, entityLabel }: {
  grouped: { cat: CategoriaCliente; items: (ClienteWithCategoria | CaptadorWithCategoria)[] }[];
  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  canDelete: boolean;
  onDetail: (item: any) => void;
  onDelete: (item: any) => void;
  entityLabel: string;
}) {
  return (
    <div className="space-y-3">
      {grouped.map(({ cat, items }) => {
        const isExpanded = expanded[cat.id] ?? false;
        return (
          <motion.div key={cat.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <button onClick={() => setExpanded((prev) => ({ ...prev, [cat.id]: !isExpanded }))} className="flex items-center justify-between w-full p-4 text-left hover:bg-secondary/30 transition-colors">
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
                    <div className="px-4 pb-4 text-sm text-muted-foreground text-center">Sin {entityLabel} en esta categoría</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-border bg-secondary/20">
                          <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Nombre</th>
                          <th className="text-left px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Contactos</th>
                          {canDelete && <th className="text-right px-5 py-2 text-xs font-medium text-muted-foreground uppercase">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((c: any) => {
                          const contacts = c.contactos_cliente || c.contactos_captador || [];
                          return (
                            <tr key={c.id} className="hover:bg-secondary/20 transition-colors align-top cursor-pointer" onClick={() => onDetail(c)}>
                              <td className="px-5 py-2.5 font-medium text-card-foreground">{c.nombre}</td>
                              <td className="px-5 py-2.5">
                                {contacts.length === 0 ? (
                                  <span className="text-muted-foreground">—</span>
                                ) : (
                                  <div className="space-y-1.5">
                                    {contacts.map((ct: any) => (
                                      <div key={ct.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
                                        <span className="flex items-center gap-1 text-card-foreground font-medium"><User className="w-3 h-3 text-muted-foreground" />{ct.contacto || "—"}</span>
                                        <span className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{ct.email || "—"}</span>
                                        <span className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{ct.telefono || "—"}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                              {canDelete && (
                                <td className="px-5 py-2.5 text-right">
                                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(c)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
      {grouped.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p>No hay registros.</p>
        </div>
      )}
    </div>
  );
}

/* ── Captador Detail Dialog ── */
function CaptadorDetailDialog({ open, onOpenChange, captador, canEdit, canDelete }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  captador: CaptadorWithCategoria | null;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const updateCaptador = useUpdateCaptador();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState("");
  const [contactos, setContactos] = useState<{ id?: string; contacto: string; email: string; telefono: string }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const resetForm = () => {
    if (!captador) return;
    setNombre(captador.nombre);
    setContactos((captador.contactos_captador || []).map(c => ({ id: c.id, contacto: c.contacto, email: c.email, telefono: c.telefono })));
    setHasChanges(false);
    setEditing(false);
  };

  useState(() => { if (captador) resetForm(); });

  if (!captador) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(false); onOpenChange(false); } else onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>{editing ? "Editar Captador" : "Detalle de Captador"}</span>
            {canEdit && !editing && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { resetForm(); setEditing(true); }}>Editar</Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</Label>
            {editing ? (
              <Input value={nombre} onChange={(e) => { setNombre(e.target.value); setHasChanges(true); }} />
            ) : (
              <p className="text-base font-semibold text-card-foreground">{captador.nombre}</p>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Contactos</Label>
              {editing && (
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setContactos(prev => [...prev, { contacto: "", email: "", telefono: "" }]); setHasChanges(true); }}>
                  <Plus className="w-3 h-3" /> Agregar
                </Button>
              )}
            </div>
            {contactos.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin contactos</p>}
            {contactos.map((ct, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                {editing ? (
                  <>
                    <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><Input placeholder="Nombre" value={ct.contacto} onChange={(e) => { setContactos(prev => prev.map((c, i) => i === idx ? { ...c, contacto: e.target.value } : c)); setHasChanges(true); }} className="h-8 text-sm" /></div>
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><Input placeholder="Email" value={ct.email} onChange={(e) => { setContactos(prev => prev.map((c, i) => i === idx ? { ...c, email: e.target.value } : c)); setHasChanges(true); }} className="h-8 text-sm" /></div>
                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><Input placeholder="Teléfono" value={ct.telefono} onChange={(e) => { setContactos(prev => prev.map((c, i) => i === idx ? { ...c, telefono: e.target.value } : c)); setHasChanges(true); }} className="h-8 text-sm" /></div>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm font-medium text-card-foreground">{ct.contacto || "—"}</span></div>
                    <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground">{ct.email || "—"}</span></div>
                    <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-sm text-muted-foreground">{ct.telefono || "—"}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {editing && (
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={resetForm}>Descartar</Button>
              <Button onClick={() => {
                if (!captador || !nombre.trim()) return;
                updateCaptador.mutate({ id: captador.id, categoria_id: captador.categoria_id, nombre: nombre.trim(), contactos }, {
                  onSuccess: () => { setHasChanges(false); setEditing(false); },
                });
              }} disabled={updateCaptador.isPending}>{updateCaptador.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Generic Form Dialog (create) ── */
function ClienteFormDialog({ open, onOpenChange, categorias, isLoading, onSubmit, entityLabel, hideCategoryPicker }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categorias: CategoriaCliente[];
  isLoading: boolean;
  onSubmit: (data: { categoria_id: string; nombre: string; contactos: { contacto: string; email: string; telefono: string }[] }) => void;
  entityLabel: string;
  hideCategoryPicker?: boolean;
}) {
  const [categoriaId, setCategoriaId] = useState("");
  const [nombre, setNombre] = useState("");
  const [contactos, setContactos] = useState<{ contacto: string; email: string; telefono: string }[]>([{ contacto: "", email: "", telefono: "" }]);

  const reset = () => {
    setCategoriaId(categorias[0]?.id || "");
    setNombre("");
    setContactos([{ contacto: "", email: "", telefono: "" }]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo {entityLabel}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          const catId = hideCategoryPicker ? (categorias[0]?.id || "") : categoriaId;
          if (!nombre.trim() || !catId) return;
          const validContactos = contactos.filter(c => c.contacto || c.email || c.telefono);
          onSubmit({ categoria_id: catId, nombre: nombre.trim(), contactos: validContactos });
        }} className="space-y-4">
          {!hideCategoryPicker && (
            <div className="space-y-1">
              <Label>Categoría *</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Contactos</Label>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setContactos(prev => [...prev, { contacto: "", email: "", telefono: "" }])}>
                <Plus className="w-3 h-3" /> Agregar contacto
              </Button>
            </div>
            {contactos.map((ct, idx) => (
              <div key={idx} className="relative rounded-lg border border-border p-3 space-y-2">
                {contactos.length > 1 && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">Contacto {idx + 1}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-destructive hover:text-destructive" onClick={() => setContactos(prev => prev.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><Input placeholder="Nombre contacto" value={ct.contacto} onChange={(e) => setContactos(prev => prev.map((c, i) => i === idx ? { ...c, contacto: e.target.value } : c))} className="h-8 text-sm" /></div>
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><Input placeholder="Email" type="email" value={ct.email} onChange={(e) => setContactos(prev => prev.map((c, i) => i === idx ? { ...c, email: e.target.value } : c))} className="h-8 text-sm" /></div>
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><Input placeholder="Teléfono" value={ct.telefono} onChange={(e) => setContactos(prev => prev.map((c, i) => i === idx ? { ...c, telefono: e.target.value } : c))} className="h-8 text-sm" /></div>
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
          <DialogHeader><DialogTitle>Categorías de Clientes</DialogTitle></DialogHeader>
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
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditCat(cat); setEditName(cat.nombre); }}><Pencil className="w-3 h-3 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => setDeleteCatTarget(cat)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!newName.trim()) return; createCat.mutate({ nombre: newName.trim(), orden: (categorias?.length || 0) + 1 }, { onSuccess: () => setNewName("") }); }}>
              <Input placeholder="Nueva categoría..." value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" />
              <Button type="submit" size="sm" className="h-8"><Plus className="w-3.5 h-3.5" /></Button>
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
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteCatTarget) deleteCat.mutate(deleteCatTarget.id, { onSuccess: () => setDeleteCatTarget(null) }); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
