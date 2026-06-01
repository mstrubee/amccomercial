import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // Handle OAuth callback (GET with ?code=)
  if (req.method === "GET" && url.searchParams.has("code")) {
    try {
      const code = url.searchParams.get("code")!;
      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;

      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResp.json();
      if (!tokenResp.ok) {
        console.error("Token exchange failed:", JSON.stringify(tokenData));
        return new Response(`<html><body><h2>Error</h2><pre>${JSON.stringify(tokenData)}</pre></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      if (!tokenData.refresh_token) {
        console.error("No refresh_token in response:", JSON.stringify(tokenData));
        return new Response(`<html><body><h2>Error: No refresh token received</h2><p>Try revoking app access in your Google account and retry.</p></body></html>`, {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { error } = await admin.from("app_settings").upsert(
        { key: "google_refresh_token", value: tokenData.refresh_token },
        { onConflict: "key" }
      );

      if (error) {
        console.error("Error saving token:", error.message);
        return new Response(`<html><body><h2>Error guardando token</h2><pre>${error.message}</pre></body></html>`, {
          status: 500,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(
        `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2 style="color:#16a34a">✅ Google Drive conectado exitosamente</h2>
          <p>Puedes cerrar esta ventana y volver a la aplicación.</p>
          <script>setTimeout(() => window.close(), 3000)</script>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("OAuth callback error:", message);
      return new Response(`<html><body><h2>Error</h2><pre>${message}</pre></body></html>`, {
        status: 500,
        headers: { "Content-Type": "text/html" },
      });
    }
  }

  // POST: get auth URL or check status
  if (req.method === "POST") {
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

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        console.error("Auth error:", claimsErr?.message);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { action } = await req.json();

      if (action === "get_auth_url") {
        const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
        if (!clientId) throw new Error("GOOGLE_CLIENT_ID not configured");

        const redirectUri = `${supabaseUrl}/functions/v1/google-auth-callback`;
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive")}&access_type=offline&prompt=consent`;

        return new Response(JSON.stringify({ auth_url: authUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "check_status") {
        const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await admin
          .from("app_settings")
          .select("value")
          .eq("key", "google_refresh_token")
          .single();

        return new Response(JSON.stringify({ connected: !!data?.value }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error("Invalid action");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("google-auth-callback POST error:", message);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
