import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Clasificacion {
  id: string;
  nombre: string;
  orden: number;
}

export function useClasificaciones() {
  return useQuery({
    queryKey: ["clasificaciones_proyecto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clasificaciones_proyecto")
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data as Clasificacion[];
    },
  });
}

export function useCreateClasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; orden: number }) => {
      const { error } = await supabase.from("clasificaciones_proyecto").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clasificaciones_proyecto"] });
      toast.success("Clasificación creada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateClasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { error } = await supabase.from("clasificaciones_proyecto").update({ nombre }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clasificaciones_proyecto"] });
      toast.success("Clasificación actualizada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteClasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clasificaciones_proyecto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clasificaciones_proyecto"] });
      toast.success("Clasificación eliminada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
