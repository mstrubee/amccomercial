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

    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") {
      return new Response(JSON.stringify({ error: "texto requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (texto.length > 50000) {
      return new Response(JSON.stringify({ error: "Texto demasiado largo (máximo 50,000 caracteres)" }), {
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

    const systemPrompt = `Eres un asistente que extrae alertas/notas individuales de un texto corrido de seguimiento comercial.

REGLAS:
- Cada entrada generalmente comienza con una fecha en formato DD/MM, DD-MM, "DD mes" (ej: "30 ene", "23-1", "19/01", "12 sept").
- Separa cada entrada individual por su fecha.
- IMPORTANTE: Si hay fragmentos de texto que NO comienzan con una fecha (ej: "AM TERRENO ?", texto suelto al inicio o final), inclúyelos también como entradas con fecha null. Estos son "notas sin fecha".
- Para determinar el año: Enero y Febrero son 2026. Todos los demás meses son 2025. Si el texto indica explícitamente otro año (ej: "7-12-23", "15/8/06"), respétalo (2023, 2006, etc.).
- CORRECCIÓN ORTOGRÁFICA: Corrige errores de tipeo y faltas ortográficas en el texto de cada nota. Ejemplos: "proyectandpo" → "proyectando", "esxcribi" → "escribí", "acyualizado" → "actualizado", "qe" → "que", "ppto" puede mantenerse como abreviatura, "seg." puede mantenerse. Agrega tildes donde corresponda.
- Limpia espacios extra.
- No inventes contenido, solo separa y corrige lo que existe.
- Si hay múltiples entradas en una misma línea separadas por "/" o similar, sepáralas solo si tienen fechas distintas.

FORMATO DE SALIDA: Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma exacta, sin markdown ni texto adicional:
{"alertas":[{"fecha":"YYYY-MM-DD" o null,"texto":"contenido corregido de la nota"}]}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: `Extrae las alertas del siguiente texto:\n\n${texto}` }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes de Gemini excedido, intenta más tarde." }), {
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
    console.error("parse-alertas error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
