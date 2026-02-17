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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
- Si un campo tiene un solo valor, déjalo tal cual.`;

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
          { role: "user", content: `Estructura los siguientes contactos:\n\n${JSON.stringify(contactos, null, 2)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_contactos",
            description: "Return structured contacts",
            parameters: {
              type: "object",
              properties: {
                contactos: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      categoria: { type: "string" },
                      nombre: { type: "string" },
                      contacto: { type: "string" },
                      email: { type: "string" },
                      telefono: { type: "string" },
                    },
                    required: ["categoria", "nombre", "contacto", "email", "telefono"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["contactos"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_contactos" } },
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

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);
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
