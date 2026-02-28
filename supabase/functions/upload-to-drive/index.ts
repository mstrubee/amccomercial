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
    console.error("Token refresh failed:", JSON.stringify(data));
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const driveFolderId = formData.get("drive_folder_id") as string | null;

    if (!file) {
      throw new Error("No file provided");
    }
    if (!driveFolderId) {
      throw new Error("No drive_folder_id provided");
    }

    console.log(`Uploading "${file.name}" (${file.size} bytes) to Drive folder ${driveFolderId}`);

    const accessToken = await getAccessToken();

    // Build multipart upload for Google Drive API
    const metadata = {
      name: file.name,
      parents: [driveFolderId],
    };

    const boundary = "----LovableBoundary" + Date.now();
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const filePart = `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
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
      console.error("Drive upload failed:", JSON.stringify(uploadData));
      throw new Error(`Upload failed: ${uploadData.error?.message || "Unknown error"}`);
    }

    console.log(`File uploaded successfully: ${uploadData.id}`);

    return new Response(
      JSON.stringify({
        message: "Archivo subido exitosamente",
        file_id: uploadData.id,
        file_name: file.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("upload-to-drive error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: message === "NO_REFRESH_TOKEN" ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
