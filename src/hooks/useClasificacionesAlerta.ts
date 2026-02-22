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

export function useReorderClasificaciones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; orden: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from("clasificaciones_alerta").update({ orden: item.orden } as any).eq("id", item.id);
        if (error) throw error;
      }
    },
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData<ClasificacionAlerta[]>(QK);
      if (prev) {
        const orderMap = new Map(items.map(i => [i.id, i.orden]));
        const updated = [...prev].map(c => ({ ...c, orden: orderMap.get(c.id) ?? c.orden }));
        updated.sort((a, b) => a.orden - b.orden);
        qc.setQueryData(QK, updated);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); toast.error("Error al reordenar"); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useReorderSubclasificaciones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; orden: number }[]) => {
      for (const item of items) {
        const { error } = await supabase.from("subclasificaciones_alerta").update({ orden: item.orden } as any).eq("id", item.id);
        if (error) throw error;
      }
    },
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData<ClasificacionAlerta[]>(QK);
      if (prev) {
        const orderMap = new Map(items.map(i => [i.id, i.orden]));
        const updated = prev.map(c => ({
          ...c,
          subclasificaciones: [...c.subclasificaciones]
            .map(s => ({ ...s, orden: orderMap.get(s.id) ?? s.orden }))
            .sort((a, b) => a.orden - b.orden),
        }));
        qc.setQueryData(QK, updated);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(QK, ctx.prev); toast.error("Error al reordenar"); },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
