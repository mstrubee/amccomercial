import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useLogActivity } from "@/hooks/useActivityLog";

export type ProyectoRow = Tables<"proyectos">;
export type ProyectoEmpresaRow = Tables<"proyecto_empresas">;

export type ProyectoWithEmpresas = ProyectoRow & {
  proyecto_empresas: (ProyectoEmpresaRow & {
    empresas: Tables<"empresas"> | null;
    categorias_proyecto: Tables<"categorias_proyecto"> | null;
    subcategorias_proyecto: Tables<"subcategorias_proyecto"> | null;
  })[];
  clasificaciones_proyecto: Tables<"clasificaciones_proyecto"> | null;
};

export interface EmpresaLink {
  empresa_id: string;
  monto_cotizacion: number;
  adjudicado: boolean;
  categoria_id: string | null;
  subcategoria_id: string | null;
  fecha_categoria: string | null;
}

export function useProyectos() {
  return useQuery({
    queryKey: ["proyectos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proyectos")
        .select("*, proyecto_empresas(*, empresas(*), categorias_proyecto(*), subcategorias_proyecto(*)), clasificaciones_proyecto(*)")
        .order("numero", { ascending: true });
      if (error) throw error;
      return data as ProyectoWithEmpresas[];
    },
  });
}

export interface ProyectoInput {
  nombre: string;
  region: string;
  direccion: string;
  comuna: string;
  estado_obra: string;
  fecha_estado_obra: string | null;
  estado_amc: string;
  monto_estimado: number | null;
  notas: string;
  fecha_ingreso: string;
  clasificacion_id: string | null;
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
  empresa_links: EmpresaLink[];
}

export function useCreateProyecto() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: ProyectoInput) => {
      const { empresa_links, fecha_ingreso, clasificacion_id, ...rest } = input;

      if (empresa_links.length === 0) {
        const { data: proyecto, error } = await supabase
          .from("proyectos")
          .insert({ ...rest, adjudicado: false, fecha_ingreso, clasificacion_id } as any)
          .select()
          .single();
        if (error) throw error;
        return proyecto;
      }

      const projects = empresa_links.map((el) => ({
        ...rest,
        adjudicado: el.adjudicado,
        fecha_ingreso,
        clasificacion_id,
      }));

      const { data: createdProjects, error } = await supabase
        .from("proyectos")
        .insert(projects as any[])
        .select();
      if (error) throw error;

      const links = createdProjects!.map((p: any, i: number) => ({
        proyecto_id: p.id,
        empresa_id: empresa_links[i].empresa_id,
        monto_cotizacion: empresa_links[i].monto_cotizacion || 0,
        adjudicado: empresa_links[i].adjudicado,
        categoria_id: empresa_links[i].categoria_id || null,
        subcategoria_id: empresa_links[i].subcategoria_id || null,
        fecha_categoria: empresa_links[i].fecha_categoria || null,
      }));

      const { error: linkError } = await supabase
        .from("proyecto_empresas")
        .insert(links);
      if (linkError) throw linkError;

      return createdProjects![0];
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success("Proyecto creado exitosamente");
      logActivity.mutate({ action: "crear", entity_type: "proyecto", entity_name: variables.nombre, details: variables.nombre });
    },
    onError: (e) => toast.error("Error al crear proyecto: " + e.message),
  });
}

export function useUpdateProyecto() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: ProyectoInput & { id: string }) => {
      const { empresa_links, id, fecha_ingreso, clasificacion_id, ...rest } = input;
      const adjudicado = empresa_links.some((el) => el.adjudicado);
      const { error } = await supabase
        .from("proyectos")
        .update({ ...rest, adjudicado, fecha_ingreso, clasificacion_id } as any)
        .eq("id", id);
      if (error) throw error;

      const { error: delError } = await supabase
        .from("proyecto_empresas")
        .delete()
        .eq("proyecto_id", id);
      if (delError) throw delError;

      if (empresa_links.length > 0) {
        const { error: linkError } = await supabase
          .from("proyecto_empresas")
          .insert(empresa_links.map((el) => ({
            proyecto_id: id,
            empresa_id: el.empresa_id,
            monto_cotizacion: el.monto_cotizacion || 0,
            adjudicado: el.adjudicado,
            categoria_id: el.categoria_id || null,
            subcategoria_id: el.subcategoria_id || null,
            fecha_categoria: el.fecha_categoria || null,
          })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success("Proyecto actualizado");
      logActivity.mutate({ action: "editar", entity_type: "proyecto", entity_id: variables.id, entity_name: variables.nombre, details: variables.nombre });
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

export function useUpdateNotas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notas }: { id: string; notas: string }) => {
      const { error } = await supabase
        .from("proyectos")
        .update({ notas } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.setQueryData(["proyectos"], (old: ProyectoWithEmpresas[] | undefined) => {
        if (!old) return [];
        return old.map((p) => p.id === variables.id ? { ...p, notas: variables.notas } : p);
      });
    },
    onError: (e) => toast.error("Error al guardar notas: " + e.message),
  });
}

export function useUpdateNotaGrupo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nota_grupo }: { id: string; nota_grupo: string }) => {
      const { error } = await supabase
        .from("proyectos")
        .update({ nota_grupo } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.setQueryData(["proyectos"], (old: ProyectoWithEmpresas[] | undefined) => {
        if (!old) return [];
        return old.map((p) => p.id === variables.id ? { ...p, nota_grupo: variables.nota_grupo } : p);
      });
    },
    onError: (e) => toast.error("Error al guardar nota: " + e.message),
  });
}
