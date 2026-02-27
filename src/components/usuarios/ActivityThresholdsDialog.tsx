import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUpsertThreshold, type ActivityThreshold } from "@/hooks/useActivityThresholds";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  userName: string;
  current?: ActivityThreshold;
}

export default function ActivityThresholdsDialog({ open, onOpenChange, userId, userName, current }: Props) {
  const [idle, setIdle] = useState(5);
  const [offline, setOffline] = useState(15);
  const upsert = useUpsertThreshold();

  useEffect(() => {
    if (open) {
      setIdle(current?.idle_minutes ?? 5);
      setOffline(current?.offline_minutes ?? 15);
    }
  }, [open, current]);

  const handleSave = () => {
    if (offline <= idle) {
      toast.error("El umbral de desconexión debe ser mayor al de inactividad");
      return;
    }
    upsert.mutate(
      { user_id: userId, idle_minutes: idle, offline_minutes: offline },
      {
        onSuccess: () => {
          toast.success("Umbrales actualizados");
          onOpenChange(false);
        },
        onError: () => toast.error("Error al guardar"),
      }
    );
  };

  const handleReset = () => {
    setIdle(5);
    setOffline(15);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Umbrales de Actividad — {userName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configura cuántos minutos sin interacción definen cada estado.
          </p>
          <div className="space-y-1">
            <Label className="text-sm">Minutos para estado Inactivo (amarillo)</Label>
            <Input
              type="number"
              min={1}
              value={idle}
              onChange={(e) => setIdle(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Minutos para estado Desconectado (rojo)</Label>
            <Input
              type="number"
              min={2}
              value={offline}
              onChange={(e) => setOffline(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Restaurar valores
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={upsert.isPending}>
                {upsert.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
