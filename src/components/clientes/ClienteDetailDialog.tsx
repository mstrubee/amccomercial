import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, X, Mail, Phone, User, FolderOpen, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClienteWithCategoria, CategoriaCliente, useUpdateCliente } from "@/hooks/useClientes";
import { useProyectos } from "@/hooks/useProyectos";
import { useSyncClienteProyecto, complementClienteFromProyectos } from "@/hooks/useSyncClienteProyecto";

interface ContactoForm {
  id?: string;
  contacto: string;
  email: string;
  telefono: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente: ClienteWithCategoria | null;
  categorias: CategoriaCliente[];
  canEdit: boolean;
  canEditContacts?: boolean; // captadores can edit contacts but not client metadata
  canDelete: boolean;
}

export default function ClienteDetailDialog({ open, onOpenChange, cliente, categorias, canEdit, canEditContacts = canEdit, canDelete }: Props) {
  const updateCliente = useUpdateCliente();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: proyectos, isLoading: loadingProyectos } = useProyectos();
  const { syncClienteToLinkedProyectos } = useSyncClienteProyecto();
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [contactos, setContactos] = useState<ContactoForm[]>([]);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const hasComplemented = useRef<string | null>(null);
  const editingRef = useRef(false);

  useEffect(() => {
    // Don't reset form while the user is actively editing — the query
    // refetch after any invalidation creates a new object reference for
    // `cliente`, which would otherwise wipe in-progress changes.
    if (cliente && !editingRef.current) {
      resetForm();
    }
  }, [cliente]);

  // Complement empty client fields from linked projects on dialog open
  useEffect(() => {
    if (!open || !cliente) return;
    // Only run once per client open
    if (hasComplemented.current === cliente.id) return;
    hasComplemented.current = cliente.id;

    const catNombre = categorias.find(c => c.id === cliente.categoria_id)?.nombre || "";
    const currentContactos = (cliente.contactos_cliente || []).map(c => ({
      contacto: c.contacto,
      email: c.email,
      telefono: c.telefono,
    }));

    complementClienteFromProyectos(cliente.id, cliente.nombre, catNombre, currentContactos).then(async merged => {
      // Only apply if the user hasn't started editing yet.
      // If editing is already active, don't overwrite their changes.
      if (!merged || editingRef.current) return;

      // 1. Update form state immediately so the user sees the data.
      setContactos(merged.map((c, i) => ({
        id: (cliente.contactos_cliente || [])[i]?.id,
        contacto: c.contacto,
        email: c.email,
        telefono: c.telefono,
      })));

      // 2. Persist to DB — fill empty fields in existing rows and insert new
      //    contacts. We only write fields that were genuinely empty in the DB;
      //    this function is safe to call silently (no overwrite of real data).
      let dbChanged = false;
      for (let i = 0; i < merged.length; i++) {
        const c = merged[i];
        const existing = (cliente.contactos_cliente || [])[i];
        if (existing) {
          // Update only the fields that were empty in DB but got filled by complement
          const patches: Record<string, string> = {};
          if (!existing.contacto && c.contacto) patches.contacto = c.contacto;
          if (!existing.email && c.email) patches.email = c.email;
          if (!existing.telefono && c.telefono) patches.telefono = c.telefono;
          if (Object.keys(patches).length > 0) {
            await supabase.from("contactos_cliente").update(patches).eq("id", existing.id);
            dbChanged = true;
          }
        } else if (c.contacto || c.email || c.telefono) {
          // New contact derived entirely from project data (client had none before)
          await supabase.from("contactos_cliente").insert({
            cliente_id: cliente.id,
            contacto: c.contacto || "",
            email: c.email || "",
            telefono: c.telefono || "",
            orden: i,
          });
          dbChanged = true;
        }
      }
      if (dbChanged) {
        // Refresh the clientes query so the persisted data is reflected in the
        // cache; `editingRef.current` is false here so resetForm() won't fire.
        qc.invalidateQueries({ queryKey: ["clientes"] });
      }
    });
  }, [open, cliente, categorias]);

  const resetForm = () => {
    if (!cliente) return;
    setNombre(cliente.nombre);
    setCategoriaId(cliente.categoria_id);
    setContactos(
      (cliente.contactos_cliente || []).map(c => ({
        id: c.id,
        contacto: c.contacto,
        email: c.email,
        telefono: c.telefono,
      }))
    );
    setHasChanges(false);
    setEditing(false);
    editingRef.current = false;
  };

  const updateContacto = (idx: number, field: string, value: string) => {
    setContactos(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    setHasChanges(true);
  };

  const addContacto = () => {
    setContactos(prev => [...prev, { contacto: "", email: "", telefono: "" }]);
    setHasChanges(true);
  };

  const confirmDeleteContacto = (idx: number) => {
    setDeleteIdx(idx);
  };

  const doDeleteContacto = () => {
    if (deleteIdx !== null) {
      setContactos(prev => prev.filter((_, i) => i !== deleteIdx));
      setHasChanges(true);
      setDeleteIdx(null);
    }
  };

  const handleSave = () => {
    if (!cliente || !nombre.trim() || !categoriaId) return;
    const validContactos = contactos.filter(c => c.contacto || c.email || c.telefono);
    const oldNombre = cliente.nombre;
    const catNombreForSync = categorias.find(c => c.id === categoriaId)?.nombre || "";
    updateCliente.mutate(
      { id: cliente.id, categoria_id: categoriaId, nombre: nombre.trim(), contactos: validContactos },
      {
        onSuccess: () => {
          setHasChanges(false);
          setEditing(false);
          // Sync client data to linked projects
          syncClienteToLinkedProyectos(
            cliente.id,
            oldNombre,
            nombre.trim(),
            catNombreForSync,
            validContactos
          );
        },
      }
    );
  };

  const handleClose = () => {
    if (editing && hasChanges) {
      setConfirmDiscard(true);
    } else {
      onOpenChange(false);
      setEditing(false);
    }
  };

  const doDiscard = () => {
    resetForm();
    setConfirmDiscard(false);
    onOpenChange(false);
  };

  const linkedProyectos = useMemo(() => {
    if (!cliente || !proyectos) return [];

    const catNombreActual = categorias.find(c => c.id === cliente.categoria_id)?.nombre || "";
    const CAT_TO_PREFIX: Record<string, string> = {
      Arquitectura: "arq", Constructora: "const", ITO: "ito", Dueños: "duenos",
    };
    const prefix = CAT_TO_PREFIX[catNombreActual];
    const nombreLower = cliente.nombre.trim().toLowerCase();

    const all = proyectos.filter(p => {
      // 1. Formal link via proyecto_clientes join table
      if ((p.proyecto_clientes || []).some(pc => pc.cliente_id === cliente.id)) return true;
      // 2. Denormalized field match (legacy data) — check if client name appears in arq_nombre / etc.
      if (prefix) {
        const campo = (p as any)[`${prefix}_nombre`] as string | null;
        if (campo) {
          // Exact match only — substring matching causes false positives
          // (e.g. "Tomas" matching "Tomas Hevia Castro")
          const nombres = campo.split("/").map((n: string) => n.trim().toLowerCase());
          if (nombres.some(n => n === nombreLower)) return true;
        }
      }
      return false;
    });

    // Deduplicate by project name (one group can have N empresa rows)
    const seen = new Set<string>();
    return all.filter(p => {
      const key = p.nombre.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [cliente, proyectos, categorias]);

  if (!cliente) return null;
  const catNombre = categorias.find(c => c.id === categoriaId)?.nombre || "";

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>{editing ? "Editar Cliente" : "Detalle de Cliente"}</span>
              {(canEdit || canEditContacts) && !editing && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setEditing(true); editingRef.current = true; }}>
                  Editar
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Name */}
            <Collapsible defaultOpen={true} open={editing ? true : undefined}>
              <CollapsibleTrigger className="flex items-center gap-1.5 group cursor-pointer w-full">
                <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                <Label className="text-xs text-muted-foreground uppercase tracking-wide cursor-pointer">Nombre</Label>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {editing && canEdit ? (
                  <Input value={nombre} onChange={(e) => { setNombre(e.target.value); setHasChanges(true); }} />
                ) : (
                  <p className="text-base font-semibold text-card-foreground">{nombre}</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Category */}
            <Collapsible defaultOpen={true} open={editing ? true : undefined}>
              <CollapsibleTrigger className="flex items-center gap-1.5 group cursor-pointer w-full">
                <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                <Label className="text-xs text-muted-foreground uppercase tracking-wide cursor-pointer">Categoría</Label>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                {editing && canEdit ? (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={categoriaId}
                    onChange={(e) => { setCategoriaId(e.target.value); setHasChanges(true); }}
                  >
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-card-foreground">{catNombre}</p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Contacts */}
            <Collapsible defaultOpen={false} open={editing ? true : undefined}>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-1.5 group cursor-pointer">
                  <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide cursor-pointer">Contactos</Label>
                </CollapsibleTrigger>
                {editing && (
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addContacto}>
                    <Plus className="w-3 h-3" /> Agregar
                  </Button>
                )}
              </div>
              <CollapsibleContent className="pt-2 space-y-3">
                {contactos.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin contactos registrados</p>
                )}
                <AnimatePresence>
                  {contactos.map((ct, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-lg border border-border p-3 space-y-2"
                    >
                      {editing ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">Contacto {idx + 1}</span>
                            {canDelete && (
                              <Button type="button" variant="ghost" size="sm" className="h-5 text-xs text-destructive hover:text-destructive" onClick={() => confirmDeleteContacto(idx)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input placeholder="Nombre contacto" value={ct.contacto} onChange={(e) => updateContacto(idx, "contacto", e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input placeholder="Email" type="email" value={ct.email} onChange={(e) => updateContacto(idx, "email", e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <Input placeholder="Teléfono" value={ct.telefono} onChange={(e) => updateContacto(idx, "telefono", e.target.value)} className="h-8 text-sm" />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium text-card-foreground">{ct.contacto || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground">{ct.email || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm text-muted-foreground">{ct.telefono || "—"}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>

            {/* Proyectos Vinculados */}
            {!editing && (
              <Collapsible defaultOpen={false}>
                <CollapsibleTrigger className="flex items-center gap-1.5 group cursor-pointer w-full">
                  <ChevronRight className="w-3 h-3 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide cursor-pointer flex items-center gap-1">
                    <FolderOpen className="w-3.5 h-3.5" /> Proyectos Vinculados
                  </Label>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  {loadingProyectos ? (
                    <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">Cargando proyectos...</p>
                  ) : linkedProyectos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin proyectos vinculados</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedProyectos.map(p => {
                        const cat = p.proyecto_empresas?.[0]?.categorias_proyecto?.nombre;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors cursor-pointer group"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/proyectos?highlight=${p.id}`, {
                                state: {
                                  from: "clientes",
                                  clienteId: cliente?.id,
                                  clienteNombre: cliente?.nombre,
                                },
                              });
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-card-foreground">{p.nombre}</p>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            {cat && <p className="text-xs text-muted-foreground">Categoría: {cat}</p>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {editing && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" className="gap-1" onClick={() => { resetForm(); }}>
                  <X className="w-3.5 h-3.5" /> Descartar
                </Button>
                <Button className="gap-1" onClick={handleSave} disabled={updateCliente.isPending}>
                  <Save className="w-3.5 h-3.5" /> {updateCliente.isPending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete contact */}
      <AlertDialog open={deleteIdx !== null} onOpenChange={(v) => !v && setDeleteIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el contacto <strong>{deleteIdx !== null ? contactos[deleteIdx]?.contacto || `#${deleteIdx + 1}` : ""}</strong>. Esta acción se aplicará al guardar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDeleteContacto}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm discard changes */}
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>Tienes cambios sin guardar. ¿Deseas descartarlos?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={doDiscard}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
