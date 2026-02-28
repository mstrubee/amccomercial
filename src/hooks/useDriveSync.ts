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

export function useUploadToDrive() {
  return useMutation({
    mutationFn: async ({ file, driveFolderId }: { file: File; driveFolderId: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("drive_folder_id", driveFolderId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No session");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-to-drive`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Upload failed");
      return result as { message: string; file_id: string; file_name: string };
    },
  });
}
