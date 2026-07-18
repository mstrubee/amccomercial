import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !data?.claims) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contactos } = await req.json();
    if (!contactos || !Array.isArray(contactos)) {
      return new Response(JSON.stringify({ error: "contactos array requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (contactos.length > 100) {
      return new Response(JSON.stringify({ error: "Máximo 100 contactos por solicitud" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const c of contactos) {
      if (!c || typeof c !== "object") {
        return new Response(JSON.stringify({ error: "Formato de contacto inválido" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Read the admin-configured Gemini API key (service role bypasses RLS).
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from("ai_provider_keys").select("api_key").eq("provider", "gemini").maybeSingle();
    if (keyError) throw keyError;
    const geminiKey = keyRow?.api_key;
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "No hay una clave de Gemini configurada. Ve a Usuarios > Integración IA para configurarla." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Eres un asistente que estructura datos de contacto.

REGLAS:
- Recibirás un array de categorías de contacto, cada una con campos: nombre, contacto, email, telefono.
- Cada campo puede tener múltiples personas separadas por comas, "/", "y", "-" u otros separadores.
- Tu trabajo es asociar cada nombre con su contacto, email y teléfono correspondiente.
- Si hay más nombres que emails/teléfonos, deja vacío lo que no corresponda.
- Si hay datos sin nombre asociable, agrúpalos con el contacto más probable.
- Devuelve el resultado estructurado: para cada categoría, un string con los datos organizados.
- Formato de salida: cada persona separada por " / " dentro del campo. Mantener el orden.
- No inventes datos, solo reorganiza lo que existe.
- Si un campo tiene un solo valor, déjalo tal cual.

FORMATO DE SALIDA: Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta, sin markdown ni texto adicional:
{"contactos":[{"categoria":"...","nombre":"...","contacto":"...","email":"...","telefono":"..."}]}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: `Estructura los siguientes contactos:\n\n${JSON.stringify(contactos, null, 2)}` }] }],
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

    const aiData = await response.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON in AI response");
      parsed = JSON.parse(match[0]);
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-contactos error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
