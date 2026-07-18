import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_PROVIDERS = ["gemini"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action, provider = "gemini" } = body;

    if (!VALID_PROVIDERS.includes(provider)) {
      return new Response(JSON.stringify({ error: "Proveedor no válido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const { data, error } = await supabaseAdmin
        .from("ai_provider_keys")
        .select("api_key")
        .eq("provider", provider)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ apiKey: data?.api_key ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const { apiKey } = body;
      if (typeof apiKey !== "string" || !apiKey.trim()) {
        return new Response(JSON.stringify({ error: "La clave no puede estar vacía" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin
        .from("ai_provider_keys")
        .upsert(
          { provider, api_key: apiKey.trim(), updated_at: new Date().toISOString(), updated_by: caller.id },
          { onConflict: "provider" },
        );
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Acción no válida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manage-ai-provider-keys error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
