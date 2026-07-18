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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admins can run duplicate detection
    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const isAdmin = callerRoles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const supabase = supabaseAdmin;
    const { dryRun = true } = await req.json().catch(() => ({}));

    // Fetch all non-deleted alerts
    const allAlertas: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("alertas")
        .select("id, proyecto_id, empresa_id, titulo, texto, fecha_seguimiento, created_at, completada")
        .eq("deleted", false)
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allAlertas.push(...data);
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    // Also fetch project names for grouping
    const { data: proyectos } = await supabase.from("proyectos").select("id, nombre");
    const proyectoNameMap: Record<string, string> = {};
    for (const p of proyectos || []) {
      proyectoNameMap[p.id] = p.nombre.trim().toLowerCase();
    }

    // Group alerts by project NAME (not ID, since same project can have multiple IDs)
    const byProjectName: Record<string, any[]> = {};
    for (const a of allAlertas) {
      const projectName = proyectoNameMap[a.proyecto_id] || a.proyecto_id;
      if (!byProjectName[projectName]) byProjectName[projectName] = [];
      byProjectName[projectName].push(a);
    }

    // For each project group with >1 alert, use AI to find duplicates
    const duplicatesToDelete: { id: string; reason: string; texto: string; keepId: string; keepTexto: string }[] = [];

    for (const [projectName, alerts] of Object.entries(byProjectName)) {
      if (alerts.length < 2) continue;

      // Build a compact representation for AI
      const alertsSummary = alerts.map((a, i) => ({
        idx: i,
        id: a.id,
        titulo: a.titulo || "",
        texto: a.texto,
        fecha: a.fecha_seguimiento,
        created_at: a.created_at,
        empresa_id: a.empresa_id || null,
      }));

      // Process in chunks of 50 to avoid token limits
      const chunkSize = 50;
      for (let start = 0; start < alertsSummary.length; start += chunkSize) {
        const chunk = alertsSummary.slice(start, start + chunkSize);
        if (chunk.length < 2) continue;

        const prompt = `Analiza las siguientes alertas de un mismo proyecto y encuentra DUPLICADOS.
Dos alertas son duplicadas si el contenido de sus campos "titulo" y "texto" tienen más del 50% de similitud semántica (mismo tema, misma acción, mismas palabras clave aunque con redacción ligeramente diferente).

IMPORTANTE:
- Solo compara alertas que tengan la misma empresa_id (o ambas null).
- De cada par duplicado, conserva la MÁS NUEVA (created_at más reciente) y marca la más antigua para eliminar.
- Responde SOLO con un JSON array de objetos con formato: [{"delete_id": "uuid-a-eliminar", "keep_id": "uuid-a-conservar", "reason": "breve explicación"}]
- Si no hay duplicados, responde con un array vacío: []

Alertas:
${JSON.stringify(chunk, null, 2)}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: "Eres un analista de datos. Respondes SOLO con JSON válido, sin markdown ni explicaciones adicionales." }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          },
        );

        if (!response.ok) {
          if (response.status === 429) {
            console.warn("Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }
          console.error("Gemini API error:", response.status, await response.text());
          continue;
        }

        const result = await response.json();
        const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Extract JSON from response
        let parsed: any[] = [];
        try {
          // Try direct parse first
          parsed = JSON.parse(content);
        } catch {
          // Try extracting from markdown code block
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            try { parsed = JSON.parse(match[0]); } catch { /* skip */ }
          }
        }

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.delete_id && item.keep_id) {
              const deleteAlert = chunk.find(a => a.id === item.delete_id);
              const keepAlert = chunk.find(a => a.id === item.keep_id);
              if (deleteAlert && keepAlert) {
                duplicatesToDelete.push({
                  id: item.delete_id,
                  reason: item.reason || "Contenido similar",
                  texto: deleteAlert.texto.substring(0, 80),
                  keepId: item.keep_id,
                  keepTexto: keepAlert.texto.substring(0, 80),
                });
              }
            }
          }
        }
      }
    }

    // If not dry run, soft-delete the duplicates
    let deleteErrors = 0;
    let deletedCount = 0;
    if (!dryRun && duplicatesToDelete.length > 0) {
      const idsToDelete = duplicatesToDelete.map(d => d.id);
      // Process in batches of 50
      for (let i = 0; i < idsToDelete.length; i += 50) {
        const batch = idsToDelete.slice(i, i + 50);
        const { error } = await supabase
          .from("alertas")
          .update({ deleted: true, deleted_at: new Date().toISOString() })
          .in("id", batch);
        if (error) {
          console.error("Delete batch error:", error);
          deleteErrors++;
        } else {
          deletedCount += batch.length;
        }
      }
    }

    return new Response(JSON.stringify({
      total_alertas: allAlertas.length,
      duplicates_found: duplicatesToDelete.length,
      duplicates: duplicatesToDelete,
      // Report success only when every batch actually applied — previously a
      // failed batch was swallowed and the caller still saw applied:true.
      applied: !dryRun && deleteErrors === 0,
      deleted_count: deletedCount,
      delete_errors: deleteErrors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("detect-duplicates error:", e);
    return new Response(JSON.stringify({ error: "Ocurrió un error al procesar la solicitud" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
