import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function IntegracionIADialog({ open, onOpenChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setShowKey(false);
    supabase.functions.invoke("manage-ai-provider-keys", { body: { action: "get", provider: "gemini" } })
      .then(({ data, error }) => {
        if (error) { toast.error("Error al cargar la configuración"); return; }
        setApiKey(data?.apiKey || "");
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    if (!apiKey.trim()) { toast.error("Ingresa una clave"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-ai-provider-keys", {
        body: { action: "save", provider: "gemini", apiKey },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Clave de Gemini guardada");
      onOpenChange(false);
    } catch {
      toast.error("Error al guardar la clave");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Integración IA — Gemini</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Clave de la API de Google Gemini. Se usa para el botón "Mejorar con IA" en Notas del sistema.
          </p>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Clave API</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
