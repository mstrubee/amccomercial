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

    const { drive_file_id } = await req.json();
    if (!drive_file_id) throw new Error("drive_file_id is required");

    const accessToken = await getAccessToken();

    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${drive_file_id}?supportsAllDrives=true&fields=webViewLink,webContentLink`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(`Drive API error: ${data.error?.message || "Unknown"}`);
    }

    return new Response(
      JSON.stringify({
        web_view_link: data.webViewLink || null,
        web_content_link: data.webContentLink || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("get-drive-view-url error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
