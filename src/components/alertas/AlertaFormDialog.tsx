import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertaInput, AlertaWithRelations } from "@/hooks/useAlertas";
import { Tables } from "@/integrations/supabase/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: AlertaInput & { id?: string }) => void;
  editTarget?: AlertaWithRelations | null;
  proyectos: { id: string; nombre: string; numero: number }[];
  empresas: Tables<"empresas">[];
  profiles: { user_id: string; display_name: string; email: string }[];
  currentUserId: string;
  defaultProyectoId?: string;
  defaultEmpresaId?: string;
  defaultTexto?: string;
}

export default function AlertaFormDialog({ open, onClose, onSubmit, editTarget, proyectos, empresas, profiles, currentUserId, defaultProyectoId, defaultEmpresaId, defaultTexto }: Props) {
  const [proyectoId, setProyectoId] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [texto, setTexto] = useState("");
  const [responsableId, setResponsableId] = useState(currentUserId);
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");

  useEffect(() => {
    if (editTarget) {
      setProyectoId(editTarget.proyecto_id);
      setEmpresaId(editTarget.empresa_id || "");
      setTexto(editTarget.texto);
      setResponsableId(editTarget.usuario_responsable_id);
      setFechaSeguimiento(editTarget.fecha_seguimiento);
    } else {
      setProyectoId(defaultProyectoId || "");
      setEmpresaId(defaultEmpresaId || "");
      setTexto(defaultTexto || "");
      setResponsableId(currentUserId);
      setFechaSeguimiento("");
    }
  }, [editTarget, open, currentUserId]);

  const handleSubmit = () => {
    if (!proyectoId || !texto.trim() || !fechaSeguimiento) return;
    onSubmit({
      ...(editTarget ? { id: editTarget.id } : {}),
      proyecto_id: proyectoId,
      empresa_id: empresaId && empresaId !== "none" ? empresaId : null,
      texto: texto.trim(),
      usuario_responsable_id: responsableId,
      fecha_seguimiento: fechaSeguimiento,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Editar Alerta" : "Nueva Alerta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Proyecto *</Label>
            <Select value={proyectoId} onValueChange={setProyectoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar proyecto" /></SelectTrigger>
              <SelectContent>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    #{p.numero} — {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Empresa (opcional)</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue placeholder="Sin empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin empresa</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Texto de la alerta * (máx. 100 caracteres)</Label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 100))}
              maxLength={100}
              placeholder="Descripción breve de la alerta..."
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{texto.length}/100</p>
          </div>

          <div className="space-y-2">
            <Label>Usuario Responsable</Label>
            <Select value={responsableId} onValueChange={setResponsableId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar responsable" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.display_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha de Seguimiento *</Label>
            <Input
              type="date"
              value={fechaSeguimiento}
              onChange={(e) => setFechaSeguimiento(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!proyectoId || !texto.trim() || !fechaSeguimiento}>
            {editTarget ? "Guardar" : "Crear Alerta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
