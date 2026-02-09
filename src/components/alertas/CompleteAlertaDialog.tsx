import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { AlertaWithRelations } from "@/hooks/useAlertas";

interface Props {
  alerta: AlertaWithRelations | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => void;
  onCompleteAndCreate: (alerta: AlertaWithRelations) => void;
}

export default function CompleteAlertaDialog({ alerta, open, onClose, onComplete, onCompleteAndCreate }: Props) {
  if (!alerta) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Completar Alerta
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-2">
          {(alerta as any).titulo && (
            <div className="text-sm font-semibold text-amber-700">{(alerta as any).titulo}</div>
          )}
          <p className="text-sm text-card-foreground">{alerta.texto}</p>
          <p className="text-xs text-muted-foreground">
            Proyecto: {alerta.proyectos?.nombre || "—"}
            {alerta.empresas?.nombre && ` · Empresa: ${alerta.empresas.nombre}`}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          ¿Deseas crear una nueva alerta de seguimiento para esta misma línea?
        </p>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => { onComplete(alerta.id); onClose(); }}>
            Solo completar
          </Button>
          <Button onClick={() => { onCompleteAndCreate(alerta); onClose(); }}>
            Completar y crear nueva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
