import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function Usuarios() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRecord | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
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

  useEffect(() => { fetchUsers(); }, []);

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
              <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-5 py-3 text-card-foreground">{u.email}</td>
                <td className="px-5 py-3 text-muted-foreground">{u.display_name}</td>
                <td className="px-5 py-3">
                  {u.roles.map((r) => (
                    <span key={r} className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary mr-1">
                      {ROLE_LABELS[r] || r}
                    </span>
                  ))}
                  {u.roles.length === 0 && <span className="text-muted-foreground text-xs">Sin rol</span>}
                </td>
                <td className="px-5 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString("es-CL")}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditUser(u); setShowForm(true); }}>
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteUser(u)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
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
