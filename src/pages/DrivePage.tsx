import { HardDrive, CheckCircle2, XCircle, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDriveAuthStatus, useGetDriveAuthUrl } from "@/hooks/useDriveSync";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRef, useState } from "react";
import DriveDedupPanel, { DedupProgressState, DuplicateItem } from "@/components/repositorio/DriveDedupPanel";

export default function DrivePage() {
  const { data: driveStatus, isLoading, refetch } = useDriveAuthStatus();
  const getAuthUrl = useGetDriveAuthUrl();
  const [dedupState, setDedupState] = useState<DedupProgressState | null>(null);
  // Checked between items in the deletion loop below. A ref (not state) so
  // "Detener"/"Cancelar" take effect immediately without waiting for a
  // re-render, and so the in-flight loop closure always reads the latest value.
  const stopRequestedRef = useRef(false);

  const handleConnect = async () => {
    try {
      const result = await getAuthUrl.mutateAsync();
      window.open(result.auth_url, "_blank", "width=600,height=700");
      toast.info("Completa la autenticación en la ventana abierta, luego actualiza el estado.");
    } catch (e: any) {
      toast.error("Error al obtener URL de autenticación: " + e.message);
    }
  };

  // Processes `items` sequentially, starting the visible counter at
  // `alreadyProcessed` (nonzero when resuming a previously stopped run).
  // Stops cleanly between items (never mid-request) when "Detener"/"Cancelar"
  // is pressed, preserving the untouched items for "Reanudar".
  const runDeletionLoop = async (items: DuplicateItem[], alreadyProcessed: number, needsReview: number) => {
    let processed = alreadyProcessed;
    for (let i = 0; i < items.length; i++) {
      if (stopRequestedRef.current) {
        const remainingItems = items.slice(i);
        setDedupState({ status: "stopped", total: processed + remainingItems.length, processed, needsReview, remainingItems });
        return;
      }

      const item = items[i];
      setDedupState((prev) => (prev ? { ...prev, currentName: item.name } : prev));
      const { error: trashError } = await supabase.functions.invoke("sync-drive", {
        body: { action: "trash_duplicate_item", type: item.type, drive_id: item.drive_id, keeper_id: item.keeper_id },
      });
      if (trashError) console.error("[DEDUP] Failed to remove item:", item.name, trashError);
      processed++;
      setDedupState((prev) => (prev ? { ...prev, processed } : prev));
    }

    setDedupState((prev) => (prev ? { ...prev, status: "done", currentName: undefined, remainingItems: undefined } : prev));
    toast.success(`${processed} duplicado(s) eliminado(s)`);
  };

  const handleDeduplicate = async () => {
    stopRequestedRef.current = false;
    setDedupState({ status: "analyzing", total: 0, processed: 0, needsReview: 0 });
    try {
      let cursor: number | null = 0;
      let analyzed = 0;
      let scanTotal = 0;
      const items: DuplicateItem[] = [];
      let needsReview = 0;

      while (cursor !== null) {
        const { data: analysis, error: analyzeError } = await supabase.functions.invoke("sync-drive", {
          body: { action: "analyze_duplicates", cursor, limit: 10 },
        });
        if (analyzeError) throw analyzeError;
        if (stopRequestedRef.current) { setDedupState(null); return; } // cancelled while analyzing

        items.push(...((analysis.items || []) as DuplicateItem[]));
        needsReview += analysis.needs_review?.length || 0;
        analyzed = analysis.analyzed || analyzed;
        scanTotal = analysis.scan_total || scanTotal;
        setDedupState({ status: "analyzing", total: scanTotal, processed: analyzed, needsReview });
        cursor = analysis.complete ? null : analysis.cursor;
      }

      setDedupState({ status: "running", total: items.length, processed: 0, needsReview });
      await runDeletionLoop(items, 0, needsReview);
    } catch (e: any) {
      toast.error("Error: " + e.message);
      setDedupState(null);
    }
  };

  const handleResume = () => {
    if (!dedupState?.remainingItems) return;
    stopRequestedRef.current = false;
    const { remainingItems, processed, needsReview } = dedupState;
    setDedupState((prev) => (prev ? { ...prev, status: "running", currentName: undefined } : prev));
    runDeletionLoop(remainingItems, processed, needsReview);
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
  };

  const handleCancel = () => {
    stopRequestedRef.current = true;
    setDedupState(null);
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
                  disabled={!!dedupState && dedupState.status !== "done"}
                >
                  {dedupState && (dedupState.status === "analyzing" || dedupState.status === "running") ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
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

      {dedupState && (
        <DriveDedupPanel
          state={dedupState}
          onClose={() => setDedupState(null)}
          onStop={handleStop}
          onCancel={handleCancel}
          onResume={handleResume}
          onReanalyze={handleDeduplicate}
        />
      )}
    </div>
  );
}
