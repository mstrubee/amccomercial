import { useState } from "react";
import { X, ChevronRight, StickyNote, MapPin, Plus, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNotasModo } from "@/contexts/NotasModoContext";
import { useCrearNota, PRIORIDAD_CONFIG, Prioridad } from "@/hooks/useAdminNotas";
import { toast } from "sonner";

export default function NotasModoPanel() {
  const { modoActivo, desactivarModo, panelAbierto, setPanelAbierto, elementoCapturado, setElementoCapturado } = useNotasModo();
  const crear = useCrearNota();
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [prioridad, setPrioridad] = useState<Prioridad>("media");
  const [minimizado, setMinimizado] = useState(false);

  if (!modoActivo) return null;

  const handleCrear = async () => {
    if (!titulo.trim()) { toast.error("Escribe un título"); return; }
    await crear.mutateAsync({
      titulo,
      contenido,
      prioridad,
      estado: "pendiente",
      elemento_ruta: elementoCapturado?.ruta ?? null,
      elemento_selector: elementoCapturado?.selector ?? null,
      elemento_info: elementoCapturado
        ? { tagName: elementoCapturado.tagName, texto: elementoCapturado.texto, clases: elementoCapturado.clases }
        : null,
      imagenes: [],
    });
    setTitulo("");
    setContenido("");
    setPrioridad("media");
    setElementoCapturado(null);
  };

  if (minimizado) {
    return (
      <div
        data-notas-panel
        className="fixed right-4 top-1/2 -translate-y-1/2 z-[9999] flex flex-col items-center gap-1"
      >
        <button
          onClick={() => setMinimizado(false)}
          className="flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-full shadow-lg hover:bg-orange-600 transition-colors text-sm font-medium"
        >
          <StickyNote className="w-4 h-4" />
          <span>Notas</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={desactivarModo}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <div
      data-notas-panel
      className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border shadow-2xl z-[9999] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-orange-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span className="text-sm font-semibold text-orange-800">Modo Notas activo</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimizado(true)} className="p-1 rounded hover:bg-orange-100 text-orange-600">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={desactivarModo} className="p-1 rounded hover:bg-orange-100 text-orange-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Instrucción */}
        <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
          Haz clic en cualquier elemento de la pantalla para capturarlo y asociarlo a una nota.
        </p>

        {/* Elemento capturado */}
        {elementoCapturado ? (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-orange-700 font-medium">
                <MapPin className="w-3.5 h-3.5" />
                Elemento capturado
              </div>
              <button onClick={() => setElementoCapturado(null)} className="text-orange-400 hover:text-orange-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-orange-600 text-xs">{elementoCapturado.ruta}</p>
            <p className="font-mono text-[10px] text-orange-500 truncate">{elementoCapturado.selector}</p>
            {elementoCapturado.texto && (
              <p className="text-orange-600 text-xs italic truncate">"{elementoCapturado.texto}"</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-orange-200 p-3 text-xs text-center text-orange-400">
            Ningún elemento seleccionado
          </div>
        )}

        {/* Formulario rápido */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nueva nota rápida</p>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título de la nota..."
            className="text-sm"
          />
          <Textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder="Descripción del ajuste o error..."
            className="text-sm min-h-[80px] resize-none"
          />
          <Select value={prioridad} onValueChange={(v) => setPrioridad(v as Prioridad)}>
            <SelectTrigger className="text-sm">
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
          <Button onClick={handleCrear} disabled={crear.isPending} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Guardar nota
          </Button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground text-center">
          Las notas con imágenes se editan desde la sección Notas
        </p>
      </div>
    </div>
  );
}
