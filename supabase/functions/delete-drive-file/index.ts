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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { drive_file_id, drive_files_id } = await req.json();
    if (!drive_file_id || !drive_files_id) {
      throw new Error("drive_file_id and drive_files_id are required");
    }

    const accessToken = await getAccessToken();

    // Delete from Google Drive
    const delResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${drive_file_id}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!delResp.ok && delResp.status !== 404) {
      const errData = await delResp.json().catch(() => ({}));
      console.error("Drive delete failed:", JSON.stringify(errData));
      throw new Error(`Drive delete failed: ${(errData as any).error?.message || delResp.statusText}`);
    }

    // Consume response body if any
    if (delResp.status !== 204) {
      await delResp.text();
    }

    // Delete from drive_files table
    const admin = createClient(supabaseUrl, serviceRoleKey);
    await admin.from("drive_files").delete().eq("id", drive_files_id);

    console.log(`Deleted drive file: ${drive_file_id}`);

    return new Response(
      JSON.stringify({ message: "Archivo eliminado exitosamente" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("delete-drive-file error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
