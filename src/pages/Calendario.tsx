import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Unplug, Copy, AlertTriangle, Info } from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { useGoogleCalendar, type CalendarEvent } from "@/hooks/useGoogleCalendar";
import CalendarGrid from "@/components/calendario/CalendarGrid";
import CalendarEventDialog from "@/components/calendario/CalendarEventDialog";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function Calendario() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const {
    isConnected, checkingConnection, connecting, connect, disconnect,
    events, loadingEvents,
    createEvent, updateEvent, deleteEvent,
    isCreating, isUpdating, isDeleting,
    oauthConfig,
  } = useGoogleCalendar(currentMonth);

  // Handle redirect back from OAuth — success or error
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast({ title: "✅ Google Calendar conectado", description: "Tu cuenta se vinculó correctamente." });
      setSearchParams({}, { replace: true });
    }

    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      const detail = searchParams.get("oauth_detail") || "";
      const errorMessages: Record<string, string> = {
        access_denied: "Denegaste el acceso a Google Calendar.",
        redirect_uri_mismatch: "Error de configuración: el Redirect URI no coincide en Google Cloud.",
        token_exchange_failed: "No se pudo obtener el token de Google.",
        missing_params: "Faltan parámetros en la respuesta de Google.",
        db_error: "Error guardando las credenciales.",
      };
      toast({
        title: "Error de conexión OAuth",
        description: errorMessages[oauthError] || `${oauthError}${detail ? `: ${detail}` : ""}`,
        variant: "destructive",
      });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
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
        <div className="space-y-4">
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

          {/* OAuth diagnostics panel */}
          {oauthConfig && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-2">
                  <Info className="w-4 h-4" />
                  Diagnóstico de configuración OAuth
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30 text-sm">
                  <p className="font-medium text-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Si recibes error 403, verifica que este Redirect URI esté configurado <strong>exacto</strong> en Google Cloud Console:
                  </p>
                  <div className="flex items-center gap-2 bg-background border border-border rounded px-3 py-2">
                    <code className="flex-1 text-xs break-all text-foreground">{oauthConfig.redirect_uri}</code>
                    <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => copyToClipboard(oauthConfig.redirect_uri)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Client ID: <code>{oauthConfig.client_id_masked}</code>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Pasos: Google Cloud Console → APIs & Services → Credentials → Tu OAuth Client → Authorized redirect URIs → Pega el URI exacto de arriba.
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
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
