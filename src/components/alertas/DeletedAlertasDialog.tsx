import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAllAlertas, useRestoreAlerta, AlertaWithRelations } from "@/hooks/useAlertas";
import { RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function DeletedAlertasDialog({ open, onClose }: Props) {
  const { data: allAlertas, isLoading } = useAllAlertas();
  const restoreAlerta = useRestoreAlerta();

  const deleted = (allAlertas || []).filter(a => a.deleted);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            Alertas Eliminadas ({deleted.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] px-6 pb-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Cargando...</div>
          ) : deleted.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">No hay alertas eliminadas</div>
          ) : (
            <div className="space-y-2">
              {deleted.map(a => {
                const pm = (a as any)._profilesMap || {};
                const deletedByName = a.deleted_by ? (pm[a.deleted_by]?.display_name  || "—") : "—";
                return (
                  <div key={a.id} className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {a.titulo && <div className="font-semibold text-amber-700">{a.titulo}</div>}
                        <div className="text-card-foreground line-through">{a.texto}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {a.proyectos ? `#${a.proyectos.numero} ${a.proyectos.nombre}` : ""}
                          {a.empresas ? ` · ${a.empresas.nombre}` : ""}
                        </div>
                        <div className="text-[10px] text-destructive mt-0.5">
                          Eliminada: {a.deleted_at ? format(new Date(a.deleted_at), "dd MMM yyyy HH:mm", { locale: es }) : "—"} por {deletedByName}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 shrink-0"
                        onClick={() => restoreAlerta.mutate(a.id)}
                        disabled={restoreAlerta.isPending}
                      >
                        <RotateCcw className="w-3 h-3" /> Restaurar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
