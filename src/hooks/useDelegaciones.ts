import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface Delegacion {
  id: string;
  delegante_id: string;
  delegado_id: string;
  otorgado_por: string;
  fecha_inicio: string;
  fecha_fin: string;
  revocada: boolean;
  revocada_at: string | null;
  created_at: string;
}

/** Active delegaciones where current user is the delegado */
export function useDelegacionesActivas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["delegaciones-activas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase.from("delegaciones_alerta") as any)
        .select("*")
        .eq("delegado_id", user!.id)
        .eq("revocada", false)
        .lte("fecha_inicio", now)
        .gte("fecha_fin", now);
      if (error) throw error;
      return (data || []) as Delegacion[];
    },
  });
}

/** Delegaciones where a specific user is the delegante (for admin management) */
export function useDelegacionesPorDelegante(deleganteId: string | null) {
  return useQuery({
    queryKey: ["delegaciones-por-delegante", deleganteId],
    enabled: !!deleganteId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("delegaciones_alerta") as any)
        .select("*")
        .eq("delegante_id", deleganteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Delegacion[];
    },
  });
}

export function useCreateDelegacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { delegante_id: string; delegado_id: string; fecha_fin: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await (supabase.from("delegaciones_alerta") as any).insert({
        delegante_id: input.delegante_id,
        delegado_id: input.delegado_id,
        otorgado_por: user.id,
        fecha_fin: input.fecha_fin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delegaciones-activas"] });
      qc.invalidateQueries({ queryKey: ["delegaciones-por-delegante"] });
      toast.success("Delegación creada");
    },
    onError: (e) => toast.error("Error al crear delegación: " + e.message),
  });
}

export function useRevokeDelegacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("delegaciones_alerta") as any)
        .update({ revocada: true, revocada_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delegaciones-activas"] });
      qc.invalidateQueries({ queryKey: ["delegaciones-por-delegante"] });
      toast.success("Delegación revocada");
    },
    onError: (e) => toast.error("Error al revocar: " + e.message),
  });
}

export function useUpdateDelegacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; delegado_id?: string; fecha_fin?: string }) => {
      const patch: any = {};
      if (input.delegado_id) patch.delegado_id = input.delegado_id;
      if (input.fecha_fin) patch.fecha_fin = input.fecha_fin;
      const { error } = await (supabase.from("delegaciones_alerta") as any)
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delegaciones-activas"] });
      qc.invalidateQueries({ queryKey: ["delegaciones-por-delegante"] });
      toast.success("Delegación actualizada");
    },
    onError: (e) => toast.error("Error al actualizar: " + e.message),
  });
}

export function useDeleteDelegacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("delegaciones_alerta") as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delegaciones-activas"] });
      qc.invalidateQueries({ queryKey: ["delegaciones-por-delegante"] });
      toast.success("Delegación eliminada");
    },
    onError: (e) => toast.error("Error al eliminar: " + e.message),
  });
}
