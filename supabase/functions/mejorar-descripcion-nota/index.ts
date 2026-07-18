import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins use the notes feature
    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { descripcion } = await req.json().catch(() => ({}));
    if (typeof descripcion !== "string" || !descripcion.trim()) {
      return new Response(JSON.stringify({ error: "La descripción no puede estar vacía" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from("ai_provider_keys")
      .select("api_key")
      .eq("provider", "gemini")
      .maybeSingle();
    if (keyError) throw keyError;
    const geminiKey = keyRow?.api_key;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "No hay una clave de Gemini configurada. Ve a Usuarios > Integración IA para configurarla." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemInstruction = `Eres un asistente que transforma descripciones informales de un problema de software (escritas por un usuario no técnico) en un prompt claro y accionable, listo para entregarle a un agente de IA que programa y arregla el código.

Reglas:
- Responde en español.
- Sé específico: qué está fallando o qué se necesita, y qué comportamiento se espera en su lugar.
- No inventes detalles técnicos, nombres de archivos, ni causas que el usuario no haya mencionado — solo reformula y clarifica lo que ya está en el texto.
- Si el texto es ambiguo, mantenlo general en vez de suponer.
- Sé conciso: unas pocas frases, no un ensayo.
- Devuelve SOLO el texto del prompt reformulado, sin comillas, sin encabezados, sin explicaciones adicionales.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: descripcion.trim() }] }],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes de Gemini excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 400 || response.status === 403) {
        return new Response(JSON.stringify({ error: "La clave de Gemini es inválida o no tiene permisos." }), {
          status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Gemini API error: " + response.status);
    }

    const data = await response.json();
    const result = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
    if (!result) throw new Error("No content in AI response");

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mejorar-descripcion-nota error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
