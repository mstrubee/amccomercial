import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type ProyectoRow = Tables<"proyectos">;
export type ProyectoEmpresaRow = Tables<"proyecto_empresas">;

export type ProyectoWithEmpresas = ProyectoRow & {
  proyecto_empresas: (ProyectoEmpresaRow & {
    empresas: Tables<"empresas"> | null;
  })[];
};

export function useProyectos() {
  return useQuery({
    queryKey: ["proyectos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectos")
        .select("*, proyecto_empresas(*, empresas(*))")
        .order("numero", { ascending: true });
      if (error) throw error;
      return data as ProyectoWithEmpresas[];
    },
  });
}

export interface ProyectoInput {
  nombre: string;
  direccion: string;
  comuna: string;
  estado_obra: string;
  fecha_estado_obra: string | null;
  estado_amc: string;
  adjudicado: boolean;
  monto_estimado: number | null;
  arq_nombre: string;
  arq_contacto: string;
  arq_mail: string;
  arq_telefono: string;
  const_nombre: string;
  const_contacto: string;
  const_mail: string;
  const_telefono: string;
  ito_nombre: string;
  ito_contacto: string;
  ito_mail: string;
  ito_telefono: string;
  duenos_nombre: string;
  duenos_contacto: string;
  duenos_mail: string;
  duenos_telefono: string;
  empresas_ids: string[];
}

export function useCreateProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProyectoInput) => {
      const { empresas_ids, ...rest } = input;
      const { data: proyecto, error } = await supabase
        .from("proyectos")
        .insert(rest)
        .select()
        .single();
      if (error) throw error;

      if (empresas_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("proyecto_empresas")
          .insert(empresas_ids.map((eid) => ({ proyecto_id: proyecto.id, empresa_id: eid })));
        if (linkError) throw linkError;
      }
      return proyecto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success("Proyecto creado exitosamente");
    },
    onError: (e) => toast.error("Error al crear proyecto: " + e.message),
  });
}

export function useUpdateProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProyectoInput & { id: string }) => {
      const { empresas_ids, id, ...rest } = input;
      const { error } = await supabase
        .from("proyectos")
        .update(rest)
        .eq("id", id);
      if (error) throw error;

      // Replace empresa links
      const { error: delError } = await supabase
        .from("proyecto_empresas")
        .delete()
        .eq("proyecto_id", id);
      if (delError) throw delError;

      if (empresas_ids.length > 0) {
        const { error: linkError } = await supabase
          .from("proyecto_empresas")
          .insert(empresas_ids.map((eid) => ({ proyecto_id: id, empresa_id: eid })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success("Proyecto actualizado");
    },
    onError: (e) => toast.error("Error al actualizar: " + e.message),
  });
}

export function useDeleteProyecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proyectos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success("Proyecto eliminado");
    },
    onError: (e) => toast.error("Error al eliminar: " + e.message),
  });
}
