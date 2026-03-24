import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UserPermissions {
  id: string;
  user_id: string;
  empresas_visibles: string[] | null;
  secciones_visibles: string[] | null;
  dashboard_widgets: string[] | null;
  puede_editar: boolean;
}

// All available sections
export const ALL_SECTIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "empresas", label: "Empresas" },
  { key: "proyectos", label: "Proyectos" },
  { key: "finanzas", label: "Finanzas" },
  { key: "alertas", label: "Alertas" },
  { key: "reuniones", label: "Reuniones" },
] as const;

// All available dashboard widgets
export const ALL_DASHBOARD_WIDGETS = [
  { key: "kpis", label: "KPIs (métricas principales)" },
  { key: "alertas", label: "Alertas vencidas / próximas" },
  { key: "graficos_estado", label: "Gráficos de estado" },
  { key: "fees", label: "Fees mensuales por empresa" },
  { key: "proyectos_recientes", label: "Proyectos recientes" },
] as const;

export function useMyPermissions() {
  return useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserPermissions | null;
    },
  });
}

export function useUserPermissions(userId: string | null) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as UserPermissions | null;
    },
  });
}

export function useSavePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      empresas_visibles: string[] | null;
      secciones_visibles: string[] | null;
      dashboard_widgets: string[] | null;
      puede_editar: boolean;
    }) => {
      // Upsert: try update first, then insert
      const { data: existing } = await supabase
        .from("user_permissions")
        .select("id")
        .eq("user_id", input.user_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_permissions")
          .update({
            empresas_visibles: input.empresas_visibles,
            secciones_visibles: input.secciones_visibles,
            dashboard_widgets: input.dashboard_widgets,
            puede_editar: input.puede_editar,
          } as any)
          .eq("user_id", input.user_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_permissions")
          .insert(input as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
      toast.success("Permisos actualizados");
    },
    onError: (e) => toast.error("Error al guardar permisos: " + e.message),
  });
}
