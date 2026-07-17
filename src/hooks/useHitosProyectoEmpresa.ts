import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type HitosValue = {
  id: string;
  proyecto_empresa_id: string;
  row_id: string | null;
  extra_row_id: string | null;
  column_id: string;
  valor: string;
};

export type HitosExtraRow = {
  id: string;
  proyecto_empresa_id: string;
  orden: number;
};

export function useHitosProyectoEmpresa(proyectoEmpresaId: string | null) {
  return useQuery<{ values: HitosValue[]; extraRows: HitosExtraRow[] }>({
    queryKey: ["hitos-values", proyectoEmpresaId],
    enabled: !!proyectoEmpresaId,
    queryFn: async () => {
      const [vRes, eRes] = await Promise.all([
        supabase.from("hitos_proyecto_empresa_values").select("*").eq("proyecto_empresa_id", proyectoEmpresaId!),
        supabase.from("hitos_proyecto_empresa_extra_rows").select("*").eq("proyecto_empresa_id", proyectoEmpresaId!).order("orden"),
      ]);
      if (vRes.error) throw vRes.error;
      if (eRes.error) throw eRes.error;
      return { values: (vRes.data || []) as HitosValue[], extraRows: (eRes.data || []) as HitosExtraRow[] };
    },
  });
}

export function useHitosProyectoEmpresaMutations(proyectoEmpresaId: string | null) {
  const qc = useQueryClient();
  const invalidate = async () => {
    if (proyectoEmpresaId) await qc.invalidateQueries({ queryKey: ["hitos-values", proyectoEmpresaId] });
  };

  const upsertValue = useMutation({
    mutationFn: async ({
      row_id, extra_row_id, column_id, valor,
    }: { row_id: string | null; extra_row_id: string | null; column_id: string; valor: string }) => {
      if (!proyectoEmpresaId) throw new Error("Falta proyecto_empresa_id");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Try update first then insert to handle the partial unique indexes
      let q = supabase.from("hitos_proyecto_empresa_values")
        .select("id")
        .eq("proyecto_empresa_id", proyectoEmpresaId)
        .eq("column_id", column_id);
      q = row_id ? q.eq("row_id", row_id).is("extra_row_id", null) : q.eq("extra_row_id", extra_row_id!).is("row_id", null);
      const { data: existing, error: selErr } = await q.maybeSingle();
      if (selErr) throw selErr;

      if (existing) {
        const { error } = await supabase.from("hitos_proyecto_empresa_values")
          .update({ valor }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hitos_proyecto_empresa_values")
          .insert({ proyecto_empresa_id: proyectoEmpresaId, row_id, extra_row_id, column_id, valor, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: () => toast.error("No se pudo guardar el cambio del hito"),
  });

  const addExtraRow = useMutation({
    mutationFn: async (orden: number) => {
      if (!proyectoEmpresaId) throw new Error("Falta proyecto_empresa_id");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase.from("hitos_proyecto_empresa_extra_rows")
        .insert({ proyecto_empresa_id: proyectoEmpresaId, orden, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("No se pudo agregar la fila"),
  });

  const deleteExtraRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hitos_proyecto_empresa_extra_rows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("No se pudo eliminar la fila"),
  });

  return { upsertValue, addExtraRow, deleteExtraRow };
}