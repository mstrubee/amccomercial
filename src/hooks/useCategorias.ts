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
    mutationFn: async (input: { id: string; nombre: string; color: string; es_adjudicado: boolean; permite_fecha?: boolean; boton_label?: string | null; boton_bg_color?: string | null; boton_text_color?: string | null }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("categorias_proyecto")
        .update(rest as any)
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
    mutationFn: async (input: { id: string; nombre: string; color: string; es_adjudicado: boolean; boton_label?: string | null; boton_bg_color?: string | null; boton_text_color?: string | null }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("subcategorias_proyecto")
        .update(rest as any)
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

export function usePromoteToCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subId: string) => {
      // 1. Read subcategory data
      const { data: sub, error: readErr } = await supabase
        .from("subcategorias_proyecto")
        .select("*")
        .eq("id", subId)
        .single();
      if (readErr || !sub) throw readErr || new Error("Subcategoría no encontrada");

      // 2. Calculate next orden
      const { data: cats } = await supabase
        .from("categorias_proyecto")
        .select("orden")
        .order("orden", { ascending: false })
        .limit(1);
      const maxOrden = cats?.[0]?.orden ?? 0;

      // 3. Insert as category
      const { error: insertErr } = await supabase
        .from("categorias_proyecto")
        .insert({
          nombre: sub.nombre,
          color: sub.color,
          es_adjudicado: sub.es_adjudicado,
          orden: maxOrden + 1,
          permite_fecha: false,
          boton_label: sub.boton_label,
          boton_bg_color: sub.boton_bg_color,
          boton_text_color: sub.boton_text_color,
        });
      if (insertErr) throw insertErr;

      // 4. Delete subcategory
      const { error: delErr } = await supabase
        .from("subcategorias_proyecto")
        .delete()
        .eq("id", subId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Subcategoría promovida a categoría");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDemoteToSubcategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ catId, targetCatId }: { catId: string; targetCatId: string }) => {
      // 1. Read category data
      const { data: cat, error: readErr } = await supabase
        .from("categorias_proyecto")
        .select("*, subcategorias_proyecto(*)")
        .eq("id", catId)
        .single();
      if (readErr || !cat) throw readErr || new Error("Categoría no encontrada");

      // 2. Verify no subcategories
      if ((cat as any).subcategorias_proyecto?.length > 0) {
        throw new Error("No se puede degradar una categoría que tiene subcategorías");
      }

      // 3. Calculate next orden in target
      const { data: subs } = await supabase
        .from("subcategorias_proyecto")
        .select("orden")
        .eq("categoria_id", targetCatId)
        .order("orden", { ascending: false })
        .limit(1);
      const maxOrden = subs?.[0]?.orden ?? 0;

      // 4. Insert as subcategory
      const { error: insertErr } = await supabase
        .from("subcategorias_proyecto")
        .insert({
          categoria_id: targetCatId,
          nombre: cat.nombre,
          color: cat.color,
          es_adjudicado: cat.es_adjudicado,
          orden: maxOrden + 1,
          boton_label: cat.boton_label,
          boton_bg_color: cat.boton_bg_color,
          boton_text_color: cat.boton_text_color,
        });
      if (insertErr) throw insertErr;

      // 5. Delete category
      const { error: delErr } = await supabase
        .from("categorias_proyecto")
        .delete()
        .eq("id", catId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_proyecto"] });
      toast.success("Categoría convertida en subcategoría");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
