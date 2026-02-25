import { useState, useEffect } from "react";
import { useThemeSettings, useSaveThemeSetting, ThemeSettings } from "@/hooks/useThemeSettings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RotateCcw, Save, Palette } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Poppins", label: "Poppins" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
];

const DEFAULTS: ThemeSettings = {
  theme_sidebar_bg: "",
  theme_sidebar_text: "",
  theme_accent_color: "",
  theme_font_family: "Inter",
};

export default function PersonalizacionPage() {
  const { data: settings, isLoading } = useThemeSettings();
  const saveMutation = useSaveThemeSetting();

  const [local, setLocal] = useState<ThemeSettings>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

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

  const handleSave = async () => {
    try {
      const entries = Object.entries(local) as [keyof ThemeSettings, string][];
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
      const entries = Object.entries(DEFAULTS) as [keyof ThemeSettings, string][];
      for (const [key, value] of entries) {
        await saveMutation.mutateAsync({ key, value });
      }
      setDirty(false);
      toast.success("Valores restaurados a los predeterminados");
    } catch {
      toast.error("Error al restaurar valores");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Palette className="w-6 h-6" />
          Personalización
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura los colores del sidebar y la tipografía del sistema.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Color settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Colores del Sidebar</CardTitle>
            <CardDescription>Personaliza los colores del menú lateral</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Color de fondo</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={local.theme_sidebar_bg || "#1e2a3a"}
                  onChange={(e) => update("theme_sidebar_bg", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {local.theme_sidebar_bg || "Predeterminado"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color de texto</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={local.theme_sidebar_text || "#b0bec5"}
                  onChange={(e) => update("theme_sidebar_text", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {local.theme_sidebar_text || "Predeterminado"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color de acento (items activos)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={local.theme_accent_color || "#e6a817"}
                  onChange={(e) => update("theme_accent_color", e.target.value)}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-mono">
                  {local.theme_accent_color || "Predeterminado"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Font + Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tipografía</CardTitle>
            <CardDescription>Fuente global del sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Familia de fuente</Label>
              <Select value={local.theme_font_family || "Inter"} onValueChange={(v) => update("theme_font_family", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Live preview */}
            <div className="mt-4 space-y-2">
              <Label className="text-xs text-muted-foreground">Vista previa del sidebar</Label>
              <div
                className="rounded-lg p-4 space-y-2 border"
                style={{
                  backgroundColor: local.theme_sidebar_bg || "#1e2a3a",
                  color: local.theme_sidebar_text || "#b0bec5",
                  fontFamily: `'${local.theme_font_family || "Inter"}', sans-serif`,
                }}
              >
                <div className="text-xs font-bold opacity-70">AMC</div>
                <div className="text-sm opacity-60">Dashboard</div>
                <div
                  className="text-sm px-2 py-1 rounded"
                  style={{
                    backgroundColor: local.theme_accent_color ? `${local.theme_accent_color}33` : "rgba(230,168,23,0.2)",
                    color: local.theme_sidebar_text || "#b0bec5",
                  }}
                >
                  Proyectos (activo)
                </div>
                <div className="text-sm opacity-60">Finanzas</div>
                <div className="text-sm opacity-60">Alertas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saveMutation.isPending}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Restaurar predeterminados
        </Button>
      </div>
    </div>
  );
}
