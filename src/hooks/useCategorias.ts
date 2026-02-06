import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type CategoriaRow = Tables<"categorias_proyecto">;
export type SubcategoriaRow = Tables<"subcategorias_proyecto">;

export type CategoriaWithSubs = CategoriaRow & {
  subcategorias_proyecto: SubcategoriaRow[];
};

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias_proyecto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_proyecto")
        .select("*, subcategorias_proyecto(*)")
        .order("orden", { ascending: true });
      if (error) throw error;
      // Sort subcategories within each category
      return (data as CategoriaWithSubs[]).map((cat) => ({
        ...cat,
        subcategorias_proyecto: (cat.subcategorias_proyecto || []).sort(
          (a, b) => a.orden - b.orden
        ),
      }));
    },
  });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; color: string; orden: number; es_adjudicado: boolean }) => {
      const { data, error } = await supabase
        .from("categorias_proyecto")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Categoría creada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nombre: string; color: string; es_adjudicado: boolean }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("categorias_proyecto")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Categoría actualizada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias_proyecto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Categoría eliminada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useCreateSubcategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoria_id: string; nombre: string; color: string; orden: number; es_adjudicado: boolean }) => {
      const { data, error } = await supabase
        .from("subcategorias_proyecto")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Subcategoría creada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateSubcategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nombre: string; color: string; es_adjudicado: boolean }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("subcategorias_proyecto")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Subcategoría actualizada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteSubcategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subcategorias_proyecto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Subcategoría eliminada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
