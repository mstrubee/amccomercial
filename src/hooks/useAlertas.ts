import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLogActivity } from "@/hooks/useActivityLog";

export interface AlertaRow {
  id: string;
  proyecto_id: string;
  empresa_id: string | null;
  titulo: string;
  texto: string;
  usuario_responsable_id: string;
  fecha_seguimiento: string;
  completada: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  parent_alerta_id: string | null;
  completed_by: string | null;
  completed_at: string | null;
  updated_by: string | null;
  deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  clasificacion_alerta_id: string | null;
  subclasificacion_alerta_id: string | null;
}

export interface AlertaWithRelations extends AlertaRow {
  proyectos: { id: string; nombre: string; numero: number } | null;
  empresas: { id: string; nombre: string } | null;
  responsable_profile: { display_name: string; email: string } | null;
}

async function fetchAllAlertas(includeDeleted: boolean = false) {
  const allData: any[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("alertas")
      .select("*, proyectos(id, nombre, numero), empresas(id, nombre)")
      .order("fecha_seguimiento", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (!includeDeleted) {
      query = query.eq("deleted", false);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allData.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

async function enrichWithProfiles(data: any[], allUserFields: boolean = false) {
  const userIds = [...new Set(data.flatMap((a: any) =>
    allUserFields
      ? [a.usuario_responsable_id, a.created_by, a.completed_by, a.updated_by, a.deleted_by].filter(Boolean)
      : [a.usuario_responsable_id]
  ))];
  let profilesMap: Record<string, { display_name: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", userIds);
    if (profiles) {
      profiles.forEach((p: any) => {
        profilesMap[p.user_id] = { display_name: p.display_name, email: p.email };
      });
    }
  }
  return profilesMap;
}

export function useAlertas() {
  return useQuery({
    queryKey: ["alertas"],
    queryFn: async () => {
      const data = await fetchAllAlertas(false);
      const profilesMap = await enrichWithProfiles(data);

      return data.map((a: any) => ({
        ...a,
        responsable_profile: profilesMap[a.usuario_responsable_id] || null,
      })) as AlertaWithRelations[];
    },
  });
}

/** Fetch all alertas including deleted (for tree view and restore) */
export function useAllAlertas() {
  return useQuery({
    queryKey: ["alertas-all"],
    queryFn: async () => {
      const data = await fetchAllAlertas(true);
      const profilesMap = await enrichWithProfiles(data, true);

      return data.map((a: any) => ({
        ...a,
        responsable_profile: profilesMap[a.usuario_responsable_id] || null,
        _profilesMap: profilesMap,
      })) as (AlertaWithRelations & { _profilesMap: Record<string, { display_name: string; email: string }> })[];
    },
  });
}

export interface AlertaInput {
  proyecto_id: string;
  empresa_id: string | null;
  titulo: string;
  texto: string;
  usuario_responsable_id: string;
  fecha_seguimiento: string;
  parent_alerta_id?: string | null;
  clasificacion_alerta_id?: string | null;
  subclasificacion_alerta_id?: string | null;
}

export function useCreateAlerta() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: AlertaInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { parent_alerta_id, ...rest } = input;
      const { error } = await supabase.from("alertas").insert({
        ...rest,
        created_by: user.id,
        ...(parent_alerta_id ? { parent_alerta_id } : {}),
        clasificacion_alerta_id: input.clasificacion_alerta_id || null,
        subclasificacion_alerta_id: input.subclasificacion_alerta_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      toast.success("Alerta creada exitosamente");
      logActivity.mutate({ action: "crear", entity_type: "alerta", entity_name: variables.titulo, details: variables.proyecto_id });
    },
    onError: (e) => toast.error("Error al crear alerta: " + e.message),
  });
}

export function useUpdateAlerta() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: AlertaInput & { id: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { id, parent_alerta_id, ...rest } = input;
      const { error } = await supabase
        .from("alertas")
        .update({
          ...rest,
          updated_by: user.id,
          clasificacion_alerta_id: input.clasificacion_alerta_id || null,
          subclasificacion_alerta_id: input.subclasificacion_alerta_id || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      toast.success("Alerta actualizada");
      logActivity.mutate({ action: "editar", entity_type: "alerta", entity_id: variables.id, entity_name: variables.titulo, details: variables.proyecto_id });
    },
    onError: (e) => toast.error("Error al actualizar: " + e.message),
  });
}

export function useToggleAlertaCompletada() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async ({ id, completada }: { id: string; completada: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const updateData: any = { completada };
      if (completada) {
        updateData.completed_by = user.id;
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_by = null;
        updateData.completed_at = null;
      }
      const { error } = await supabase
        .from("alertas")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      logActivity.mutate({ action: variables.completada ? "completar" : "restaurar", entity_type: "alerta", entity_id: variables.id });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

/** Soft delete */
export function useDeleteAlerta() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase
        .from("alertas")
        .update({ deleted: true, deleted_by: user.id, deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      toast.success("Alerta eliminada");
      logActivity.mutate({ action: "eliminar", entity_type: "alerta", entity_id: variables });
    },
    onError: (e) => toast.error("Error al eliminar: " + e.message),
  });
}

/** Restore soft-deleted alert */
export function useRestoreAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("alertas")
        .update({ deleted: false, deleted_by: null, deleted_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      toast.success("Alerta restaurada");
    },
    onError: (e) => toast.error("Error al restaurar: " + e.message),
  });
}
