import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, jsonContent, errorContent } from "./_supabase";

export default defineTool({
  name: "list_clientes",
  title: "Listar clientes",
  description: "Lista clientes visibles para el usuario autenticado.",
  inputSchema: {
    search: z.string().optional().describe("Filtro por nombre o contacto."),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorContent("No autenticado");
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("clientes")
      .select("id, nombre, contacto, email, telefono, categoria_id")
      .order("nombre", { ascending: true })
      .limit(limit);
    if (search) q = q.or(`nombre.ilike.%${search}%,contacto.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return errorContent(error.message);
    return jsonContent({ count: data?.length ?? 0, clientes: data ?? [] });
  },
});