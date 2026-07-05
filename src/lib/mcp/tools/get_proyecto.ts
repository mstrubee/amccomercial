import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, jsonContent, errorContent } from "./_supabase";

export default defineTool({
  name: "get_proyecto",
  title: "Obtener proyecto",
  description: "Devuelve toda la información de un proyecto por ID.",
  inputSchema: {
    id: z.string().uuid().describe("ID del proyecto."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return errorContent("No autenticado");
    const { data, error } = await supabaseForUser(ctx)
      .from("proyectos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return errorContent(error.message);
    if (!data) return errorContent("Proyecto no encontrado");
    return jsonContent(data);
  },
});