import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HitosColumn = {
  id: string;
  nombre: string;
  tipo: "texto" | "select";
  orden: number;
  options: { id: string; valor: string; orden: number }[];
};
export type HitosRow = { id: string; orden: number };

export type HitosTemplate = {
  columns: HitosColumn[];
  rows: HitosRow[];
};

export function useHitosTemplate() {
  return useQuery<HitosTemplate>({
    queryKey: ["hitos-template"],
    queryFn: async () => {
      const [colsRes, optsRes, rowsRes] = await Promise.all([
        supabase.from("hitos_template_columns").select("*").order("orden"),
        supabase.from("hitos_template_column_options").select("*").order("orden"),
        supabase.from("hitos_template_rows").select("*").order("orden"),
      ]);
      if (colsRes.error) throw colsRes.error;
      if (optsRes.error) throw optsRes.error;
      if (rowsRes.error) throw rowsRes.error;
      const optsByCol = new Map<string, { id: string; valor: string; orden: number }[]>();
      (optsRes.data || []).forEach((o: any) => {
        const arr = optsByCol.get(o.column_id) || [];
        arr.push({ id: o.id, valor: o.valor, orden: o.orden });
        optsByCol.set(o.column_id, arr);
      });
      const columns: HitosColumn[] = (colsRes.data || []).map((c: any) => ({
        id: c.id, nombre: c.nombre, tipo: c.tipo, orden: c.orden,
        options: optsByCol.get(c.id) || [],
      }));
      const rows: HitosRow[] = (rowsRes.data || []).map((r: any) => ({ id: r.id, orden: r.orden }));
      return { columns, rows };
    },
  });
}

export function useHitosTemplateMutations() {
  const qc = useQueryClient();
  const invalidate = async () => { await qc.invalidateQueries({ queryKey: ["hitos-template"] }); };

  const addColumn = useMutation({
    mutationFn: async ({ nombre, tipo, orden }: { nombre: string; tipo: "texto" | "select"; orden: number }) => {
      const { data, error } = await supabase.from("hitos_template_columns").insert({ nombre, tipo, orden }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateColumn = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; nombre?: string; tipo?: "texto" | "select"; orden?: number }) => {
      const { error } = await supabase.from("hitos_template_columns").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hitos_template_columns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addOption = useMutation({
    mutationFn: async ({ column_id, valor, orden }: { column_id: string; valor: string; orden: number }) => {
      const { error } = await supabase.from("hitos_template_column_options").insert({ column_id, valor, orden });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateOption = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: string }) => {
      const { error } = await supabase.from("hitos_template_column_options").update({ valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hitos_template_column_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addRow = useMutation({
    mutationFn: async (orden: number) => {
      const { error } = await supabase.from("hitos_template_rows").insert({ orden });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateRow = useMutation({
    mutationFn: async ({ id, orden }: { id: string; orden: number }) => {
      const { error } = await supabase.from("hitos_template_rows").update({ orden }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hitos_template_rows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addColumn, updateColumn, deleteColumn, addOption, updateOption, deleteOption, addRow, updateRow, deleteRow };
}