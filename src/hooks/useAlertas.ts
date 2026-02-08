import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AlertaRow {
  id: string;
  proyecto_id: string;
  empresa_id: string | null;
  texto: string;
  usuario_responsable_id: string;
  fecha_seguimiento: string;
  completada: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AlertaWithRelations extends AlertaRow {
  proyectos: { id: string; nombre: string; numero: number } | null;
  empresas: { id: string; nombre: string } | null;
  responsable_profile: { display_name: string; email: string } | null;
}

export function useAlertas() {
  return useQuery({
    queryKey: ["alertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alertas")
        .select("*, proyectos(id, nombre, numero), empresas(id, nombre)")
        .order("fecha_seguimiento", { ascending: true });
      if (error) throw error;

      // Fetch profiles for responsable
      const userIds = [...new Set((data || []).map((a: any) => a.usuario_responsable_id))];
      let profilesMap: Record<string, { display_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);
        if (profiles) {
          profiles.forEach((p: any) => {
            profilesMap[p.user_id] = { display_name: p.display_name, email: p.email };
          });
        }
      }

      return (data || []).map((a: any) => ({
        ...a,
        responsable_profile: profilesMap[a.usuario_responsable_id] || null,
      })) as AlertaWithRelations[];
    },
  });
}

export interface AlertaInput {
  proyecto_id: string;
  empresa_id: string | null;
  texto: string;
  usuario_responsable_id: string;
  fecha_seguimiento: string;
}

export function useCreateAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AlertaInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase.from("alertas").insert({
        ...input,
        created_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      toast.success("Alerta creada exitosamente");
    },
    onError: (e) => toast.error("Error al crear alerta: " + e.message),
  });
}

export function useUpdateAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AlertaInput & { id: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("alertas")
        .update(rest as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      toast.success("Alerta actualizada");
    },
    onError: (e) => toast.error("Error al actualizar: " + e.message),
  });
}

export function useToggleAlertaCompletada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, completada }: { id: string; completada: boolean }) => {
      const { error } = await supabase
        .from("alertas")
        .update({ completada } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alertas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      toast.success("Alerta eliminada");
    },
    onError: (e) => toast.error("Error al eliminar: " + e.message),
  });
}
