import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EstadoAmc {
  id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

export function useEstadosAmc() {
  return useQuery({
    queryKey: ["estados_amc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estados_amc" as any)
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data as unknown as EstadoAmc[];
    },
  });
}

export function useCreateEstadoAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; orden: number }) => {
      const { data, error } = await supabase
        .from("estados_amc" as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estados_amc"] });
      toast.success("Estado AMC creado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateEstadoAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nombre: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("estados_amc" as any)
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estados_amc"] });
      toast.success("Estado AMC actualizado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteEstadoAmc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("estados_amc" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estados_amc"] });
      toast.success("Estado AMC eliminado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
