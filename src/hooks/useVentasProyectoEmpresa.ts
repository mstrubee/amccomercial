import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VentaRow {
  id: string;
  proyecto_empresa_id: string;
  monto_uf: number;
  descripcion: string;
  op: string;
  created_at: string;
}

export function useVentasByProyectoEmpresa(proyectoEmpresaId: string | null) {
  return useQuery({
    queryKey: ["ventas_proyecto_empresa", proyectoEmpresaId],
    enabled: !!proyectoEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas_proyecto_empresa")
        .select("*")
        .eq("proyecto_empresa_id", proyectoEmpresaId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as VentaRow[];
    },
  });
}

/** Fetch all ventas for a list of proyecto_empresa IDs (for listing totals) */
export function useVentasByProyectoEmpresaIds(ids: string[]) {
  return useQuery({
    queryKey: ["ventas_proyecto_empresa", "bulk", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      // Fetch ALL rows via pagination to avoid Supabase's 1000-row default
      // and the URL-length limit when `.in()` carries thousands of IDs.
      const idSet = new Set(ids);
      const pageSize = 1000;
      const all: VentaRow[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("ventas_proyecto_empresa")
          .select("*")
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as VentaRow[];
        for (const row of batch) {
          if (idSet.has(row.proyecto_empresa_id)) all.push(row);
        }
        if (batch.length < pageSize) break;
      }
      return all;
    },
  });
}

export function useCreateVenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proyecto_empresa_id: string; monto_uf: number; descripcion: string; op: string }) => {
      const { data, error } = await supabase
        .from("ventas_proyecto_empresa")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["ventas_proyecto_empresa"] });
      toast.success("Venta registrada");
    },
    onError: (e) => toast.error("Error al registrar venta: " + e.message),
  });
}

export function useDeleteVenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ventas_proyecto_empresa").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventas_proyecto_empresa"] });
      toast.success("Venta eliminada");
    },
    onError: (e) => toast.error("Error al eliminar venta: " + e.message),
  });
}
