import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export interface ActivityThreshold {
  id: string;
  user_id: string;
  idle_minutes: number;
  offline_minutes: number;
}

const DEFAULT_IDLE = 5;
const DEFAULT_OFFLINE = 15;

export function useActivityThresholds() {
  return useQuery<ActivityThreshold[]>({
    queryKey: ["activity-thresholds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_activity_thresholds")
        .select("id, user_id, idle_minutes, offline_minutes");
      return (data as ActivityThreshold[]) || [];
    },
  });
}

export function useUpsertThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { user_id: string; idle_minutes: number; offline_minutes: number }) => {
      const { error } = await supabase
        .from("user_activity_thresholds")
        .upsert(
          { user_id: input.user_id, idle_minutes: input.idle_minutes, offline_minutes: input.offline_minutes, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-thresholds"] }),
  });
}

export interface ProfilePresence {
  user_id: string;
  display_name: string;
  email: string;
  last_seen_at: string | null;
  activity_status: string | null;
  current_section: string | null;
}

export interface ActivityStatus {
  color: string;
  text: string;
  pulse: boolean;
}

export function getActivityStatus(
  profile: ProfilePresence,
  thresholds: ActivityThreshold[] | undefined
): ActivityStatus {
  const t = thresholds?.find((th) => th.user_id === profile.user_id);
  const idleMs = (t?.idle_minutes ?? DEFAULT_IDLE) * 60 * 1000;
  const offlineMs = (t?.offline_minutes ?? DEFAULT_OFFLINE) * 60 * 1000;

  if (!profile.last_seen_at) {
    return { color: "bg-gray-400", text: "Sin actividad registrada", pulse: false };
  }

  const diff = Date.now() - new Date(profile.last_seen_at).getTime();

  if (diff > offlineMs) {
    return {
      color: "bg-destructive",
      text: `Visto: ${format(new Date(profile.last_seen_at), "dd/MM/yyyy HH:mm", { locale: es })}`,
      pulse: false,
    };
  }

  if (diff > idleMs || profile.activity_status === "idle") {
    return { color: "bg-amber-400", text: "Detenido", pulse: false };
  }

  return {
    color: "bg-green-500",
    text: `Trabajando en ${profile.current_section || "..."}`,
    pulse: true,
  };
}
