import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClasificacionAlerta {
  id: string;
  nombre: string;
  orden: number;
  created_at: string;
  subclasificaciones: SubclasificacionAlerta[];
}

export interface SubclasificacionAlerta {
  id: string;
  clasificacion_id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

const QK = ["clasificaciones-alerta"];

export function useClasificacionesAlerta() {
  return useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data: clasificaciones, error: e1 } = await supabase
        .from("clasificaciones_alerta")
        .select("*")
        .order("orden", { ascending: true });
      if (e1) throw e1;

      const { data: subs, error: e2 } = await supabase
        .from("subclasificaciones_alerta")
        .select("*")
        .order("orden", { ascending: true });
      if (e2) throw e2;

      return (clasificaciones || []).map((c: any) => ({
        ...c,
        subclasificaciones: (subs || []).filter((s: any) => s.clasificacion_id === c.id),
      })) as ClasificacionAlerta[];
    },
  });
}

export function useCreateClasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; orden?: number }) => {
      const { error } = await supabase.from("clasificaciones_alerta").insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Clasificación creada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateClasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { error } = await supabase.from("clasificaciones_alerta").update({ nombre } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Clasificación actualizada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteClasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clasificaciones_alerta").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Clasificación eliminada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useCreateSubclasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clasificacion_id: string; nombre: string; orden?: number }) => {
      const { error } = await supabase.from("subclasificaciones_alerta").insert(input as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Sub-clasificación creada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateSubclasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { error } = await supabase.from("subclasificaciones_alerta").update({ nombre } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Sub-clasificación actualizada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteSubclasificacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subclasificaciones_alerta").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK }); toast.success("Sub-clasificación eliminada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
