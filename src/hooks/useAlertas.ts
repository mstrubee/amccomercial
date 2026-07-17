import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLogActivity } from "@/hooks/useActivityLog";

export interface AlertaClasificacionRow {
  id: string;
  alerta_id: string;
  clasificacion_id: string;
  subclasificacion_id: string | null;
}

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
  // Legacy single FK columns (kept for backward compat, but junction table is source of truth)
  clasificacion_alerta_id: string | null;
  subclasificacion_alerta_id: string | null;
  // New: from junction table
  alerta_clasificaciones: AlertaClasificacionRow[];
}

export interface AlertaWithRelations extends AlertaRow {
  proyectos: { id: string; nombre: string; numero: number } | null;
  empresas: { id: string; nombre: string } | null;
  responsable_profile: { display_name: string } | null;
}

async function fetchAllAlertas(includeDeleted: boolean = false) {
  const allData: any[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from("alertas")
      .select("*, proyectos(id, nombre, numero), empresas(id, nombre), cat_proyecto:categorias_proyecto!alertas_categoria_proyecto_id_fkey(id, nombre, color), subcat_proyecto:subcategorias_proyecto!alertas_subcategoria_proyecto_id_fkey(id, nombre, color)")
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

async function fetchAlertaClasificaciones(alertaIds: string[]): Promise<Record<string, AlertaClasificacionRow[]>> {
  if (alertaIds.length === 0) return {};
  const map: Record<string, AlertaClasificacionRow[]> = {};

  // Fetch in batches of 500 IDs
  for (let i = 0; i < alertaIds.length; i += 500) {
    const batch = alertaIds.slice(i, i + 500);
    const { data, error } = await supabase
      .from("alerta_clasificaciones")
      .select("*")
      .in("alerta_id", batch);
    if (error) throw error;
    for (const row of (data || [])) {
      if (!map[row.alerta_id]) map[row.alerta_id] = [];
      map[row.alerta_id].push(row as AlertaClasificacionRow);
    }
  }
  return map;
}

async function enrichWithProfiles(data: any[], allUserFields: boolean = false) {
  const userIds = [...new Set(data.flatMap((a: any) =>
    allUserFields
      ? [a.usuario_responsable_id, a.created_by, a.completed_by, a.updated_by, a.deleted_by].filter(Boolean)
      : [a.usuario_responsable_id]
  ))];
  let profilesMap: Record<string, { display_name: string }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    if (profiles) {
      profiles.forEach((p: any) => {
        profilesMap[p.user_id] = { display_name: p.display_name };
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
      const alertaIds = data.map((a: any) => a.id);
      const clasificacionesMap = await fetchAlertaClasificaciones(alertaIds);

      return data.map((a: any) => ({
        ...a,
        responsable_profile: profilesMap[a.usuario_responsable_id] || null,
        alerta_clasificaciones: clasificacionesMap[a.id] || [],
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
      const alertaIds = data.map((a: any) => a.id);
      const clasificacionesMap = await fetchAlertaClasificaciones(alertaIds);

      return data.map((a: any) => ({
        ...a,
        responsable_profile: profilesMap[a.usuario_responsable_id] || null,
        alerta_clasificaciones: clasificacionesMap[a.id] || [],
        _profilesMap: profilesMap,
      })) as (AlertaWithRelations & { _profilesMap: Record<string, { display_name: string }> })[];
    },
  });
}

export interface ClasificacionSelection {
  clasificacion_id: string;
  subclasificacion_id: string | null;
}

export interface AlertaInput {
  proyecto_id: string;
  empresa_id: string | null;
  titulo: string;
  texto: string;
  usuario_responsable_id: string;
  fecha_seguimiento: string;
  parent_alerta_id?: string | null;
  clasificaciones?: ClasificacionSelection[];
  categoria_proyecto_id?: string | null;
  subcategoria_proyecto_id?: string | null;
  // Legacy - still accepted for backward compat but junction table is preferred
  clasificacion_alerta_id?: string | null;
  subclasificacion_alerta_id?: string | null;
}

async function syncClasificaciones(alertaId: string, clasificaciones: ClasificacionSelection[]) {
  // Delete existing
  await supabase.from("alerta_clasificaciones").delete().eq("alerta_id", alertaId);
  // Insert new
  if (clasificaciones.length > 0) {
    const rows = clasificaciones.map(c => ({
      alerta_id: alertaId,
      clasificacion_id: c.clasificacion_id,
      subclasificacion_id: c.subclasificacion_id,
    }));
    const { error } = await supabase.from("alerta_clasificaciones").insert(rows as any);
    if (error) throw error;
  }
}

export function useCreateAlerta() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async (input: AlertaInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { parent_alerta_id, clasificaciones, clasificacion_alerta_id, subclasificacion_alerta_id, categoria_proyecto_id, subcategoria_proyecto_id, ...rest } = input;

      // Use first clasificacion for legacy column (backward compat)
      const firstClasif = clasificaciones?.[0];

      const { data, error } = await supabase.from("alertas").insert({
        ...rest,
        created_by: user.id,
        ...(parent_alerta_id ? { parent_alerta_id } : {}),
        clasificacion_alerta_id: firstClasif?.clasificacion_id || clasificacion_alerta_id || null,
        subclasificacion_alerta_id: firstClasif?.subclasificacion_id || subclasificacion_alerta_id || null,
        categoria_proyecto_id: categoria_proyecto_id || null,
        subcategoria_proyecto_id: subcategoria_proyecto_id || null,
      } as any).select("id").single();
      if (error) throw error;

      // Sync junction table
      if (clasificaciones && clasificaciones.length > 0 && data) {
        await syncClasificaciones(data.id, clasificaciones);
      }

      // Sync proyecto_empresas category
      if (rest.empresa_id && (categoria_proyecto_id || subcategoria_proyecto_id)) {
        await supabase.from("proyecto_empresas")
          .update({
            categoria_id: categoria_proyecto_id || null,
            subcategoria_id: subcategoria_proyecto_id || null,
          } as any)
          .eq("proyecto_id", rest.proyecto_id)
          .eq("empresa_id", rest.empresa_id);
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      qc.invalidateQueries({ queryKey: ["proyecto-empresas-categorias"] });
      // HOOK-004: invalidate proyectos when the mutation also updates proyecto_empresas
      if (variables.empresa_id && (variables.categoria_proyecto_id || variables.subcategoria_proyecto_id)) {
        qc.invalidateQueries({ queryKey: ["proyectos"] });
      }
      const details = (variables as any).on_behalf_of
        ? `${variables.proyecto_id}|a nombre de ${(variables as any).on_behalf_of}`
        : variables.proyecto_id;
      logActivity.mutate({ action: "crear", entity_type: "alerta", entity_name: variables.titulo, details });
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
      const { id, parent_alerta_id, clasificaciones, clasificacion_alerta_id, subclasificacion_alerta_id, categoria_proyecto_id, subcategoria_proyecto_id, ...rest } = input;

      const updatePayload: Record<string, unknown> = { ...rest, updated_by: user.id };

      // Only write the classification/category columns when the caller actually
      // provided them. A partial update — e.g. onUncomplete sending just a new
      // fecha_seguimiento — must NOT null out the alert's existing clasificación
      // and categoría. The form always sends these fields, so its behavior is
      // unchanged.
      if (clasificaciones !== undefined || clasificacion_alerta_id !== undefined || subclasificacion_alerta_id !== undefined) {
        const firstClasif = clasificaciones?.[0];
        updatePayload.clasificacion_alerta_id = firstClasif?.clasificacion_id || clasificacion_alerta_id || null;
        updatePayload.subclasificacion_alerta_id = firstClasif?.subclasificacion_id || subclasificacion_alerta_id || null;
      }
      if (categoria_proyecto_id !== undefined || subcategoria_proyecto_id !== undefined) {
        updatePayload.categoria_proyecto_id = categoria_proyecto_id || null;
        updatePayload.subcategoria_proyecto_id = subcategoria_proyecto_id || null;
      }

      const { error } = await supabase
        .from("alertas")
        .update(updatePayload as any)
        .eq("id", id);
      if (error) throw error;

      // Sync junction table
      if (clasificaciones) {
        await syncClasificaciones(id, clasificaciones);
      }

      // Sync proyecto_empresas category
      if (rest.empresa_id && (categoria_proyecto_id || subcategoria_proyecto_id)) {
        await supabase.from("proyecto_empresas")
          .update({
            categoria_id: categoria_proyecto_id || null,
            subcategoria_id: subcategoria_proyecto_id || null,
          } as any)
          .eq("proyecto_id", rest.proyecto_id)
          .eq("empresa_id", rest.empresa_id);
      }
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      qc.invalidateQueries({ queryKey: ["proyecto-empresas-categorias"] });
      // HOOK-004: invalidate proyectos when the mutation also updates proyecto_empresas
      if (variables.empresa_id && (variables.categoria_proyecto_id || variables.subcategoria_proyecto_id)) {
        qc.invalidateQueries({ queryKey: ["proyectos"] });
      }
      logActivity.mutate({ action: "editar", entity_type: "alerta", entity_id: variables.id, entity_name: variables.titulo, details: variables.proyecto_id });
    },
    onError: (e) => toast.error("Error al actualizar: " + e.message),
  });
}

export function useToggleAlertaCompletada() {
  const qc = useQueryClient();
  const logActivity = useLogActivity();
  return useMutation({
    mutationFn: async ({ id, completada, on_behalf_of }: { id: string; completada: boolean; on_behalf_of?: string }) => {
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
      return { on_behalf_of };
    },
    onSuccess: (result, variables) => {
      qc.invalidateQueries({ queryKey: ["alertas"] });
      qc.invalidateQueries({ queryKey: ["alertas-all"] });
      const details = result?.on_behalf_of ? `a nombre de ${result.on_behalf_of}` : undefined;
      logActivity.mutate({ action: variables.completada ? "completar" : "restaurar", entity_type: "alerta", entity_id: variables.id, details });
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
