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
      return data as { message: string; created: number; updated: number; skipped: number };
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["project_folders", projectId] });
    },
  });
}

export function useDeleteDriveFolder() {
  return useMutation({
    mutationFn: async ({ driveFolderId }: { driveFolderId: string }) => {
      const { data, error } = await supabase.functions.invoke("sync-drive", {
        body: { action: "delete_folder", drive_folder_id: driveFolderId },
      });
      if (error) throw error;
      return data;
    },
  });
}

export function useUploadToDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, driveFolderId, projectFolderId }: { file: File; driveFolderId: string; projectFolderId: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("drive_folder_id", driveFolderId);
      formData.append("project_folder_id", projectFolderId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No session");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/upload-to-drive`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Upload failed");
      return result as { message: string; file_id?: string; file_name: string; status: string; pending_id?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive_files"] });
      qc.invalidateQueries({ queryKey: ["pending_sync_count"] });
    },
  });
}

export function useDriveFiles(projectFolderId: string | null) {
  return useQuery({
    queryKey: ["drive_files", projectFolderId],
    enabled: !!projectFolderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_files" as any)
        .select("*")
        .eq("project_folder_id", projectFolderId!)
        .order("file_name", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Array<{
        id: string;
        project_folder_id: string;
        drive_file_id: string;
        drive_folder_id: string;
        file_name: string;
        mime_type: string;
        file_size: number;
        created_by: string;
        created_at: string;
      }>;
    },
  });
}

export function useDeleteDriveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driveFileId, driveFilesId }: { driveFileId: string; driveFilesId: string }) => {
      const { data, error } = await supabase.functions.invoke("delete-drive-file", {
        body: { drive_file_id: driveFileId, drive_files_id: driveFilesId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive_files"] });
    },
  });
}

export function useGetDriveViewUrl() {
  return useMutation({
    mutationFn: async ({ driveFileId }: { driveFileId: string }) => {
      const { data, error } = await supabase.functions.invoke("get-drive-view-url", {
        body: { drive_file_id: driveFileId },
      });
      if (error) throw error;
      return data as { web_view_link: string | null; web_content_link: string | null };
    },
  });
}

export function usePendingFilesForFolder(projectFolderId: string | null) {
  return useQuery({
    queryKey: ["pending_files", projectFolderId],
    enabled: !!projectFolderId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_sync" as any)
        .select("*")
        .eq("project_folder_id", projectFolderId!)
        .in("status", ["pending", "failed", "uploading"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Array<{
        id: string;
        file_name: string;
        status: string;
        retry_count: number;
        error_message: string | null;
      }>;
    },
  });
}

export function usePendingSyncCount(projectId: string | null) {
  return useQuery({
    queryKey: ["pending_sync_count", projectId],
    enabled: !!projectId,
    refetchInterval: 10000, // poll every 10s
    queryFn: async () => {
      // Get all project_folder ids for this project
      const { data: folders } = await supabase
        .from("project_folders" as any)
        .select("id")
        .eq("project_id", projectId!);
      
      if (!folders || folders.length === 0) return 0;
      
      const folderIds = (folders as any[]).map((f: any) => f.id);
      
      const { count, error } = await supabase
        .from("pending_sync" as any)
        .select("*", { count: "exact", head: true })
        .in("project_folder_id", folderIds)
        .in("status", ["pending", "failed", "uploading"]);
      
      if (error) throw error;
      return count || 0;
    },
  });
}

export function useProcessSyncQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-sync-queue");
      if (error) throw error;
      return data as { message: string; synced: number; failed: number; processed: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive_files"] });
      qc.invalidateQueries({ queryKey: ["pending_sync_count"] });
    },
  });
}
