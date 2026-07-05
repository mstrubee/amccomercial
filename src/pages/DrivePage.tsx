import { HardDrive, CheckCircle2, XCircle, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDriveAuthStatus, useGetDriveAuthUrl } from "@/hooks/useDriveSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export default function DrivePage() {
  const { data: driveStatus, isLoading, refetch } = useDriveAuthStatus();
  const getAuthUrl = useGetDriveAuthUrl();
  const [deduplicating, setDeduplicating] = useState(false);

  const handleConnect = async () => {
    try {
      const result = await getAuthUrl.mutateAsync();
      window.open(result.auth_url, "_blank", "width=600,height=700");
      toast.info("Completa la autenticación en la ventana abierta, luego actualiza el estado.");
    } catch (e: any) {
      toast.error("Error al obtener URL de autenticación: " + e.message);
    }
  };

  const handleDeduplicate = async () => {
    setDeduplicating(true);
    try {
      const { data: folderResult, error: folderError } = await supabase.functions.invoke("sync-drive", {
        body: { action: "deduplicate" },
      });
      if (folderError) throw folderError;
      if (folderResult.details?.length > 0) {
        console.log("[DEDUP] Folder details:", folderResult.details);
      }

      const { data: fileResult, error: fileError } = await supabase.functions.invoke("sync-drive", {
        body: { action: "deduplicate_files" },
      });
      if (fileError) throw fileError;
      if (fileResult.details?.length > 0) {
        console.log("[DEDUP] File details:", fileResult.details);
      }

      toast.success(
        `${folderResult.trashed || 0} carpeta(s) y ${fileResult.trashed || 0} archivo(s) duplicado(s) eliminados`
      );
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setDeduplicating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Drive</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestión de la conexión con Google Drive para la sincronización de repositorios.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDrive className="w-5 h-5" />
            Google Drive
          </CardTitle>
          <CardDescription>
            Estado de la conexión utilizada para sincronizar carpetas y archivos de los repositorios de proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Verificando conexión...</span>
            </div>
          ) : driveStatus?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Conectado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Google Drive está vinculado correctamente. Los repositorios de proyecto se sincronizan automáticamente.
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar estado
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleConnect}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  Reconectar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={handleDeduplicate}
                  disabled={deduplicating}
                >
                  {deduplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Limpiar duplicados
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1.5 text-orange-600 border-orange-200 bg-orange-50">
                  <XCircle className="w-3.5 h-3.5" />
                  No conectado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Google Drive no está vinculado. Conéctalo para habilitar la sincronización automática de repositorios.
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleConnect} disabled={getAuthUrl.isPending}>
                  {getAuthUrl.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Conectar Google Drive
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualizar estado
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
