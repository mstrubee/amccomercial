import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Shield, UserCheck, Clock, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useUserPermissions, useSavePermissions, ALL_SECTIONS, ALL_DASHBOARD_WIDGETS } from "@/hooks/usePermissions";
import DelegacionesDialog from "@/components/usuarios/DelegacionesDialog";
import ActivityThresholdsDialog from "@/components/usuarios/ActivityThresholdsDialog";
import { useActivityThresholds, getActivityStatus, type ProfilePresence } from "@/hooks/useActivityThresholds";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  usuario_tipo_1: "Usuario Tipo 1",
  usuario_tipo_2: "Usuario Tipo 2",
};

// Captador record with optional user link
interface CaptadorRecord {
  id: string;
  nombre: string;
  user_id: string | null;
}

export default function Usuarios() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserRecord | null>(null);
  const [delegacionesUser, setDelegacionesUser] = useState<UserRecord | null>(null);
  const [thresholdsUser, setThresholdsUser] = useState<UserRecord | null>(null);
  const [linkCaptadorUser, setLinkCaptadorUser] = useState<UserRecord | null>(null);
  const [profiles, setProfiles] = useState<ProfilePresence[]>([]);
  const [captadores, setCaptadores] = useState<CaptadorRecord[]>([]);
  const { data: thresholds } = useActivityThresholds();
  const qc = useQueryClient();

  const fetchCaptadores = async () => {
    const { data } = await supabase.from("captadores" as any).select("id, nombre, user_id");
    setCaptadores((data as CaptadorRecord[]) || []);
  };

  // Fetch profiles for activity column
  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, last_seen_at, activity_status, current_section");
      setProfiles((data as ProfilePresence[]) || []);
    };
    fetchProfiles();

    const channel = supabase
      .channel("usuarios-profiles-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchProfiles();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "list" },
    });
    if (res.error) {
      toast.error("Error al cargar usuarios");
    } else {
      setUsers(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); fetchCaptadores(); }, []);

  const handleDelete = async () => {
    if (!deleteUser) return;
    const res = await supabase.functions.invoke("manage-users", {
      body: { action: "delete", user_id: deleteUser.id },
    });
    if (res.error) {
      toast.error("Error al eliminar usuario");
    } else {
      toast.success("Usuario eliminado");
      fetchUsers();
    }
    setDeleteUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground mt-1">Gestión de acceso al sistema</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditUser(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Creado</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actividad</th>
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const linkedCaptador = captadores.find(c => c.user_id === u.id);
              return (
              <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-5 py-3 text-card-foreground">{u.email}</td>
                <td className="px-5 py-3">
                  <p className="font-medium text-card-foreground">{u.display_name || <span className="text-muted-foreground italic text-xs">Sin nombre</span>}</p>
                  {linkedCaptador && (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                      <Link2 className="w-2.5 h-2.5" /> Captador: {linkedCaptador.nombre}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {u.roles.map((r) => (
                    <span key={r} className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary mr-1">
                      {ROLE_LABELS[r] || r}
                    </span>
                  ))}
                  {u.roles.length === 0 && <span className="text-muted-foreground text-xs">Sin rol</span>}
                </td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString("es-CL")}</td>
                <td className="px-5 py-3">
                  {(() => {
                    const prof = profiles.find((p) => p.user_id === u.id);
                    if (!prof) return <span className="text-xs text-muted-foreground">—</span>;
                    const s = getActivityStatus(prof, thresholds);
                    return (
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.color, s.pulse && "animate-pulse")} />
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">{s.text}</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Umbrales de actividad" onClick={() => setThresholdsUser(u)}>
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Delegaciones" onClick={() => setDelegacionesUser(u)}>
                      <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Permisos" onClick={() => setPermissionsUser(u)}>
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title={linkedCaptador ? "Desvincular captador" : "Vincular captador"}
                      onClick={() => setLinkCaptadorUser(u)}
                    >
                      {linkedCaptador
                        ? <Link2Off className="w-3.5 h-3.5 text-emerald-600" />
                        : <Link2 className="w-3.5 h-3.5 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditUser(u); setShowForm(true); }}>
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteUser(u)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">No hay usuarios registrados</div>
        )}
      </motion.div>

      <UserFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        editUser={editUser}
        onSuccess={() => { setShowForm(false); fetchUsers(); }}
      />

      <PermissionsDialog
        open={!!permissionsUser}
        onOpenChange={(v) => !v && setPermissionsUser(null)}
        user={permissionsUser}
      />

      <DelegacionesDialog
        open={!!delegacionesUser}
        onOpenChange={(v) => !v && setDelegacionesUser(null)}
        user={delegacionesUser}
      />

      <ActivityThresholdsDialog
        open={!!thresholdsUser}
        onOpenChange={(v) => !v && setThresholdsUser(null)}
        userId={thresholdsUser?.id || ""}
        userName={thresholdsUser?.display_name || thresholdsUser?.email || ""}
        current={thresholds?.find((t) => t.user_id === thresholdsUser?.id)}
      />

      {linkCaptadorUser && (
        <CaptadorLinkDialog
          user={linkCaptadorUser}
          captadores={captadores}
          onClose={() => setLinkCaptadorUser(null)}
          onSaved={() => { setLinkCaptadorUser(null); fetchCaptadores(); }}
        />
      )}

      <AlertDialog open={!!deleteUser} onOpenChange={(v) => !v && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará el usuario <strong>{deleteUser?.email}</strong>. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PermissionsDialog({ open, onOpenChange, user }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: UserRecord | null;
}) {
  const { data: empresas } = useEmpresas();
  const { data: permissions, isLoading } = useUserPermissions(user?.id || null);
  const savePermissions = useSavePermissions();

  const [empresasVisibles, setEmpresasVisibles] = useState<string[] | null>(null);
  const [seccionesVisibles, setSeccionesVisibles] = useState<string[] | null>(null);
  const [dashboardWidgets, setDashboardWidgets] = useState<string[] | null>(null);
  const [puedeEditar, setPuedeEditar] = useState(true);
  const [allEmpresas, setAllEmpresas] = useState(true);
  const [allSections, setAllSections] = useState(true);
  const [allWidgets, setAllWidgets] = useState(true);

  useEffect(() => {
    if (open && permissions !== undefined) {
      if (permissions) {
        setEmpresasVisibles(permissions.empresas_visibles);
        setSeccionesVisibles(permissions.secciones_visibles);
        setDashboardWidgets(permissions.dashboard_widgets);
        setPuedeEditar(permissions.puede_editar);
        setAllEmpresas(permissions.empresas_visibles === null);
        setAllSections(permissions.secciones_visibles === null);
        setAllWidgets(permissions.dashboard_widgets === null);
      } else {
        setEmpresasVisibles(null);
        setSeccionesVisibles(null);
        setDashboardWidgets(null);
        setPuedeEditar(true);
        setAllEmpresas(true);
        setAllSections(true);
        setAllWidgets(true);
      }
    }
  }, [open, permissions]);

  const toggleEmpresa = (id: string) => {
    const current = empresasVisibles || [];
    if (current.includes(id)) {
      setEmpresasVisibles(current.filter(e => e !== id));
    } else {
      setEmpresasVisibles([...current, id]);
    }
  };

  const toggleSection = (key: string) => {
    const current = seccionesVisibles || [];
    if (current.includes(key)) {
      setSeccionesVisibles(current.filter(s => s !== key));
    } else {
      setSeccionesVisibles([...current, key]);
    }
  };

  const toggleWidget = (key: string) => {
    const current = dashboardWidgets || [];
    if (current.includes(key)) {
      setDashboardWidgets(current.filter(w => w !== key));
    } else {
      setDashboardWidgets([...current, key]);
    }
  };

  const handleSave = () => {
    if (!user) return;
    savePermissions.mutate({
      user_id: user.id,
      empresas_visibles: allEmpresas ? null : (empresasVisibles || []),
      secciones_visibles: allSections ? null : (seccionesVisibles || []),
      dashboard_widgets: allWidgets ? null : (dashboardWidgets || []),
      puede_editar: puedeEditar,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Permisos — {user?.display_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="empresas" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="empresas" className="text-xs">Empresas</TabsTrigger>
              <TabsTrigger value="secciones" className="text-xs">Secciones</TabsTrigger>
              <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
              <TabsTrigger value="edicion" className="text-xs">Edición</TabsTrigger>
            </TabsList>

            {/* Empresas visibles */}
            <TabsContent value="empresas" className="space-y-3">
              <p className="text-xs text-muted-foreground">Selecciona qué empresas puede ver este usuario.</p>
              <div className="flex items-center gap-2">
                <Switch checked={allEmpresas} onCheckedChange={(v) => {
                  setAllEmpresas(v);
                  if (v) setEmpresasVisibles(null);
                  else setEmpresasVisibles([]);
                }} />
                <Label className="text-sm">Todas las empresas</Label>
              </div>
              {!allEmpresas && (
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {empresas?.map(e => (
                    <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={(empresasVisibles || []).includes(e.id)}
                        onCheckedChange={() => toggleEmpresa(e.id)}
                      />
                      {e.nombre}
                      <span className="text-[10px] text-muted-foreground ml-auto">{e.estado}</span>
                    </label>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Secciones del menú */}
            <TabsContent value="secciones" className="space-y-3">
              <p className="text-xs text-muted-foreground">Selecciona qué secciones del menú puede acceder este usuario.</p>
              <div className="flex items-center gap-2">
                <Switch checked={allSections} onCheckedChange={(v) => {
                  setAllSections(v);
                  if (v) setSeccionesVisibles(null);
                  else setSeccionesVisibles(ALL_SECTIONS.map(s => s.key));
                }} />
                <Label className="text-sm">Todas las secciones</Label>
              </div>
              {!allSections && (
                <div className="space-y-2 border rounded-md p-3">
                  {ALL_SECTIONS.map(s => (
                    <label key={s.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={(seccionesVisibles || []).includes(s.key)}
                        onCheckedChange={() => toggleSection(s.key)}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Dashboard widgets */}
            <TabsContent value="dashboard" className="space-y-3">
              <p className="text-xs text-muted-foreground">Selecciona qué widgets del Dashboard puede ver este usuario.</p>
              <div className="flex items-center gap-2">
                <Switch checked={allWidgets} onCheckedChange={(v) => {
                  setAllWidgets(v);
                  if (v) setDashboardWidgets(null);
                  else setDashboardWidgets(ALL_DASHBOARD_WIDGETS.map(w => w.key));
                }} />
                <Label className="text-sm">Todos los widgets</Label>
              </div>
              {!allWidgets && (
                <div className="space-y-2 border rounded-md p-3">
                  {ALL_DASHBOARD_WIDGETS.map(w => (
                    <label key={w.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={(dashboardWidgets || []).includes(w.key)}
                        onCheckedChange={() => toggleWidget(w.key)}
                      />
                      {w.label}
                    </label>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Permisos de edición */}
            <TabsContent value="edicion" className="space-y-3">
              <p className="text-xs text-muted-foreground">Controla si el usuario puede modificar datos o solo visualizar.</p>
              <div className="flex items-center gap-2">
                <Switch checked={puedeEditar} onCheckedChange={setPuedeEditar} />
                <Label className="text-sm">{puedeEditar ? "Puede editar datos" : "Solo lectura"}</Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {puedeEditar
                  ? "El usuario puede crear, editar y eliminar registros según su rol."
                  : "El usuario solo puede visualizar la información sin realizar cambios."}
              </p>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={savePermissions.isPending}>
            {savePermissions.isPending ? "Guardando..." : "Guardar Permisos"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserFormDialog({ open, onOpenChange, editUser, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editUser: UserRecord | null;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editUser) {
        setEmail(editUser.email);
        setDisplayName(editUser.display_name);
        setRole(editUser.roles[0] || "");
        setPassword("");
      } else {
        setEmail(""); setPassword(""); setDisplayName(""); setRole("");
      }
    }
  }, [open, editUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editUser) {
      const res = await supabase.functions.invoke("manage-users", {
        body: {
          action: "update",
          user_id: editUser.id,
          email: email !== editUser.email ? email : undefined,
          password: password || undefined,
          display_name: displayName,
          role: role || null,
        },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Error al actualizar");
      } else {
        toast.success("Usuario actualizado");
        onSuccess();
      }
    } else {
      if (!password) { toast.error("Contraseña requerida"); setSaving(false); return; }
      const res = await supabase.functions.invoke("manage-users", {
        body: { action: "create", email, password, display_name: displayName, role: role || null },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || "Error al crear usuario");
      } else {
        toast.success("Usuario creado");
        onSuccess();
      }
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>{editUser ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editUser} />
          </div>
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Rol</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Sin rol</option>
              <option value="admin">Administrador</option>
              <option value="usuario_tipo_1">Usuario Tipo 1</option>
              <option value="usuario_tipo_2">Usuario Tipo 2</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── CaptadorLinkDialog ── */
function CaptadorLinkDialog({
  user,
  captadores,
  onClose,
  onSaved,
}: {
  user: UserRecord;
  captadores: CaptadorRecord[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const linked = captadores.find(c => c.user_id === user.id);
  const [selectedId, setSelectedId] = useState(linked?.id || "");
  const [saving, setSaving] = useState(false);

  // Captadores available to link: unlinked ones + the currently linked one
  const available = captadores.filter(c => !c.user_id || c.user_id === user.id);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Unlink previous if any
      if (linked) {
        await supabase.from("captadores" as any).update({ user_id: null }).eq("id", linked.id);
      }
      // Link new if selected
      if (selectedId && selectedId !== linked?.id) {
        const { error } = await supabase
          .from("captadores" as any)
          .update({ user_id: user.id })
          .eq("id", selectedId);
        if (error) throw error;
      }
      toast.success("Captador actualizado");
      onSaved();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!linked) return;
    setSaving(true);
    try {
      await supabase.from("captadores" as any).update({ user_id: null }).eq("id", linked.id);
      toast.success("Captador desvinculado");
      onSaved();
    } catch {
      toast.error("Error al desvincular");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Vincular captador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Asocia un captador a <strong>{user.display_name || user.email}</strong>. El usuario verá solo los proyectos donde tenga empresas asignadas.
          </p>
          {linked && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
              <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                <Link2 className="w-4 h-4" /> {linked.nombre}
              </span>
              <button onClick={handleUnlink} disabled={saving} className="text-xs text-red-500 hover:text-red-700">
                Desvincular
              </button>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{linked ? "Cambiar a otro captador" : "Seleccionar captador"}</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Sin captador —</option>
              {available.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || (!selectedId && !linked)}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

