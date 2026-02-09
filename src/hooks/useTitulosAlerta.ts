import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TituloAlerta {
  id: string;
  nombre: string;
  orden: number;
}

export function useTitulosAlerta() {
  return useQuery({
    queryKey: ["titulos_alerta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("titulos_alerta")
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data as TituloAlerta[];
    },
  });
}

export function useCreateTituloAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) => {
      const { error } = await supabase.from("titulos_alerta").insert({ nombre } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["titulos_alerta"] });
      toast.success("Título agregado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteTituloAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("titulos_alerta").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["titulos_alerta"] });
      toast.success("Título eliminado");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
