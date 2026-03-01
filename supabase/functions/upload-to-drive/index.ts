import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single();

  if (!setting?.value) {
    throw new Error("NO_REFRESH_TOKEN");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: setting.value,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("[UPLOAD] Token refresh failed:", JSON.stringify(data));
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

/** Verify a Drive folder exists and is accessible */
async function verifyDriveFolder(accessToken: string, folderId: string): Promise<boolean> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,trashed`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return false;
  const data = await resp.json();
  return !data.trashed;
}

async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  fileBytes: Uint8Array,
  mimeType: string,
  driveFolderId: string
): Promise<{ id: string; name: string }> {
  const metadata = { name: fileName, parents: [driveFolderId] };
  const boundary = "----LovableBoundary" + Date.now();
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
  const filePart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const endPart = `\r\n--${boundary}--`;

  const encoder = new TextEncoder();
  const metaBytes = encoder.encode(metaPart);
  const filePartBytes = encoder.encode(filePart);
  const endBytes = encoder.encode(endPart);

  const body = new Uint8Array(metaBytes.length + filePartBytes.length + fileBytes.length + endBytes.length);
  body.set(metaBytes, 0);
  body.set(filePartBytes, metaBytes.length);
  body.set(fileBytes, metaBytes.length + filePartBytes.length);
  body.set(endBytes, metaBytes.length + filePartBytes.length + fileBytes.length);

  const uploadResp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const uploadData = await uploadResp.json();
  if (!uploadResp.ok) {
    console.error("[UPLOAD] Drive upload failed:", JSON.stringify(uploadData));
    throw new Error(`Upload failed: ${uploadData.error?.message || "Unknown error"}`);
  }
  return { id: uploadData.id, name: uploadData.name || fileName };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const driveFolderId = formData.get("drive_folder_id") as string | null;
    const projectFolderId = formData.get("project_folder_id") as string | null;

    if (!file) throw new Error("No file provided");
    if (!driveFolderId) throw new Error("No drive_folder_id provided");
    if (!projectFolderId) throw new Error("No project_folder_id provided");

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    // Sanitize filename for Supabase Storage (only allow alphanumeric, dash, underscore, dot)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}_${safeName}`;

    console.log(`[UPLOAD] "${file.name}" (${file.size} bytes) to folder ${driveFolderId} (project_folder: ${projectFolderId})`);

    // Step 1: Save to Supabase bucket
    const { error: storageErr } = await admin.storage
      .from("drive-upload-queue")
      .upload(storagePath, fileBytes, { contentType: file.type || "application/octet-stream" });

    if (storageErr) {
      console.error("[UPLOAD] Storage upload failed:", storageErr.message);
      throw new Error("Failed to save file to queue: " + storageErr.message);
    }

    // Step 2: Register in pending_sync
    const { data: pendingRow, error: pendingErr } = await admin
      .from("pending_sync")
      .insert({
        project_folder_id: projectFolderId,
        drive_folder_id: driveFolderId,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: storagePath,
        status: "pending",
        created_by: user.id,
      })
      .select()
      .single();

    if (pendingErr) {
      console.error("[UPLOAD] pending_sync insert failed:", pendingErr.message);
      await admin.storage.from("drive-upload-queue").remove([storagePath]);
      throw new Error("Failed to register in queue");
    }

    // Step 3: Try immediate Drive upload
    try {
      const accessToken = await getAccessToken();

      // Verify target folder exists before uploading
      const folderOk = await verifyDriveFolder(accessToken, driveFolderId);
      if (!folderOk) {
        console.warn(`[UPLOAD] Drive folder ${driveFolderId} not found/trashed. File queued for retry after folder sync.`);
        await admin
          .from("pending_sync")
          .update({ status: "failed", error_message: "DRIVE_FOLDER_NOT_FOUND", retry_count: 1 })
          .eq("id", pendingRow.id);

        return new Response(
          JSON.stringify({
            message: "Carpeta de destino no encontrada en Drive — archivo en cola",
            file_name: file.name,
            status: "folder_not_found",
            pending_id: pendingRow.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const driveResult = await uploadFileToDrive(accessToken, file.name, fileBytes, file.type || "application/octet-stream", driveFolderId);

      // Success: save to drive_files, mark synced, remove from bucket
      await admin.from("drive_files").insert({
        project_folder_id: projectFolderId,
        drive_file_id: driveResult.id,
        drive_folder_id: driveFolderId,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        created_by: user.id,
      });

      await admin
        .from("pending_sync")
        .update({ status: "synced", drive_file_id: driveResult.id, synced_at: new Date().toISOString() })
        .eq("id", pendingRow.id);

      await admin.storage.from("drive-upload-queue").remove([storagePath]);

      console.log(`[UPLOAD] File synced immediately: ${driveResult.id}`);

      return new Response(
        JSON.stringify({
          message: "Archivo subido exitosamente",
          file_id: driveResult.id,
          file_name: file.name,
          status: "synced",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (driveErr: unknown) {
      const errMsg = driveErr instanceof Error ? driveErr.message : "Unknown";
      console.warn(`[UPLOAD] Immediate Drive upload failed, queued for retry: ${errMsg}`);

      await admin
        .from("pending_sync")
        .update({ status: "failed", error_message: errMsg, retry_count: 1 })
        .eq("id", pendingRow.id);

      return new Response(
        JSON.stringify({
          message: "Archivo guardado en cola de sincronización",
          file_name: file.name,
          status: "pending",
          pending_id: pendingRow.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[UPLOAD] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: message === "NO_REFRESH_TOKEN" ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
