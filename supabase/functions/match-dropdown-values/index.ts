import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (items.length > 200) {
      return new Response(JSON.stringify({ error: "Máximo 200 items por solicitud" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const prompt = `Eres un sistema de matching de datos. Se te darán valores ingresados por usuarios y las opciones válidas para cada campo.

Para cada item, debes determinar si el valor ingresado corresponde a alguna de las opciones válidas.
REGLAS ESTRICTAS:
- Solo haz match si estás MUY seguro (>95% confianza). Considera variaciones de mayúsculas/minúsculas, tildes, abreviaciones comunes, errores de tipeo menores.
- Si hay la MÁS MÍNIMA duda, responde con match: null y confidence: 0
- No inventes opciones que no estén en la lista
- CASO ESPECIAL "Clasificación (inferida del nombre)": el valor es el NOMBRE de un proyecto de construcción. Debes inferir qué tipo de clasificación le corresponde según las opciones disponibles (ej: si el nombre contiene "Edificio" o "Torre" probablemente es "Edificio Habitacional", si dice "Casa" o "Vivienda" probablemente es "Casa", si dice "Oficina" es "Oficina", etc.). En este caso, puedes usar confianza >= 70 si hay indicios claros en el nombre.

FORMATO DE SALIDA: Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta, sin markdown ni texto adicional. El campo "match" debe ser el texto de la opción o null si no hay match:
{"results":[{"index":0,"original":"...","match":"..." o null,"confidence":0}]}

Items a evaluar:
${JSON.stringify(items, null, 2)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "Eres un sistema de clasificación de datos. Devuelves siempre JSON válido con el formato solicitado." }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 400 || response.status === 403) {
        return new Response(JSON.stringify({ error: "La clave de Gemini es inválida o no tiene permisos." }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    console.error("match-dropdown error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
