import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Upload, Loader2, MapPin, Sparkles, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminNota, Prioridad, EstadoNota,
  PRIORIDAD_CONFIG, ESTADO_CONFIG,
  useCrearNota, useActualizarNota, subirImagenNota,
} from "@/hooks/useAdminNotas";
import { ElementoCapturado } from "@/contexts/NotasModoContext";
import { supabase } from "@/integrations/supabase/client";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  nota?: AdminNota | null;
  elementoInicial?: ElementoCapturado | null;
  onCreada?: () => void;
}

const EMPTY: Omit<AdminNota, "id" | "user_id" | "created_at" | "updated_at" | "deleted_at"> = {
  titulo: "",
  contenido: "",
  prioridad: "media",
  estado: "pendiente",
  elemento_ruta: null,
  elemento_selector: null,
  elemento_info: null,
  imagenes: [],
};

export default function NotaDialog({ open, onOpenChange, nota, elementoInicial, onCreada }: Props) {
  const isEdit = !!nota;
  const crear = useCrearNota();
  const actualizar = useActualizarNota();
  const [form, setForm] = useState(() =>
    nota
      ? {
          titulo: nota.titulo,
          contenido: nota.contenido,
          prioridad: nota.prioridad,
          estado: nota.estado,
          elemento_ruta: nota.elemento_ruta,
          elemento_selector: nota.elemento_selector,
          elemento_info: nota.elemento_info,
          imagenes: nota.imagenes ?? [],
        }
      : {
          ...EMPTY,
          elemento_ruta: elementoInicial?.ruta ?? null,
          elemento_selector: elementoInicial?.selector ?? null,
          elemento_info: elementoInicial
            ? { tagName: elementoInicial.tagName, texto: elementoInicial.texto, clases: elementoInicial.clases }
            : null,
        }
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mejorando, setMejorando] = useState(false);
  const [previoContenido, setPrevioContenido] = useState<string | null>(null);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleMejorarIA = async () => {
    if (!form.contenido.trim()) { toast.error("Escribe una descripción primero"); return; }
    setMejorando(true);
    try {
      const { data, error } = await supabase.functions.invoke("mejorar-descripcion-nota", {
        body: { descripcion: form.contenido },
      });
      if (error) throw error;
      setPrevioContenido(form.contenido);
      set("contenido", data.result);
    } catch (err) {
      toast.error(await extractEdgeFunctionError(err, "No se pudo mejorar la descripción"));
    } finally {
      setMejorando(false);
    }
  };

  const handleDeshacer = () => {
    if (previoContenido === null) return;
    set("contenido", previoContenido);
    setPrevioContenido(null);
  };

  const handleImages = async (files: FileList) => {
    setUploading(true);
    try {
      const urls = await Promise.all(Array.from(files).map(subirImagenNota));
      set("imagenes", [...form.imagenes, ...urls]);
    } catch {
      toast.error("Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => set("imagenes", form.imagenes.filter((u) => u !== url));

  const handleSubmit = async () => {
    if (!form.titulo.trim()) { toast.error("El título es obligatorio"); return; }
    if (isEdit) {
      await actualizar.mutateAsync({ id: nota!.id, ...form });
    } else {
      await crear.mutateAsync(form);
      onCreada?.();
    }
    onOpenChange(false);
  };

  const isBusy = crear.isPending || actualizar.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar nota" : "Nueva nota"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Elemento capturado */}
          {form.elemento_ruta && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm">
              <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-medium text-orange-800">Elemento capturado</p>
                <p className="text-orange-600 truncate">{form.elemento_ruta}</p>
                <p className="text-orange-500 font-mono text-xs truncate">{form.elemento_selector}</p>
                {form.elemento_info?.texto && (
                  <p className="text-orange-600 text-xs mt-1 italic">"{form.elemento_info.texto}"</p>
                )}
              </div>
              <button onClick={() => { set("elemento_ruta", null); set("elemento_selector", null); set("elemento_info", null); }} className="shrink-0 text-orange-400 hover:text-orange-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Describe brevemente el ajuste..." className="mt-1" />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Descripción</Label>
              <div className="flex items-center gap-1">
                {previoContenido !== null && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleDeshacer} className="h-7 gap-1 text-xs text-muted-foreground">
                    <Undo2 className="w-3.5 h-3.5" />
                    Deshacer
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={handleMejorarIA} disabled={mejorando} className="h-7 gap-1.5 text-xs">
                  {mejorando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {mejorando ? "Mejorando..." : "Mejorar con IA"}
                </Button>
              </div>
            </div>
            <Textarea value={form.contenido} onChange={(e) => set("contenido", e.target.value)} placeholder="Detalla el problema o mejora..." className="mt-1 min-h-[100px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridad</Label>
              <Select value={form.prioridad} onValueChange={(v) => set("prioridad", v as Prioridad)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRIORIDAD_CONFIG) as [Prioridad, typeof PRIORIDAD_CONFIG[Prioridad]][]).map(([k, c]) => (
                    <SelectItem key={k} value={k}>
                      <span className={cn("font-medium", c.color)}>{c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => set("estado", v as EstadoNota)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ESTADO_CONFIG) as [EstadoNota, typeof ESTADO_CONFIG[EstadoNota]][]).map(([k, c]) => (
                    <SelectItem key={k} value={k}>
                      <span className={cn("font-medium", c.color)}>{c.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Imágenes */}
          <div>
            <Label>Imágenes adjuntas</Label>
            <div className="mt-2 space-y-2">
              {form.imagenes.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {form.imagenes.map((url) => (
                    <div key={url} className="relative group rounded-lg overflow-hidden border aspect-video bg-muted">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(url)}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Subiendo..." : "Adjuntar imagen"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && handleImages(e.target.files)} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isBusy}>
              {isBusy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Guardar cambios" : "Crear nota"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
