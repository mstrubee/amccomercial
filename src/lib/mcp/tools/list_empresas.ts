import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, jsonContent, errorContent } from "./_supabase";

export default defineTool({
  name: "list_empresas",
  title: "Listar empresas",
  description: "Lista empresas visibles para el usuario autenticado.",
  inputSchema: {
    search: z.string().optional().describe("Filtro por nombre."),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorContent("No autenticado");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("empresas")
      .select("id, nombre, estado, fecha_inicio_relacion")
      .order("nombre", { ascending: true })
      .limit(limit);
    if (search) q = q.ilike("nombre", `%${search}%`);
    const { data, error } = await q;
    if (error) return errorContent(error.message);
    return jsonContent({ count: data?.length ?? 0, empresas: data ?? [] });
  },
});