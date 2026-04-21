import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HistorialEstatusRow {
  id: string;
  proyecto_empresa_id: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  monto_uf: number;
  fecha: string;
  created_by: string;
  created_at: string;
}

export function useHistorialEstatusByIds(ids: string[]) {
  return useQuery({
    queryKey: ["historial_estatus_empresa", "bulk", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("historial_estatus_empresa" as any) as any)
        .select("*")
        .in("proyecto_empresa_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as HistorialEstatusRow[];
    },
  });
}

export function useCreateHistorialEstatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      proyecto_empresa_id: string;
      categoria_id: string | null;
      subcategoria_id: string | null;
      monto_uf: number;
      fecha: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("No autenticado");
      const { data, error } = await (supabase.from("historial_estatus_empresa" as any) as any)
        .insert({ ...input, created_by: uid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
    },
    onError: (e: any) => toast.error("Error al guardar historial: " + e.message),
  });
}

export function useDeleteHistorialEstatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("historial_estatus_empresa" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
      toast.success("Entrada eliminada");
    },
    onError: (e: any) => toast.error("Error al eliminar entrada: " + e.message),
  });
}

export function useDeleteHistorialEstatusBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (proyecto_empresa_id: string) => {
      const { error } = await (supabase.from("historial_estatus_empresa" as any) as any)
        .delete()
        .eq("proyecto_empresa_id", proyecto_empresa_id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
      toast.success("Historial eliminado");
    },
    onError: (e: any) => toast.error("Error al eliminar historial: " + e.message),
  });
}
