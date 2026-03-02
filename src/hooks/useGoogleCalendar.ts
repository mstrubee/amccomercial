import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

export interface OAuthConfig {
  redirect_uri: string;
  client_id_masked: string;
}

async function invokeCalendarAuth(action: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await supabase.functions.invoke("google-calendar-auth", {
    body: { action },
  });
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

async function invokeCalendarApi(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await supabase.functions.invoke("google-calendar-api", {
    body: { action, ...params },
  });
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function useGoogleCalendar(currentMonth: Date) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);

  const { data: connectionStatus, isLoading: checkingConnection } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => invokeCalendarAuth("check_status"),
    staleTime: 60_000,
  });

  const isConnected = connectionStatus?.connected === true;

  // Fetch OAuth config for diagnostics
  const { data: oauthConfig } = useQuery<OAuthConfig>({
    queryKey: ["google-calendar-config"],
    queryFn: () => invokeCalendarAuth("get_config"),
    staleTime: 300_000,
  });

  const timeMin = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
  const timeMax = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: eventsData, isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["google-calendar-events", timeMin, timeMax],
    queryFn: () => invokeCalendarApi("list_events", { timeMin, timeMax }),
    enabled: isConnected,
    staleTime: 30_000,
  });

  const events: CalendarEvent[] = eventsData?.events || [];

  const connect = async () => {
    setConnecting(true);
    try {
      const data = await invokeCalendarAuth("get_auth_url");
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: () => invokeCalendarAuth("disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      queryClient.removeQueries({ queryKey: ["google-calendar-events"] });
      toast({ title: "Desconectado", description: "Google Calendar desconectado exitosamente." });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (event: Record<string, unknown>) => invokeCalendarApi("create_event", { event }),
    onSuccess: () => {
      refetchEvents();
      toast({ title: "Evento creado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al crear evento", description: err.message, variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ eventId, event }: { eventId: string; event: Record<string, unknown> }) =>
      invokeCalendarApi("update_event", { eventId, event }),
    onSuccess: () => {
      refetchEvents();
      toast({ title: "Evento actualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al actualizar", description: err.message, variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => invokeCalendarApi("delete_event", { eventId }),
    onSuccess: () => {
      refetchEvents();
      toast({ title: "Evento eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    },
  });

  return {
    isConnected,
    checkingConnection,
    connecting,
    connect,
    disconnect: disconnectMutation.mutate,
    events,
    loadingEvents,
    refetchEvents,
    oauthConfig: oauthConfig || null,
    createEvent: createEventMutation.mutate,
    updateEvent: updateEventMutation.mutate,
    deleteEvent: deleteEventMutation.mutate,
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
}
