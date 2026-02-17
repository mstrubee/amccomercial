import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useLogActivity } from "@/hooks/useActivityLog";

export type EmpresaRow = Tables<"empresas">;
export type CondicionRow = Tables<"condiciones_comerciales">;
export type EmpresaWithCondiciones = EmpresaRow & {
  condiciones_comerciales: CondicionRow[];
};

export function useEmpresas() {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("*, condiciones_comerciales(*)")
        .order("nombre")
        .order("fecha_vigencia", {
          referencedTable: "condiciones_comerciales",
          ascending: true,
        });
      if (error) throw error;
      return data as EmpresaWithCondiciones[];
    },
  });
}

export function useCreateEmpresa() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: {
      nombre: string;
      estado: string;
      fecha_inicio_relacion: string;
      fee_fijo_mensual: number;
      esquema_comision: number;
      descripcion?: string;
    }) => {
      const { data: empresa, error: empError } = await supabase
        .from("empresas")
        .insert({
          nombre: input.nombre,
          estado: input.estado,
          fecha_inicio_relacion: input.fecha_inicio_relacion,
        })
        .select()
        .single();
      if (empError) throw empError;

      const { error: ccError } = await supabase
        .from("condiciones_comerciales")
        .insert({
          empresa_id: empresa.id,
          fee_fijo_mensual: input.fee_fijo_mensual,
          esquema_comision: input.esquema_comision,
          fecha_vigencia: input.fecha_inicio_relacion,
          descripcion: input.descripcion || "Condición inicial",
        });
      if (ccError) throw ccError;
      return empresa;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa creada exitosamente");
      logActivity.mutate({ action: "crear", entity_type: "empresa", entity_name: variables.nombre });
    },
    onError: (e) => toast.error("Error al crear empresa: " + e.message),
  });
}

export function useUpdateEmpresa() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      nombre: string;
      estado: string;
      fecha_inicio_relacion: string;
    }) => {
      const { error } = await supabase
        .from("empresas")
        .update({
          nombre: input.nombre,
          estado: input.estado,
          fecha_inicio_relacion: input.fecha_inicio_relacion,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa actualizada");
      logActivity.mutate({ action: "editar", entity_type: "empresa", entity_id: variables.id, entity_name: variables.nombre });
    },
    onError: (e) => toast.error("Error al actualizar: " + e.message),
  });
}

export function useDeleteEmpresa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empresas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Empresa eliminada");
    },
    onError: (e) => toast.error("Error al eliminar: " + e.message),
  });
}

export function useAddCondicion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      empresa_id: string;
      fee_fijo_mensual: number;
      esquema_comision: number;
      fecha_vigencia: string;
      descripcion?: string;
    }) => {
      const { error } = await supabase
        .from("condiciones_comerciales")
        .insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Nueva condición comercial agregada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateCondicion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      fee_fijo_mensual: number;
      esquema_comision: number;
      fecha_vigencia: string;
      descripcion?: string;
    }) => {
      const { id, ...rest } = input;
      const { error } = await supabase
        .from("condiciones_comerciales")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      toast.success("Condición comercial actualizada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
