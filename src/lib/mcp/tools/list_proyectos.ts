import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, jsonContent, errorContent } from "./_supabase";

export default defineTool({
  name: "list_proyectos",
  title: "Listar proyectos",
  description:
    "Lista proyectos visibles para el usuario autenticado. Permite filtrar por texto (nombre/dirección/comuna) y estado de obra.",
  inputSchema: {
    search: z.string().optional().describe("Texto a buscar en nombre, dirección o comuna."),
    estado_obra: z.string().optional().describe("Filtrar por estado de obra exacto."),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, estado_obra, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorContent("No autenticado");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("proyectos")
      .select("id, nombre, direccion, comuna, estado_obra, estado_amc, monto_estimado, adjudicado, fecha_ingreso")
      .order("fecha_ingreso", { ascending: false })
      .limit(limit);
    if (estado_obra) q = q.eq("estado_obra", estado_obra);
    if (search) q = q.or(`nombre.ilike.%${search}%,direccion.ilike.%${search}%,comuna.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return errorContent(error.message);
    return jsonContent({ count: data?.length ?? 0, proyectos: data ?? [] });
  },
});