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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    console.log(`Processing ${pending.length} pending sync items`);

    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (e) {
      console.error("Cannot get access token, skipping batch:", (e as Error).message);
      return new Response(
        JSON.stringify({ error: "Cannot authenticate with Google", processed: 0 }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        // Mark as uploading
        await admin.from("pending_sync").update({ status: "uploading" }).eq("id", item.id);

        // Download file from bucket
        const { data: fileData, error: dlErr } = await admin.storage
          .from("drive-upload-queue")
          .download(item.storage_path);

        if (dlErr || !fileData) {
          throw new Error(`Failed to download from bucket: ${dlErr?.message || "no data"}`);
        }

        const fileBytes = new Uint8Array(await fileData.arrayBuffer());

        // Upload to Drive
        const metadata = { name: item.file_name, parents: [item.drive_folder_id] };
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
          drive_folder_id: item.drive_folder_id,
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

        console.log(`Synced: ${item.file_name} -> ${uploadData.id}`);
        synced++;
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : "Unknown";
        console.error(`Failed to sync ${item.file_name}: ${errMsg}`);
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

    console.log(`Queue processed: ${synced} synced, ${failed} failed`);
    return new Response(
      JSON.stringify({ message: "Queue processed", synced, failed, processed: pending.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("process-sync-queue error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
