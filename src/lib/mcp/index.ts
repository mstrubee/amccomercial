import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProyectosTool from "./tools/list_proyectos";
import getProyectoTool from "./tools/get_proyecto";
import listAlertasTool from "./tools/list_alertas";
import listEmpresasTool from "./tools/list_empresas";
import listClientesTool from "./tools/list_clientes";

// Build the direct Supabase issuer host from the project ref (see knowledge:
// SUPABASE_URL may be a lovable.cloud proxy that mcp-js rejects).
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "amc-comercial-mcp",
  title: "AMC Comercial",
  version: "0.1.0",
  instructions:
    "Herramientas para AMC Gestión Comercial. Permite listar y consultar proyectos, alertas de seguimiento, empresas y clientes del usuario autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listProyectosTool,
    getProyectoTool,
    listAlertasTool,
    listEmpresasTool,
    listClientesTool,
  ],
});