import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertaInput, AlertaWithRelations } from "@/hooks/useAlertas";
import { useTitulosAlerta } from "@/hooks/useTitulosAlerta";
import { useClasificacionesAlerta } from "@/hooks/useClasificacionesAlerta";
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
  /** ID of the parent alert (when creating follow-up from completed alert) */
  parentAlertaId?: string | null;
}

export default function AlertaFormDialog({ open, onClose, onSubmit, editTarget, proyectos, empresas, profiles, currentUserId, defaultProyectoId, defaultEmpresaId, defaultTexto, parentAlertaId }: Props) {
  const [proyectoId, setProyectoId] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [responsableId, setResponsableId] = useState(currentUserId);
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [clasificacionId, setClasificacionId] = useState<string>("");
  const [subclasificacionId, setSubclasificacionId] = useState<string>("");

  const { data: titulosOpciones } = useTitulosAlerta();
  const { data: clasificaciones } = useClasificacionesAlerta();

  const selectedClasif = clasificaciones?.find(c => c.id === clasificacionId);

  useEffect(() => {
    if (editTarget) {
      setProyectoId(editTarget.proyecto_id);
      setEmpresaId(editTarget.empresa_id || "");
      setTitulo((editTarget as any).titulo || "");
      setTexto(editTarget.texto);
      setResponsableId(editTarget.usuario_responsable_id);
      setFechaSeguimiento(editTarget.fecha_seguimiento);
      setClasificacionId((editTarget as any).clasificacion_alerta_id || "");
      setSubclasificacionId((editTarget as any).subclasificacion_alerta_id || "");
    } else {
      setProyectoId(defaultProyectoId || "");
      setEmpresaId(defaultEmpresaId || "");
      setTitulo("");
      setTexto(defaultTexto || "");
      setResponsableId(currentUserId);
      setFechaSeguimiento("");
      setClasificacionId("");
      setSubclasificacionId("");
    }
  }, [editTarget, open, currentUserId]);

  const handleSubmit = () => {
    if (!proyectoId || !texto.trim() || !fechaSeguimiento) return;
    onSubmit({
      ...(editTarget ? { id: editTarget.id } : {}),
      proyecto_id: proyectoId,
      empresa_id: empresaId && empresaId !== "none" ? empresaId : null,
      titulo: titulo.trim(),
      texto: texto.trim(),
      usuario_responsable_id: responsableId,
      fecha_seguimiento: fechaSeguimiento,
      clasificacion_alerta_id: clasificacionId && clasificacionId !== "none" ? clasificacionId : null,
      subclasificacion_alerta_id: subclasificacionId && subclasificacionId !== "none" ? subclasificacionId : null,
      ...(!editTarget && parentAlertaId ? { parent_alerta_id: parentAlertaId } : {}),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editTarget ? "Editar Alerta" : "Nueva Alerta"}</DialogTitle>
          {parentAlertaId && !editTarget && (
            <p className="text-xs text-muted-foreground mt-1">🔗 Esta alerta será vinculada como seguimiento de la anterior</p>
          )}
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
            <Label>Título</Label>
            <div className="flex gap-2">
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value.slice(0, 100))}
                placeholder="Escribir título o seleccionar..."
                className="flex-1"
                maxLength={100}
              />
              {titulosOpciones && titulosOpciones.length > 0 && (
                <Select value="" onValueChange={(v) => setTitulo(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Predefinidos" />
                  </SelectTrigger>
                  <SelectContent>
                    {titulosOpciones.map((t) => (
                      <SelectItem key={t.id} value={t.nombre}>{t.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clasificación</Label>
              <Select value={clasificacionId} onValueChange={(v) => { setClasificacionId(v); setSubclasificacionId(""); }}>
                <SelectTrigger><SelectValue placeholder="Sin clasificación" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin clasificación</SelectItem>
                  {clasificaciones?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub-clasificación</Label>
              <Select value={subclasificacionId} onValueChange={setSubclasificacionId} disabled={!selectedClasif || selectedClasif.subclasificaciones.length === 0}>
                <SelectTrigger><SelectValue placeholder="Sin sub-clasificación" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sub-clasificación</SelectItem>
                  {selectedClasif?.subclasificaciones.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
