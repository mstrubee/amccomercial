import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EstadoProyecto {
  id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

export function useEstadosProyecto() {
  return useQuery({
    queryKey: ["estados_proyecto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estados_proyecto" as any)
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data as unknown as EstadoProyecto[];
    },
  });
}

export function useCreateEstadoProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; orden: number }) => {
      const { data, error } = await supabase
        .from("estados_proyecto" as any)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estados_proyecto"] });
      toast.success("Estado creado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateEstadoProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nombre: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("estados_proyecto" as any)
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estados_proyecto"] });
      toast.success("Estado actualizado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteEstadoProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("estados_proyecto" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estados_proyecto"] });
      toast.success("Estado eliminado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
