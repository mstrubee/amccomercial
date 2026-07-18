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

    // Only admins can generate titles
    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = supabaseAdmin;

    // Read the admin-configured Gemini API key (service role bypasses RLS).
    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from("ai_provider_keys").select("api_key").eq("provider", "gemini").maybeSingle();
    if (keyError) throw keyError;
    const geminiKey = keyRow?.api_key;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "No hay una clave de Gemini configurada. Ve a Usuarios > Integración IA para configurarla." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { batchSize = 20 } = await req.json().catch(() => ({}));

    // Fetch alerts with generic title "Seguimiento"
    const { data: alertas, error } = await supabase
      .from("alertas")
      .select("id, texto")
      .eq("deleted", false)
      .eq("titulo", "Seguimiento")
      .limit(Math.min(batchSize, 50));

    if (error) throw error;
    if (!alertas || alertas.length === 0) {
      return new Response(JSON.stringify({ updated: 0, remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt with all texts
    const items = alertas.map((a, i) => `[${i}] ${a.texto}`).join("\n");

    const systemPrompt = `Eres un asistente que genera títulos breves (máximo 5 palabras) para notas de seguimiento comercial.
Los títulos deben ser descriptivos y concisos, reflejando la acción principal. Ejemplos:
- "WhatsApp a María José" → "Seguimiento WhatsApp"
- "Se envía presupuesto actualizado Tecma" → "Envío presupuesto Tecma"
- "AM confirma GANADO Tecma" → "Proyecto ganado Tecma"
- "Consulté a Clemente por avance" → "Consulta avance Clemente"
- "Retomé con Claudia" → "Retomar contacto Claudia"
- "Se traspasa a Tecma" → "Traspaso a Tecma"

NO uses "Seguimiento" como título genérico. Sé específico.

FORMATO DE SALIDA: Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta, sin markdown ni texto adicional. "index" es el número entre corchetes de cada nota:
{"titulos":[{"index":0,"titulo":"..."}]}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: `Genera un título breve para cada una de estas notas.\n\n${items}` }] }],
          generationConfig: { responseMimeType: "application/json" },
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
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsedResult: { titulos?: { index: number; titulo: string }[] };
    try {
      parsedResult = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in AI response");
      parsedResult = JSON.parse(match[0]);
    }
    const titulos: { index: number; titulo: string }[] = parsedResult.titulos || [];

    // Update each alert with its generated title
    let updated = 0;
    for (const t of titulos) {
      if (t.index >= 0 && t.index < alertas.length && t.titulo) {
        const { error: updateErr } = await supabase
          .from("alertas")
          .update({ titulo: t.titulo })
          .eq("id", alertas[t.index].id);
        if (!updateErr) updated++;
      }
    }

    // Count remaining
    const { count } = await supabase
      .from("alertas")
      .select("id", { count: "exact", head: true })
      .eq("deleted", false)
      .eq("titulo", "Seguimiento");

    return new Response(JSON.stringify({ updated, remaining: count || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-titulos error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
