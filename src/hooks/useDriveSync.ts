import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function decodeJwtPayload(token: string): { sub?: string; role?: string } | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function getAuthenticatedAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const claims = token ? decodeJwtPayload(token) : null;
  if (!token || !claims?.sub || claims.role === "anon") return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return token;
}

async function invokeGoogleAuthCallback<T>(body: Record<string, unknown>) {
  const accessToken = await getAuthenticatedAccessToken();
  if (!accessToken) return { data: null, unauthorized: true } as const;

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-auth-callback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => ({}));
  if (response.status === 401) return { data: null, unauthorized: true } as const;
  if (!response.ok) throw new Error(result?.error || `Error ${response.status}`);
  return { data: result as T, unauthorized: false } as const;
}

export function useDriveAuthStatus() {
  return useQuery({
    queryKey: ["drive_auth_status"],
    queryFn: async () => {
      const result = await invokeGoogleAuthCallback<{ connected: boolean }>({ action: "check_status" });
      if (result.unauthorized || !result.data) return { connected: false };
      return result.data;
    },
    retry: false,
  });
}

export function useGetDriveAuthUrl() {
  return useMutation({
    mutationFn: async () => {
      const result = await invokeGoogleAuthCallback<{ auth_url: string }>({ action: "get_auth_url" });
      if (result.unauthorized || !result.data) throw new Error("Sesión no autenticada. Vuelve a iniciar sesión.");
      return result.data;
    },
  });
}

export function useGetProjectDriveId() {
  return useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      const { data, error } = await supabase.functions.invoke("sync-drive", {
        body: { action: "get_project_drive_id", project_id: projectId, project_name: projectName },
      });
      if (error) throw error;
      return data as { drive_folder_id: string };
    },
  });
}

export function useReverseSyncDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      const { data, error } = await supabase.functions.invoke("sync-drive", {
        body: { action: "reverse_sync", project_id: projectId, project_name: projectName },
      });
      if (error) throw error;
      return data as { message: string; folders_added: number; folders_removed: number; files_added: number; files_removed: number };
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["project_folders", projectId] });
      qc.invalidateQueries({ queryKey: ["drive_files"] });
    },
  });
}

export function useSyncDrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      // First sync folders (system -> Drive)
      const { data, error } = await supabase.functions.invoke("sync-drive", {
        body: { action: "sync", project_id: projectId, project_name: projectName },
      });
      if (error) throw error;

      // Then repair any orphaned files
      try {
        await supabase.functions.invoke("sync-drive", {
          body: { action: "repair_orphaned_files", project_id: projectId },
        });
      } catch (e) {
        console.warn("[SYNC] Orphaned file repair failed (non-critical):", e);
      }

      // Then reverse sync (Drive -> system)
      try {
        await supabase.functions.invoke("sync-drive", {
          body: { action: "reverse_sync", project_id: projectId, project_name: projectName },
        });
      } catch (e) {
        console.warn("[SYNC] Reverse sync failed (non-critical):", e);
      }

      return data as { message: string; created: number; updated: number; skipped: number };
    },
    onSuccess: (_, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["project_folders", projectId] });
      qc.invalidateQueries({ queryKey: ["drive_files"] });
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

/**
 * Automatic background reconciliation: calls reverse_sync silently
 * on mount, on window focus, and every `intervalMs` while enabled.
 */
export function useAutoReconcileDrive(
  projectId: string | null,
  projectName: string,
  enabled: boolean,
  intervalMs = 30000
) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["auto_reconcile_drive", projectId],
    enabled: enabled && !!projectId,
    refetchInterval: intervalMs,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    // Avoid showing stale data indicators — this is a side-effect query
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-drive", {
        body: { action: "reverse_sync", project_id: projectId, project_name: projectName },
      });
      if (error) throw error;
      const result = data as { folders_added: number; folders_removed: number; files_added: number; files_removed: number };
      // Only invalidate if something changed
      const hasChanges = result.folders_added > 0 || result.folders_removed > 0 || result.files_added > 0 || result.files_removed > 0;
      if (hasChanges) {
        qc.invalidateQueries({ queryKey: ["project_folders", projectId] });
        qc.invalidateQueries({ queryKey: ["drive_files"] });
        console.log(`[AUTO_RECONCILE] Changes detected: +${result.folders_added}/-${result.folders_removed} folders, +${result.files_added}/-${result.files_removed} files`);
      }
      return { ...result, timestamp: Date.now() };
    },
    // Don't retry aggressively for background sync
    retry: 1,
  });
}
