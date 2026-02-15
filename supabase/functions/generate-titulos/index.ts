import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Eres un asistente que genera títulos breves (máximo 5 palabras) para notas de seguimiento comercial.
Los títulos deben ser descriptivos y concisos, reflejando la acción principal. Ejemplos:
- "WhatsApp a María José" → "Seguimiento WhatsApp"
- "Se envía presupuesto actualizado Tecma" → "Envío presupuesto Tecma"
- "AM confirma GANADO Tecma" → "Proyecto ganado Tecma"
- "Consulté a Clemente por avance" → "Consulta avance Clemente"
- "Retomé con Claudia" → "Retomar contacto Claudia"
- "Se traspasa a Tecma" → "Traspaso a Tecma"

NO uses "Seguimiento" como título genérico. Sé específico.`,
          },
          {
            role: "user",
            content: `Genera un título breve para cada una de estas notas. Devuelve los resultados usando la función.\n\n${items}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_titulos",
            description: "Return generated titles for each alert",
            parameters: {
              type: "object",
              properties: {
                titulos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number", description: "Index of the alert" },
                      titulo: { type: "string", description: "Brief title (max 5 words)" },
                    },
                    required: ["index", "titulo"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["titulos"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_titulos" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + response.status);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);
    const titulos: { index: number; titulo: string }[] = parsed.titulos || [];

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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
