import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AlertaInput, AlertaWithRelations, ClasificacionSelection } from "@/hooks/useAlertas";
import { useTitulosAlerta } from "@/hooks/useTitulosAlerta";
import { useClasificacionesAlerta } from "@/hooks/useClasificacionesAlerta";
import { useCategorias } from "@/hooks/useCategorias";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

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

export default function AlertaFormDialog({ open, onClose, onSubmit, editTarget, proyectos, empresas, profiles, currentUserId, defaultProyectoId, defaultEmpresaId, defaultTexto, parentAlertaId, defaultClasificacionId, defaultSubclasificacionId }: Props) {
  const [proyectoId, setProyectoId] = useState("");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [responsableId, setResponsableId] = useState(currentUserId);
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [clasificacionId, setClasificacionId] = useState<string>("");
  const [subclasificacionId, setSubclasificacionId] = useState<string>("");
  const [categoriaProyectoId, setCategoriaProyectoId] = useState<string>("");
  const [subcategoriaProyectoId, setSubcategoriaProyectoId] = useState<string>("");

  const { data: titulosOpciones } = useTitulosAlerta();
  const { data: clasificaciones } = useClasificacionesAlerta();
  const { data: categoriasProyecto } = useCategorias();

  // Fetch current category from proyecto_empresas when both are selected
  useEffect(() => {
    if (!proyectoId || !empresaId || empresaId === "none") {
      setCategoriaProyectoId("");
      setSubcategoriaProyectoId("");
      return;
    }
    // Don't override if editing and already loaded
    if (editTarget) return;

    const fetchPE = async () => {
      const { data } = await supabase
        .from("proyecto_empresas")
        .select("categoria_id, subcategoria_id")
        .eq("proyecto_id", proyectoId)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (data) {
        setCategoriaProyectoId(data.categoria_id || "");
        setSubcategoriaProyectoId(data.subcategoria_id || "");
      } else {
        setCategoriaProyectoId("");
        setSubcategoriaProyectoId("");
      }
    };
    fetchPE();
  }, [proyectoId, empresaId]);

  useEffect(() => {
    if (editTarget) {
      setProyectoId(editTarget.proyecto_id);
      setEmpresaId(editTarget.empresa_id || "");
      setTitulo((editTarget as any).titulo || "");
      setTexto(editTarget.texto);
      setResponsableId(editTarget.usuario_responsable_id);
      setFechaSeguimiento(editTarget.fecha_seguimiento);
      const first = editTarget.alerta_clasificaciones?.[0];
      setClasificacionId(first?.clasificacion_id || "");
      setSubclasificacionId(first?.subclasificacion_id || "");
      // Load commercial category from alert or fetch from PE
      setCategoriaProyectoId((editTarget as any).categoria_proyecto_id || "");
      setSubcategoriaProyectoId((editTarget as any).subcategoria_proyecto_id || "");
      // If alert doesn't have category stored, fetch from proyecto_empresas
      if (!(editTarget as any).categoria_proyecto_id && editTarget.empresa_id) {
        supabase
          .from("proyecto_empresas")
          .select("categoria_id, subcategoria_id")
          .eq("proyecto_id", editTarget.proyecto_id)
          .eq("empresa_id", editTarget.empresa_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setCategoriaProyectoId(data.categoria_id || "");
              setSubcategoriaProyectoId(data.subcategoria_id || "");
            }
          });
      }
    } else {
      setProyectoId(defaultProyectoId || "");
      setEmpresaId(defaultEmpresaId || "");
      setTitulo("");
      setTexto(defaultTexto || "");
      setResponsableId(currentUserId);
      setFechaSeguimiento("");
      setClasificacionId(defaultClasificacionId || "");
      setSubclasificacionId(defaultSubclasificacionId || "");
      setCategoriaProyectoId("");
      setSubcategoriaProyectoId("");
    }
  }, [editTarget, open, currentUserId, defaultClasificacionId, defaultSubclasificacionId]);

  const selectedClasif = clasificaciones?.find(c => c.id === clasificacionId);
  const selectedCatProy = categoriasProyecto?.find(c => c.id === categoriaProyectoId);
  const showCategoriaComercial = proyectoId && empresaId && empresaId !== "none";

  const handleSubmit = () => {
    if (!proyectoId || !texto.trim() || !fechaSeguimiento) return;
    const clasificacionesList: ClasificacionSelection[] = clasificacionId
      ? [{ clasificacion_id: clasificacionId, subclasificacion_id: subclasificacionId || null }]
      : [];
    onSubmit({
      ...(editTarget ? { id: editTarget.id } : {}),
      proyecto_id: proyectoId,
      empresa_id: empresaId && empresaId !== "none" ? empresaId : null,
      titulo: titulo.trim(),
      texto: texto.trim(),
      usuario_responsable_id: responsableId,
      fecha_seguimiento: fechaSeguimiento,
      clasificaciones: clasificacionesList,
      categoria_proyecto_id: categoriaProyectoId || null,
      subcategoria_proyecto_id: subcategoriaProyectoId || null,
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

          {/* Categoría Comercial — only when proyecto + empresa selected */}
          {showCategoriaComercial && (
            <>
              <div className="space-y-2">
                <Label>Categoría Comercial</Label>
                <Select value={categoriaProyectoId} onValueChange={(v) => { setCategoriaProyectoId(v === "none" ? "" : v); setSubcategoriaProyectoId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {categoriasProyecto?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCatProy && selectedCatProy.subcategorias_proyecto.length > 0 && (
                <div className="space-y-2">
                  <Label>Sub-categoría Comercial</Label>
                  <Select value={subcategoriaProyectoId} onValueChange={(v) => setSubcategoriaProyectoId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Sin sub-categoría" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sub-categoría</SelectItem>
                      {selectedCatProy.subcategorias_proyecto.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.nombre}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Clasificación — Single Select */}
          <div className="space-y-2">
            <Label>Clasificación</Label>
            <Select value={clasificacionId} onValueChange={(v) => { setClasificacionId(v === "none" ? "" : v); setSubclasificacionId(""); }}>
              <SelectTrigger><SelectValue placeholder="Sin clasificación" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin clasificación</SelectItem>
                {clasificaciones?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-clasificación — conditional */}
          {selectedClasif && selectedClasif.subclasificaciones.length > 0 && (
            <div className="space-y-2">
              <Label>Sub-clasificación</Label>
              <Select value={subclasificacionId} onValueChange={(v) => setSubclasificacionId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin sub-clasificación" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin sub-clasificación</SelectItem>
                  {selectedClasif.subclasificaciones.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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
