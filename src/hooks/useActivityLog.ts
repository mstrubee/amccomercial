import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLogActivity() {
  return useMutation({
    mutationFn: async (input: {
      action: string;
      entity_type: string;
      entity_id?: string;
      entity_name?: string;
      details?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // silently skip if not authenticated
      await supabase.from("activity_log").insert({
        user_id: user.id,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id || null,
        entity_name: input.entity_name || "",
        details: input.details || "",
      } as any);
    },
  });
}

export function useActivityLog(filters: { date?: string; userId?: string }) {
  return useQuery({
    queryKey: ["activity_log", filters.date, filters.userId],
    queryFn: async () => {
      let query = (supabase.from("activity_log") as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.date) {
        const start = filters.date + "T00:00:00";
        const end = filters.date + "T23:59:59";
        query = query.gte("created_at", start).lte("created_at", end);
      }
      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useRetentionSetting() {
  return useQuery({
    queryKey: ["app_settings", "activity_log_retention_days"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("app_settings") as any)
        .select("value")
        .eq("key", "activity_log_retention_days")
        .single();
      if (error) throw error;
      return parseInt(data.value) || 90;
    },
  });
}

export function useUpdateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (days: number) => {
      const { error } = await (supabase.from("app_settings") as any)
        .update({ value: String(days), updated_at: new Date().toISOString() })
        .eq("key", "activity_log_retention_days");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
  });
}

export function useCleanupActivityLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("cleanup-activity-log");
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activity_log"] });
    },
  });
}
