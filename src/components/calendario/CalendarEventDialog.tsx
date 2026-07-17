import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import type { CalendarEvent } from "@/hooks/useGoogleCalendar";
import { format } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  selectedDate?: Date | null;
  onSave: (data: Record<string, unknown>) => void;
  onUpdate: (data: { eventId: string; event: Record<string, unknown> }) => void;
  onDelete: (eventId: string) => void;
  isSaving: boolean;
}

export default function CalendarEventDialog({ open, onOpenChange, event, selectedDate, onSave, onUpdate, onDelete, isSaving }: Props) {
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");

  const isEditing = !!event;

  useEffect(() => {
    if (event) {
      setSummary(event.summary || "");
      setDescription(event.description || "");
      const s = event.start.dateTime || event.start.date || "";
      const e = event.end.dateTime || event.end.date || "";
      if (s) {
        // All-day events carry a date-only string; parseLocalDate avoids the
        // UTC off-by-one that would load (and later re-save) the previous day.
        const sd = parseLocalDate(s);
        setStartDate(format(sd, "yyyy-MM-dd"));
        setStartTime(format(sd, "HH:mm"));
      }
      if (e) {
        const ed = parseLocalDate(e);
        setEndDate(format(ed, "yyyy-MM-dd"));
        setEndTime(format(ed, "HH:mm"));
      }
    } else if (selectedDate) {
      const d = format(selectedDate, "yyyy-MM-dd");
      setStartDate(d);
      setEndDate(d);
      setSummary("");
      setDescription("");
      setStartTime("09:00");
      setEndTime("10:00");
    }
  }, [event, selectedDate, open]);

  const handleSave = () => {
    if (!summary.trim()) return;
    // Guard the date fields: a type=date input can be left empty, and
    // `new Date("T09:00:00")` is Invalid Date whose .toISOString() throws
    // RangeError, killing the save silently.
    if (!startDate || !endDate) {
      toast.error("Ingresa la fecha de inicio y de fin");
      return;
    }
    const startISO = new Date(`${startDate}T${startTime || "00:00"}:00`);
    const endISO = new Date(`${endDate}T${endTime || "00:00"}:00`);
    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      toast.error("Fecha u hora inválida");
      return;
    }

    const eventData = {
      summary: summary.trim(),
      description: description.trim(),
      start: { dateTime: startISO.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endISO.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    };

    if (isEditing && event) {
      onUpdate({ eventId: event.id, event: eventData });
    } else {
      onSave(eventData);
    }
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (event) {
      onDelete(event.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Evento" : "Nuevo Evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="summary">Título</Label>
            <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Nombre del evento" />
          </div>
          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha inicio</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Hora inicio</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Hora fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {isEditing && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSaving}>
              <Trash2 className="w-4 h-4 mr-1" /> Eliminar
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!summary.trim() || isSaving}>
              {isEditing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
