import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserCheck, XCircle, Loader2, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { useDelegacionesPorDelegante, useCreateDelegacion, useRevokeDelegacion, useUpdateDelegacion, useDeleteDelegacion, Delegacion } from "@/hooks/useDelegaciones";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: { id: string; email: string; display_name: string } | null;
}

export default function DelegacionesDialog({ open, onOpenChange, user }: Props) {
  const { data: delegaciones, isLoading } = useDelegacionesPorDelegante(user?.id || null);
  const createDelegacion = useCreateDelegacion();
  const revokeDelegacion = useRevokeDelegacion();
  const updateDelegacion = useUpdateDelegacion();
  const deleteDelegacion = useDeleteDelegacion();

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, email");
      return data || [];
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [delegadoId, setDelegadoId] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDelegadoId, setEditDelegadoId] = useState("");
  const [editFechaFin, setEditFechaFin] = useState("");

  useEffect(() => {
    if (open) {
      setShowForm(false);
      setDelegadoId("");
      setFechaFin("");
      setEditingId(null);
    }
  }, [open]);

  const availableProfiles = profiles?.filter(
    (p) => p.user_id !== user?.id
  ) || [];

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p.display_name || p.email]) || []);

  const handleCreate = () => {
    if (!user || !delegadoId || !fechaFin) return;
    createDelegacion.mutate(
      { delegante_id: user.id, delegado_id: delegadoId, fecha_fin: new Date(fechaFin + "T23:59:59").toISOString() },
      { onSuccess: () => { setShowForm(false); setDelegadoId(""); setFechaFin(""); } }
    );
  };

  const isActive = (d: Delegacion) => !d.revocada && new Date(d.fecha_fin) > new Date();

  const startEdit = (d: Delegacion) => {
    setEditingId(d.id);
    setEditDelegadoId(d.delegado_id);
    setEditFechaFin(d.fecha_fin.slice(0, 10));
  };

  const saveEdit = (id: string) => {
    updateDelegacion.mutate(
      { id, delegado_id: editDelegadoId, fecha_fin: new Date(editFechaFin + "T23:59:59").toISOString() },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Delegaciones — {user?.display_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Usuarios autorizados para completar alertas y crear dependientes a nombre de <strong>{user?.display_name}</strong>.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {delegaciones && delegaciones.length > 0 ? (
              delegaciones.map((d) => (
                <div key={d.id} className="border rounded-lg p-3">
                  {editingId === d.id ? (
                    <div className="space-y-2">
                      <Select value={editDelegadoId} onValueChange={setEditDelegadoId}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {availableProfiles.map((p) => (
                            <SelectItem key={p.user_id} value={p.user_id}>{p.display_name || p.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="date" value={editFechaFin} onChange={(e) => setEditFechaFin(e.target.value)} className="h-8" />
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => saveEdit(d.id)} disabled={updateDelegacion.isPending}>
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{profileMap.get(d.delegado_id) || d.delegado_id}</p>
                        <p className="text-xs text-muted-foreground">
                          Hasta: {format(new Date(d.fecha_fin), "dd MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isActive(d) ? (
                          <Badge variant="default" className="text-[10px]">Activa</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            {d.revocada ? "Revocada" : "Expirada"}
                          </Badge>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(d)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {isActive(d) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => revokeDelegacion.mutate(d.id)} title="Revocar">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => { if (confirm("¿Eliminar esta delegación permanentemente?")) deleteDelegacion.mutate(d.id); }}
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No hay delegaciones registradas.</p>
            )}

            {!showForm ? (
              <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4" /> Nueva delegación
              </Button>
            ) : (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Delegar a</Label>
                  <Select value={delegadoId} onValueChange={setDelegadoId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.display_name || p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de expiración</Label>
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleCreate} disabled={!delegadoId || !fechaFin || createDelegacion.isPending}>
                    {createDelegacion.isPending ? "Creando..." : "Crear"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
