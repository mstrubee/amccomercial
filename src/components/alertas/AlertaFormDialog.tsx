import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertaInput, AlertaWithRelations, ClasificacionSelection } from "@/hooks/useAlertas";
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
  parentAlertaId?: string | null;
  defaultClasificacionId?: string;
  defaultSubclasificacionId?: string;
}

/**
 * Encode a clasificacion/sub pair as a unique string key.
 * "c:{clasificacionId}" for clasificacion-only, "s:{subId}" for a sub.
 */
function encodeKey(clasificacionId: string, subclasificacionId?: string | null): string {
  return subclasificacionId ? `s:${subclasificacionId}` : `c:${clasificacionId}`;
}

export default function AlertaFormDialog({ open, onClose, onSubmit, editTarget, proyectos, empresas, profiles, currentUserId, defaultProyectoId, defaultEmpresaId, defaultTexto, parentAlertaId, defaultClasificacionId, defaultSubclasificacionId }: Props) {
  const [proyectoId, setProyectoId] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [responsableId, setResponsableId] = useState(currentUserId);
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [selectedClasifs, setSelectedClasifs] = useState<Set<string>>(new Set());

  const { data: titulosOpciones } = useTitulosAlerta();
  const { data: clasificaciones } = useClasificacionesAlerta();

  useEffect(() => {
    if (editTarget) {
      setProyectoId(editTarget.proyecto_id);
      setEmpresaId(editTarget.empresa_id || "");
      setTitulo((editTarget as any).titulo || "");
      setTexto(editTarget.texto);
      setResponsableId(editTarget.usuario_responsable_id);
      setFechaSeguimiento(editTarget.fecha_seguimiento);
      // Load from junction table
      const keys = new Set<string>();
      for (const ac of editTarget.alerta_clasificaciones || []) {
        keys.add(encodeKey(ac.clasificacion_id, ac.subclasificacion_id));
      }
      setSelectedClasifs(keys);
    } else {
      setProyectoId(defaultProyectoId || "");
      setEmpresaId(defaultEmpresaId || "");
      setTitulo("");
      setTexto(defaultTexto || "");
      setResponsableId(currentUserId);
      setFechaSeguimiento("");
      // Set default clasificacion if provided
      const keys = new Set<string>();
      if (defaultClasificacionId) {
        keys.add(encodeKey(defaultClasificacionId, defaultSubclasificacionId));
      }
      setSelectedClasifs(keys);
    }
  }, [editTarget, open, currentUserId, defaultClasificacionId, defaultSubclasificacionId]);

  const toggleClasif = (key: string) => {
    setSelectedClasifs(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const buildClasificaciones = (): ClasificacionSelection[] => {
    if (!clasificaciones) return [];
    const result: ClasificacionSelection[] = [];
    for (const key of selectedClasifs) {
      if (key.startsWith("s:")) {
        const subId = key.slice(2);
        // Find parent clasificacion
        const parent = clasificaciones.find(c => c.subclasificaciones.some(s => s.id === subId));
        if (parent) {
          result.push({ clasificacion_id: parent.id, subclasificacion_id: subId });
        }
      } else if (key.startsWith("c:")) {
        const clasifId = key.slice(2);
        result.push({ clasificacion_id: clasifId, subclasificacion_id: null });
      }
    }
    return result;
  };

  const handleSubmit = () => {
    if (!proyectoId || !texto.trim() || !fechaSeguimiento) return;
    const clasificacionesList = buildClasificaciones();
    onSubmit({
      ...(editTarget ? { id: editTarget.id } : {}),
      proyecto_id: proyectoId,
      empresa_id: empresaId && empresaId !== "none" ? empresaId : null,
      titulo: titulo.trim(),
      texto: texto.trim(),
      usuario_responsable_id: responsableId,
      fecha_seguimiento: fechaSeguimiento,
      clasificaciones: clasificacionesList,
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
          {/* Proyecto */}
          <div className="space-y-2">
            <Label>Proyecto *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {proyectoId
                    ? `#${proyectos.find(p => p.id === proyectoId)?.numero} — ${proyectos.find(p => p.id === proyectoId)?.nombre}`
                    : "Seleccionar proyecto"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar proyecto..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      {proyectos.map((p) => (
                        <CommandItem key={p.id} value={`${p.numero} ${p.nombre}`} onSelect={() => setProyectoId(p.id)}>
                          <Check className={cn("mr-2 h-4 w-4", proyectoId === p.id ? "opacity-100" : "opacity-0")} />
                          #{p.numero} — {p.nombre}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Empresa */}
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

          {/* Clasificaciones — Checkboxes */}
          <div className="space-y-2">
            <Label>Clasificaciones</Label>
            <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {clasificaciones && clasificaciones.length > 0 ? (
                clasificaciones.map((c) => (
                  <div key={c.id}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`clasif-${c.id}`}
                        checked={selectedClasifs.has(`c:${c.id}`)}
                        onCheckedChange={() => toggleClasif(`c:${c.id}`)}
                      />
                      <label htmlFor={`clasif-${c.id}`} className="text-sm font-medium cursor-pointer">
                        {c.nombre}
                      </label>
                    </div>
                    {c.subclasificaciones.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1">
                        {c.subclasificaciones.map((s) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`sub-${s.id}`}
                              checked={selectedClasifs.has(`s:${s.id}`)}
                              onCheckedChange={() => toggleClasif(`s:${s.id}`)}
                            />
                            <label htmlFor={`sub-${s.id}`} className="text-xs text-muted-foreground cursor-pointer">
                              ↳ {s.nombre}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No hay clasificaciones configuradas</p>
              )}
            </div>
            {selectedClasifs.size > 0 && (
              <p className="text-xs text-muted-foreground">{selectedClasifs.size} seleccionada(s)</p>
            )}
          </div>

          {/* Texto de Alerta */}
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

          {/* Usuario Responsable */}
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

          {/* Fecha de Seguimiento */}
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
