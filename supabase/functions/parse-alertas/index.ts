import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") {
      return new Response(JSON.stringify({ error: "texto requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Eres un asistente que extrae alertas/notas individuales de un texto corrido de seguimiento comercial.

REGLAS:
- Cada entrada comienza con una fecha en formato DD/MM, DD-MM, "DD mes" (ej: "30 ene", "23-1", "19/01", "12 sept").
- Separa cada entrada individual por su fecha.
- Devuelve un array JSON de objetos con: { "fecha": "YYYY-MM-DD", "texto": "contenido de la nota" }
- Para determinar el año: Enero y Febrero son 2026. Todos los demás meses son 2025.
- Si la fecha no tiene mes claro o no se puede parsear, usa null en fecha.
- Limpia espacios extra pero mantén el contenido original.
- No inventes contenido, solo separa lo que existe.
- Si hay múltiples entradas en una misma línea separadas por "/" o similar, sepáralas solo si tienen fechas distintas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extrae las alertas del siguiente texto:\n\n${texto}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_alertas",
            description: "Return parsed alertas from text",
            parameters: {
              type: "object",
              properties: {
                alertas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      fecha: { type: "string", description: "YYYY-MM-DD or null" },
                      texto: { type: "string", description: "Alert content text" },
                    },
                    required: ["fecha", "texto"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["alertas"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_alertas" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido, intenta más tarde." }), {
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
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-alertas error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
