import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CalendarDays, Undo2 } from "lucide-react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, startOfDay, addDays } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";

interface Props {
  alerta: AlertaWithRelations | null;
  open: boolean;
  onClose: () => void;
  /** Mark as completed */
  onComplete: (id: string) => void;
  /** Mark as completed and open create dialog */
  onCompleteAndCreate: (alerta: AlertaWithRelations) => void;
  /** Uncomplete an alert (optionally with a new date) */
  onUncomplete?: (id: string, newDate?: string) => void;
  /** Whether this dialog is in "uncomplete" mode */
  mode?: "complete" | "uncomplete";
}

export default function CompleteAlertaDialog({ alerta, open, onClose, onComplete, onCompleteAndCreate, onUncomplete, mode = "complete" }: Props) {
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  if (!alerta) return null;

  const today = startOfDay(new Date());
  const isOverdue = isBefore(parseLocalDate(alerta.fecha_seguimiento), today);
  const needsDate = mode === "uncomplete" && isOverdue;

  const handleClose = () => {
    setNewDate(undefined);
    setCalendarOpen(false);
    onClose();
  };

  if (mode === "uncomplete") {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-amber-600" />
              Reabrir Alerta
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
          {needsDate ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Esta alerta tiene fecha vencida. Debes establecer una nueva fecha de seguimiento futura para reactivarla.
              </p>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "dd MMM yyyy", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={(d) => { setNewDate(d || undefined); setCalendarOpen(false); }}
                    disabled={(date) => isBefore(startOfDay(date), today)}
                    defaultMonth={new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ¿Deseas reabrir esta alerta y marcarla como pendiente?
            </p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              disabled={needsDate && !newDate}
              onClick={() => {
                if (onUncomplete) {
                  const dateStr = newDate ? format(newDate, "yyyy-MM-dd") : undefined;
                  onUncomplete(alerta.id, dateStr);
                }
                handleClose();
              }}
            >
              Reabrir alerta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Default "complete" mode
  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
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
          <Button variant="outline" onClick={() => { onComplete(alerta.id); handleClose(); }}>
            Solo completar
          </Button>
          <Button onClick={() => { onCompleteAndCreate(alerta); handleClose(); }}>
            Completar y crear nueva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
