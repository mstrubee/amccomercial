import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://amccomercial.lovable.app";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-auth`;

function redirectWithError(errorCode: string, detail?: string): Response {
  const params = new URLSearchParams({ oauth_error: errorCode });
  if (detail) params.set("oauth_detail", detail);
  return new Response(null, {
    status: 302,
    headers: { Location: `${APP_BASE_URL}/calendario?${params}`, ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET = OAuth callback from Google
    if (req.method === "GET") {
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      console.log("[calendar-auth] Callback received", { hasCode: !!code, hasState: !!state, error });

      if (error) {
        console.error("[calendar-auth] Google returned error:", error);
        return redirectWithError(error);
      }

      if (!code || !state) {
        console.error("[calendar-auth] Missing code or state");
        return redirectWithError("missing_params");
      }

      const userId = state;

      // Exchange code for tokens
      console.log("[calendar-auth] Exchanging code for tokens...");
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || (!tokenData.refresh_token && !tokenData.access_token)) {
        console.error("[calendar-auth] Token exchange failed:", {
          status: tokenRes.status,
          error: tokenData.error,
          error_description: tokenData.error_description,
        });
        return redirectWithError(
          tokenData.error || "token_exchange_failed",
          tokenData.error_description || "No se pudieron obtener tokens de Google"
        );
      }

      console.log("[calendar-auth] Token exchange successful, saving...");

      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      const { error: dbError } = await supabaseAdmin
        .from("user_google_tokens")
        .upsert(
          {
            user_id: userId,
            refresh_token: tokenData.refresh_token || "",
            access_token: tokenData.access_token || "",
            expires_at: expiresAt,
            scopes: "calendar",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (dbError) {
        console.error("[calendar-auth] Error saving token:", dbError);
        return redirectWithError("db_error", "Error guardando credenciales");
      }

      console.log("[calendar-auth] Token saved, redirecting to app");
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${APP_BASE_URL}/calendario?connected=true`,
          ...corsHeaders,
        },
      });
    }

    // POST = actions (get_auth_url, check_status, disconnect, get_config)
    if (req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = claimsData.user.id;
      const body = await req.json();
      const { action } = body;

      if (action === "get_auth_url") {
        const scopes = "https://www.googleapis.com/auth/calendar";
        const authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth?` +
          `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
          `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
          `&response_type=code` +
          `&scope=${encodeURIComponent(scopes)}` +
          `&access_type=offline` +
          `&prompt=consent` +
          `&state=${encodeURIComponent(userId)}`;

        return new Response(JSON.stringify({ url: authUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "check_status") {
        const { data, error } = await supabase
          .from("user_google_tokens")
          .select("id, scopes, updated_at")
          .eq("user_id", userId)
          .eq("scopes", "calendar")
          .maybeSingle();

        return new Response(
          JSON.stringify({ connected: !!data && !error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (action === "disconnect") {
        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        await supabaseAdmin
          .from("user_google_tokens")
          .delete()
          .eq("user_id", userId)
          .eq("scopes", "calendar");

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // New action: returns config info for diagnostics
      if (action === "get_config") {
        const maskedClientId = GOOGLE_CLIENT_ID
          ? GOOGLE_CLIENT_ID.substring(0, 12) + "..." + GOOGLE_CLIENT_ID.slice(-6)
          : "NOT SET";

        return new Response(
          JSON.stringify({
            redirect_uri: REDIRECT_URI,
            client_id_masked: maskedClientId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (err) {
    console.error("[calendar-auth] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
