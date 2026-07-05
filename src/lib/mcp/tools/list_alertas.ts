import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, jsonContent, errorContent } from "./_supabase";

export default defineTool({
  name: "list_alertas",
  title: "Listar alertas",
  description:
    "Lista alertas de seguimiento visibles para el usuario autenticado. Por defecto solo pendientes (no completadas ni eliminadas).",
  inputSchema: {
    only_mine: z.boolean().default(true).describe("Solo alertas donde soy responsable."),
    include_completed: z.boolean().default(false),
    proyecto_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_mine, include_completed, proyecto_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorContent("No autenticado");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("alertas")
      .select("id, titulo, texto, fecha_seguimiento, completada, proyecto_id, empresa_id, usuario_responsable_id, created_at")
      .eq("deleted", false)
      .order("fecha_seguimiento", { ascending: true })
      .limit(limit);
    if (!include_completed) q = q.eq("completada", false);
    if (proyecto_id) q = q.eq("proyecto_id", proyecto_id);
    if (only_mine) q = q.eq("usuario_responsable_id", ctx.getUserId()!);
    const { data, error } = await q;
    if (error) return errorContent(error.message);
    return jsonContent({ count: data?.length ?? 0, alertas: data ?? [] });
  },
});