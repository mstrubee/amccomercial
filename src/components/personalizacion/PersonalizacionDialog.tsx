import { useState, useEffect, useRef } from "react";
import { useThemeSettings, useSaveThemeSetting, ThemeSettings, ThemeKey } from "@/hooks/useThemeSettings";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RotateCcw, Save, Upload, Trash2, Image } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
];

const POSITION_OPTIONS = [
  { value: "bottom-right", label: "Inferior derecha" },
  { value: "bottom-left", label: "Inferior izquierda" },
  { value: "top-right", label: "Superior derecha" },
  { value: "top-left", label: "Superior izquierda" },
];

const FLOATING_CORNERS = [
  // corners
  "top-left", "top-right", "bottom-left", "bottom-right",
  // left side
  "upper-left", "middle-left", "lower-left",
  // right side
  "upper-right", "middle-right", "lower-right",
  // bottom edge
  "bottom-center-left", "bottom-center", "bottom-center-right",
] as const;
type FloatingCorner = (typeof FLOATING_CORNERS)[number];

const DEFAULTS: ThemeSettings = {
  theme_sidebar_bg: "",
  theme_sidebar_text: "",
  theme_accent_color: "",
  theme_font_family: "Inter",
  theme_custom_font_url: "",
  theme_company_logo: "",
  theme_background_color: "",
  theme_alert_position: "bottom-right",
  theme_floating_position: "bottom-left",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PersonalizacionDialog({ open, onOpenChange }: Props) {
  const { data: settings, isLoading } = useThemeSettings();
  const saveMutation = useSaveThemeSetting();
  const [local, setLocal] = useState<ThemeSettings>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const floatingPreviewRef = useRef<HTMLDivElement>(null);
  const [isDraggingFloating, setIsDraggingFloating] = useState(false);
  const [floatingDragPosition, setFloatingDragPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (settings) {
      setLocal(settings);
      setDirty(false);
    }
  }, [settings]);

  const update = (key: keyof ThemeSettings, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const getFloatingCornerPosition = (corner: FloatingCorner): React.CSSProperties => {
    const leftInset = 44;
    const rightInset = 12;
    const topInset = 12;
    const bottomInset = 12;

    const positions: Record<FloatingCorner, React.CSSProperties> = {
      "top-left": { left: leftInset, top: topInset },
      "top-right": { right: rightInset, top: topInset },
      "bottom-left": { left: leftInset, bottom: bottomInset },
      "bottom-right": { right: rightInset, bottom: bottomInset },
      "upper-left": { left: leftInset, top: "30%" },
      "middle-left": { left: leftInset, top: "50%", transform: "translateY(-50%)" },
      "lower-left": { left: leftInset, top: "70%" },
      "upper-right": { right: rightInset, top: "30%" },
      "middle-right": { right: rightInset, top: "50%", transform: "translateY(-50%)" },
      "lower-right": { right: rightInset, top: "70%" },
      "bottom-center-left": { left: "30%", bottom: bottomInset },
      "bottom-center": { left: "50%", bottom: bottomInset, transform: "translateX(-50%)" },
      "bottom-center-right": { left: "70%", bottom: bottomInset },
    };
    return positions[corner] || positions["bottom-left"];
  };

  const updateFloatingDragFromPointer = (clientX: number, clientY: number) => {
    const preview = floatingPreviewRef.current;
    if (!preview) return;

    const rect = preview.getBoundingClientRect();
    const bubbleSize = 38;

    const x = Math.max(0, Math.min(clientX - rect.left - bubbleSize / 2, rect.width - bubbleSize));
    const y = Math.max(0, Math.min(clientY - rect.top - bubbleSize / 2, rect.height - bubbleSize));

    setFloatingDragPosition({ x, y });
  };

  useEffect(() => {
    if (!isDraggingFloating) return;

    const handlePointerMove = (event: PointerEvent) => {
      updateFloatingDragFromPointer(event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      const preview = floatingPreviewRef.current;
      if (!preview || !floatingDragPosition) {
        setIsDraggingFloating(false);
        setFloatingDragPosition(null);
        return;
      }

      const rect = preview.getBoundingClientRect();
      const cx = floatingDragPosition.x + 19;
      const cy = floatingDragPosition.y + 19;

      // Snap to nearest corner/position
      const targets: { pos: FloatingCorner; x: number; y: number }[] = [
        { pos: "top-left", x: 44, y: 12 },
        { pos: "top-right", x: rect.width - 12, y: 12 },
        { pos: "bottom-left", x: 44, y: rect.height - 12 },
        { pos: "bottom-right", x: rect.width - 12, y: rect.height - 12 },
        { pos: "upper-left", x: 44, y: rect.height * 0.3 },
        { pos: "middle-left", x: 44, y: rect.height * 0.5 },
        { pos: "lower-left", x: 44, y: rect.height * 0.7 },
        { pos: "upper-right", x: rect.width - 12, y: rect.height * 0.3 },
        { pos: "middle-right", x: rect.width - 12, y: rect.height * 0.5 },
        { pos: "lower-right", x: rect.width - 12, y: rect.height * 0.7 },
        { pos: "bottom-center-left", x: rect.width * 0.3, y: rect.height - 12 },
        { pos: "bottom-center", x: rect.width * 0.5, y: rect.height - 12 },
        { pos: "bottom-center-right", x: rect.width * 0.7, y: rect.height - 12 },
      ];
      let nearest = targets[0];
      let minDist = Infinity;
      for (const t of targets) {
        const d = Math.hypot(cx - t.x, cy - t.y);
        if (d < minDist) { minDist = d; nearest = t; }
      }
      update("theme_floating_position", nearest.pos);

      setIsDraggingFloating(false);
      setFloatingDragPosition(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingFloating, floatingDragPosition]);

  const handleSave = async () => {
    try {
      const entries = Object.entries(local) as [ThemeKey, string][];
      for (const [key, value] of entries) {
        await saveMutation.mutateAsync({ key, value });
      }
      setDirty(false);
      toast.success("Personalización guardada correctamente");
    } catch {
      toast.error("Error al guardar la personalización");
    }
  };

  const handleReset = async () => {
    setLocal(DEFAULTS);
    try {
      const entries = Object.entries(DEFAULTS) as [ThemeKey, string][];
      for (const [key, value] of entries) {
        await saveMutation.mutateAsync({ key, value });
      }
      setDirty(false);
      toast.success("Valores restaurados a los predeterminados");
    } catch {
      toast.error("Error al restaurar valores");
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;
      // Remove old logo first
      await supabase.storage.from("company-assets").remove([path]);
      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
      const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      update("theme_company_logo", logoUrl);
      // Save immediately
      await saveMutation.mutateAsync({ key: "theme_company_logo", value: logoUrl });
      toast.success("Logo subido correctamente");
    } catch (err: any) {
      toast.error(err.message || "Error al subir el logo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteLogo = async () => {
    try {
      // Try to remove files
      const { data: files } = await supabase.storage.from("company-assets").list();
      if (files?.length) {
        await supabase.storage.from("company-assets").remove(files.map(f => f.name));
      }
      update("theme_company_logo", "");
      await saveMutation.mutateAsync({ key: "theme_company_logo", value: "" });
      toast.success("Logo eliminado");
    } catch {
      toast.error("Error al eliminar el logo");
    }
  };

  // Extract custom font name from URL for display
  const customFontName = local.theme_custom_font_url
    ? decodeURIComponent(local.theme_custom_font_url).match(/family=([^:&]+)/)?.[1]?.replace(/\+/g, " ") || ""
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Personalización</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="colores" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="colores">Colores</TabsTrigger>
              <TabsTrigger value="tipografia">Tipografía</TabsTrigger>
              <TabsTrigger value="logo">Logo</TabsTrigger>
              <TabsTrigger value="alertas">Alertas</TabsTrigger>
              <TabsTrigger value="flotantes">Flotantes</TabsTrigger>
            </TabsList>

            {/* Colores Tab */}
            <TabsContent value="colores" className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Color de fondo del sidebar</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={local.theme_sidebar_bg || "#1e2a3a"} onChange={(e) => update("theme_sidebar_bg", e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                    <span className="text-xs text-muted-foreground font-mono">{local.theme_sidebar_bg || "Predeterminado"}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Color de texto del sidebar</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={local.theme_sidebar_text || "#b0bec5"} onChange={(e) => update("theme_sidebar_text", e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                    <span className="text-xs text-muted-foreground font-mono">{local.theme_sidebar_text || "Predeterminado"}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Color de acento (items activos)</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={local.theme_accent_color || "#e6a817"} onChange={(e) => update("theme_accent_color", e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                    <span className="text-xs text-muted-foreground font-mono">{local.theme_accent_color || "Predeterminado"}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Color de fondo del sistema</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={local.theme_background_color || "#f5f6fa"} onChange={(e) => update("theme_background_color", e.target.value)} className="w-9 h-9 rounded-lg border border-border cursor-pointer" />
                    <span className="text-xs text-muted-foreground font-mono">{local.theme_background_color || "Predeterminado"}</span>
                    {local.theme_background_color && (
                      <Button variant="ghost" size="sm" onClick={() => update("theme_background_color", "")} className="h-7 text-xs">Limpiar</Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vista previa del sidebar</Label>
                <div className="rounded-lg p-3 space-y-1.5 border" style={{ backgroundColor: local.theme_sidebar_bg || "#1e2a3a", color: local.theme_sidebar_text || "#b0bec5", fontFamily: `'${local.theme_font_family || "Inter"}', sans-serif` }}>
                  <div className="text-xs font-bold opacity-70">AMC</div>
                  <div className="text-sm opacity-60">Dashboard</div>
                  <div className="text-sm px-2 py-1 rounded" style={{ backgroundColor: local.theme_accent_color ? `${local.theme_accent_color}33` : "rgba(230,168,23,0.2)" }}>
                    Proyectos (activo)
                  </div>
                  <div className="text-sm opacity-60">Finanzas</div>
                </div>
              </div>
            </TabsContent>

            {/* Tipografía Tab */}
            <TabsContent value="tipografia" className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Familia de fuente</Label>
                  <Select value={local.theme_font_family || "Inter"} onValueChange={(v) => update("theme_font_family", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                        </SelectItem>
                      ))}
                      {customFontName && !FONT_OPTIONS.some(f => f.value === customFontName) && (
                        <SelectItem value={customFontName}>
                          <span style={{ fontFamily: `'${customFontName}', sans-serif` }}>{customFontName} (importada)</span>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Importar fuente personalizada (Google Fonts URL)</Label>
                  <Input
                    placeholder="https://fonts.googleapis.com/css2?family=Nunito..."
                    value={local.theme_custom_font_url}
                    onChange={(e) => update("theme_custom_font_url", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Pega la URL del &lt;link&gt; de Google Fonts. La fuente aparecerá como opción en el selector.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Logo Tab */}
            <TabsContent value="logo" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm">Logo de la empresa</Label>
                {local.theme_company_logo ? (
                  <div className="flex items-center gap-4">
                    <img src={local.theme_company_logo} alt="Logo" className="w-16 h-16 rounded-lg object-cover border border-border" />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Cambiar
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDeleteLogo} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 border border-dashed border-border rounded-lg p-6">
                    <Image className="w-8 h-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">No hay logo configurado</p>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                      Subir logo
                    </Button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} />
                <p className="text-[11px] text-muted-foreground">El logo se mostrará en el sidebar y en la pantalla de inicio de sesión.</p>
              </div>
            </TabsContent>

            {/* Alertas Tab */}
            <TabsContent value="alertas" className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Posición del widget de alertas</Label>
                <Select value={local.theme_alert_position || "bottom-right"} onValueChange={(v) => update("theme_alert_position", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITION_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Define la esquina donde aparece el widget flotante de alertas.</p>
              </div>
            </TabsContent>

            {/* Flotantes Tab */}
            <TabsContent value="flotantes" className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm">Posición de botones flotantes (Chat y Usuarios)</Label>
                <p className="text-[11px] text-muted-foreground">Arrastra el botón de muestra y suéltalo en la esquina deseada. Aplica para todos los usuarios.</p>

                <div
                  ref={floatingPreviewRef}
                  className="relative w-full aspect-[16/10] border border-border rounded-lg bg-muted/30 overflow-hidden select-none"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-muted/60 border-r border-border" />

                  {FLOATING_CORNERS.map((pos) => {
                    const isSelected = (local.theme_floating_position || "bottom-left") === pos;
                    const styles = getFloatingCornerPosition(pos);

                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => update("theme_floating_position", pos)}
                        className={`absolute w-6 h-6 rounded-full border transition-all ${
                          isSelected
                            ? "bg-primary border-primary ring-2 ring-primary/30"
                            : "bg-card border-border hover:bg-secondary"
                        }`}
                        style={styles}
                        aria-label={`Mover flotantes a ${pos}`}
                      />
                    );
                  })}

                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setIsDraggingFloating(true);
                      updateFloatingDragFromPointer(event.clientX, event.clientY);
                    }}
                    className="absolute w-9 h-9 rounded-full bg-primary text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center"
                    style={
                      isDraggingFloating && floatingDragPosition
                        ? { left: floatingDragPosition.x, top: floatingDragPosition.y }
                        : getFloatingCornerPosition((local.theme_floating_position || "bottom-left") as FloatingCorner)
                    }
                    aria-label="Arrastrar botones flotantes"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                    </span>
                  </button>

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground/50">Drag & drop</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending} size="sm">
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Guardar
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={saveMutation.isPending}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Restaurar
              </Button>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
