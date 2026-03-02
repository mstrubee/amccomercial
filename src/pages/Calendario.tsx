import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Unplug } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useGoogleCalendar, type CalendarEvent } from "@/hooks/useGoogleCalendar";
import CalendarGrid from "@/components/calendario/CalendarGrid";
import CalendarEventDialog from "@/components/calendario/CalendarEventDialog";

export default function Calendario() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    isConnected, checkingConnection, connecting, connect, disconnect,
    events, loadingEvents,
    createEvent, updateEvent, deleteEvent,
    isCreating, isUpdating, isDeleting,
  } = useGoogleCalendar(currentMonth);

  // Handle redirect back from OAuth
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleDayClick = (date: Date) => {
    setSelectedEvent(null);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(null);
    setDialogOpen(true);
  };

  if (checkingConnection) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
          <p className="text-sm text-muted-foreground">Tu calendario personal de Google</p>
        </div>
        {isConnected && (
          <Button variant="outline" size="sm" onClick={() => disconnect()} className="text-destructive hover:text-destructive">
            <Unplug className="w-4 h-4 mr-1.5" />
            Desconectar
          </Button>
        )}
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 border border-dashed border-border rounded-lg">
          <CalendarDays className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">Conecta tu Google Calendar</h2>
            <p className="text-sm text-muted-foreground mt-1">Vincula tu cuenta de Google para ver y gestionar tus eventos</p>
          </div>
          <Button onClick={connect} disabled={connecting}>
            {connecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarDays className="w-4 h-4 mr-2" />}
            Conectar Google Calendar
          </Button>
        </div>
      ) : (
        <>
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: es })}
            </h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {loadingEvents ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CalendarGrid
              currentMonth={currentMonth}
              events={events}
              onDayClick={handleDayClick}
              onEventClick={handleEventClick}
            />
          )}
        </>
      )}

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        selectedDate={selectedDate}
        onSave={createEvent}
        onUpdate={updateEvent}
        onDelete={deleteEvent}
        isSaving={isCreating || isUpdating || isDeleting}
      />
    </div>
  );
}
