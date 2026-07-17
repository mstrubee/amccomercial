import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_RETRIES = 5;

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials not configured");

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single();

  if (!setting?.value) throw new Error("NO_REFRESH_TOKEN");

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
  if (!resp.ok) throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  return data.access_token;
}

/** Verify a Drive folder exists */
async function verifyDriveFolder(accessToken: string, folderId: string): Promise<boolean> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,trashed`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return false;
  const data = await resp.json();
  return !data.trashed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: this function runs with service_role and previously had NO auth at
    // all (verify_jwt=false), leaving privileged queue processing open to the
    // internet. Require either an authenticated user (the app invokes it with
    // the user's JWT) or a valid cron secret for scheduled runs.
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedCronSecret = Deno.env.get("SYNC_QUEUE_CRON_SECRET");
    let authorized = false;
    if (expectedCronSecret && cronSecret === expectedCronSecret) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (user) authorized = true;
      }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get pending items
    const { data: pending, error: fetchErr } = await admin
      .from("pending_sync")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("retry_count", MAX_RETRIES)
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending items", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[QUEUE] Processing ${pending.length} pending sync items`);

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (e) {
      console.error("[QUEUE] Cannot get access token, skipping batch:", (e as Error).message);
      return new Response(
        JSON.stringify({ error: "Cannot authenticate with Google", processed: 0 }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        // Atomically claim this item before doing any work. The initial
        // fetch above (status IN pending/failed) is a plain SELECT, so two
        // overlapping invocations of this function (e.g. the "online" retry
        // and the periodic queue poll firing close together) could both read
        // the same row before either writes to it. This conditional UPDATE
        // only succeeds for whichever caller gets there first — Postgres
        // guarantees mutual exclusion on the row — so a second caller sees
        // zero rows affected and skips the item instead of uploading it again.
        const { data: claimed, error: claimErr } = await admin
          .from("pending_sync")
          .update({ status: "uploading" })
          .eq("id", item.id)
          .in("status", ["pending", "failed"])
          .select();

        if (claimErr) throw claimErr;
        if (!claimed || claimed.length === 0) {
          console.log(`[QUEUE] Skipping "${item.file_name}" — already claimed by another sync in progress`);
          continue;
        }

        // Check if drive_folder_id is valid — if not, try to get updated one from project_folders
        let targetFolderId = item.drive_folder_id;
        
        if (targetFolderId) {
          const folderOk = await verifyDriveFolder(accessToken, targetFolderId);
          if (!folderOk) {
            console.log(`[QUEUE] Drive folder ${targetFolderId} not found for "${item.file_name}". Checking for updated folder ID...`);
            // Try to get updated drive_folder_id from project_folders
            const { data: folder } = await admin
              .from("project_folders")
              .select("drive_folder_id")
              .eq("id", item.project_folder_id)
              .single();
            
            if (folder?.drive_folder_id && folder.drive_folder_id !== targetFolderId) {
              targetFolderId = folder.drive_folder_id;
              console.log(`[QUEUE] Found updated folder ID: ${targetFolderId}`);
              // Update pending_sync with new folder ID
              await admin.from("pending_sync").update({ drive_folder_id: targetFolderId }).eq("id", item.id);
              
              // Re-verify the new folder
              const newFolderOk = await verifyDriveFolder(accessToken, targetFolderId);
              if (!newFolderOk) {
                throw new Error("DRIVE_FOLDER_NOT_FOUND: Updated folder ID also invalid");
              }
            } else {
              throw new Error("DRIVE_FOLDER_NOT_FOUND: No valid folder ID available");
            }
          }
        } else {
          // No drive_folder_id at all — try to get from project_folders
          const { data: folder } = await admin
            .from("project_folders")
            .select("drive_folder_id")
            .eq("id", item.project_folder_id)
            .single();
          
          if (folder?.drive_folder_id) {
            targetFolderId = folder.drive_folder_id;
            await admin.from("pending_sync").update({ drive_folder_id: targetFolderId }).eq("id", item.id);
          } else {
            throw new Error("DRIVE_FOLDER_NOT_FOUND: Folder not yet synced to Drive");
          }
        }

        // Download file from bucket
        const { data: fileData, error: dlErr } = await admin.storage
          .from("drive-upload-queue")
          .download(item.storage_path);

        if (dlErr || !fileData) {
          throw new Error(`Failed to download from bucket: ${dlErr?.message || "no data"}`);
        }

        const fileBytes = new Uint8Array(await fileData.arrayBuffer());

        // Upload to Drive
        const metadata = { name: item.file_name, parents: [targetFolderId] };
        const boundary = "----SyncBoundary" + Date.now();
        const encoder = new TextEncoder();
        const metaPart = encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`);
        const filePart = encoder.encode(`--${boundary}\r\nContent-Type: ${item.mime_type}\r\n\r\n`);
        const endPart = encoder.encode(`\r\n--${boundary}--`);

        const body = new Uint8Array(metaPart.length + filePart.length + fileBytes.length + endPart.length);
        body.set(metaPart, 0);
        body.set(filePart, metaPart.length);
        body.set(fileBytes, metaPart.length + filePart.length);
        body.set(endPart, metaPart.length + filePart.length + fileBytes.length);

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
          throw new Error(`Drive upload failed: ${uploadData.error?.message || "Unknown"}`);
        }

        // Success: insert drive_files, update pending_sync, delete from bucket
        await admin.from("drive_files").insert({
          project_folder_id: item.project_folder_id,
          drive_file_id: uploadData.id,
          drive_folder_id: targetFolderId,
          file_name: item.file_name,
          mime_type: item.mime_type,
          file_size: item.file_size,
          created_by: item.created_by,
        });

        await admin
          .from("pending_sync")
          .update({ status: "synced", drive_file_id: uploadData.id, synced_at: new Date().toISOString() })
          .eq("id", item.id);

        await admin.storage.from("drive-upload-queue").remove([item.storage_path]);

        console.log(`[QUEUE] Synced: ${item.file_name} -> ${uploadData.id}`);
        synced++;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "Unknown";
        console.error(`[QUEUE] Failed to sync ${item.file_name}: ${errMsg}`);
        await admin
          .from("pending_sync")
          .update({
            status: "failed",
            error_message: errMsg,
            retry_count: (item.retry_count || 0) + 1,
          })
          .eq("id", item.id);
        failed++;
      }
    }

    console.log(`[QUEUE] Processed: ${synced} synced, ${failed} failed`);
    return new Response(
      JSON.stringify({ message: "Queue processed", synced, failed, processed: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[QUEUE] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
