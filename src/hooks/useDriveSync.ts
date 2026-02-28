import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useDriveAuthStatus() {
  return useQuery({
    queryKey: ["drive_auth_status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-auth-callback", {
        body: { action: "check_status" },
      });
      if (error) throw error;
      return data as { connected: boolean };
    },
  });
}

export function useGetDriveAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("google-auth-callback", {
        body: { action: "get_auth_url" },
      });
      if (error) throw error;
      return data as { auth_url: string };
    },
  });
}

export function useSyncDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      const { data, error } = await supabase.functions.invoke("sync-drive", {
        body: { action: "sync", project_id: projectId, project_name: projectName },
      });
      if (error) throw error;
      return data as { message: string; created: number; skipped: number };
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["project_folders", projectId] });
    },
  });
}
