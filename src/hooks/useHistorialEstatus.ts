import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { todayLocalISO } from "@/lib/date-utils";
import { fechaNoAnterior, historialVigente, mismoEstatus } from "@/lib/estatusVigente";

export interface HistorialEstatusRow {
  id: string;
  proyecto_empresa_id: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  monto_uf: number;
  /** Puede ser null en entradas creadas al completar historial faltante (sin fecha). */
  fecha: string | null;
  created_by: string;
  created_at: string;
}

/**
 * Registra un cambio de estatus de una empresa en un proyecto y deja el estatus
 * guardado en `proyecto_empresas` igual a la entrada más reciente del historial.
 *
 * Es el ÚNICO camino que debe usarse para cambiar un estatus fuera del formulario
 * de proyecto: sin entrada de historial el cambio no se vería (el estatus vigente
 * sale del historial). La fecha nunca es anterior a la de la última entrada, para
 * que el cambio siempre quede como el más reciente.
 *
 * Devuelve true si creó una entrada nueva; false si el estatus ya era el vigente
 * (en ese caso solo se asegura que el estatus guardado coincida).
 */
export async function registrarCambioEstatus(input: {
  proyecto_empresa_id: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  monto_uf?: number;
  fecha?: string | null;
  /** No crear una entrada si el estatus ya es el vigente. */
  omitirSiIgual?: boolean;
}): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("No autenticado");

  const { data: rows, error: selErr } = await (supabase.from("historial_estatus_empresa" as any) as any)
    .select("id, categoria_id, subcategoria_id, fecha, created_at")
    .eq("proyecto_empresa_id", input.proyecto_empresa_id);
  if (selErr) throw selErr;
  const ultimo = historialVigente((rows || []) as HistorialEstatusRow[]);

  let creada = false;
  if (!(input.omitirSiIgual && ultimo && mismoEstatus(ultimo, input))) {
    const { error: insErr } = await (supabase.from("historial_estatus_empresa" as any) as any).insert({
      proyecto_empresa_id: input.proyecto_empresa_id,
      categoria_id: input.categoria_id,
      subcategoria_id: input.subcategoria_id,
      monto_uf: input.monto_uf ?? 0,
      fecha: fechaNoAnterior(input.fecha, todayLocalISO(), ultimo),
      created_by: uid,
    });
    if (insErr) throw insErr;
    creada = true;
  }

  // El estatus guardado siempre queda igual a la entrada más reciente.
  const { error: updErr } = await supabase
    .from("proyecto_empresas")
    .update({ categoria_id: input.categoria_id, subcategoria_id: input.subcategoria_id })
    .eq("id", input.proyecto_empresa_id);
  if (updErr) throw updErr;
  return creada;
}

/**
 * Estatus vigente de una empresa en un proyecto (entrada más reciente del
 * historial). Si todavía no tiene historial, devuelve el estatus guardado.
 * Devuelve null si la empresa no está vinculada al proyecto.
 */
export async function obtenerEstatusVigente(
  proyecto_id: string,
  empresa_id: string,
): Promise<{ categoria_id: string | null; subcategoria_id: string | null } | null> {
  const { data: pe, error } = await supabase
    .from("proyecto_empresas")
    .select("id, categoria_id, subcategoria_id")
    .eq("proyecto_id", proyecto_id)
    .eq("empresa_id", empresa_id)
    .maybeSingle();
  if (error) throw error;
  if (!pe) return null;
  const { data: rows, error: hErr } = await (supabase.from("historial_estatus_empresa" as any) as any)
    .select("categoria_id, subcategoria_id, fecha, created_at")
    .eq("proyecto_empresa_id", pe.id);
  if (hErr) throw hErr;
  const ultimo = historialVigente((rows || []) as HistorialEstatusRow[]);
  return ultimo
    ? { categoria_id: ultimo.categoria_id, subcategoria_id: ultimo.subcategoria_id }
    : { categoria_id: pe.categoria_id, subcategoria_id: pe.subcategoria_id };
}

/** Como registrarCambioEstatus, pero ubicando la fila por proyecto + empresa. Devuelve false si no hay vínculo. */
export async function registrarCambioEstatusPorProyectoEmpresa(input: {
  proyecto_id: string;
  empresa_id: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  omitirSiIgual?: boolean;
}): Promise<boolean> {
  const { data: pe, error } = await supabase
    .from("proyecto_empresas")
    .select("id, ganado_presupuesto")
    .eq("proyecto_id", input.proyecto_id)
    .eq("empresa_id", input.empresa_id)
    .maybeSingle();
  if (error) throw error;
  if (!pe) return false;
  await registrarCambioEstatus({
    proyecto_empresa_id: pe.id,
    categoria_id: input.categoria_id,
    subcategoria_id: input.subcategoria_id,
    monto_uf: Number(pe.ganado_presupuesto || 0),
    omitirSiIgual: input.omitirSiIgual ?? true,
  });
  return true;
}

export function useHistorialEstatusByIds(ids: string[]) {
  const qc = useQueryClient();
  useEffect(() => {
    if (ids.length === 0) return;
    const channelId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`historial-estatus-rt:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "historial_estatus_empresa" },
        () => {
          qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, ids.length]);

  return useQuery({
    queryKey: ["historial_estatus_empresa", "bulk", ids.sort().join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      // Fetch ALL rows via pagination to avoid Supabase's 1000-row default
      // and the URL-length limit when `.in()` carries thousands of IDs.
      const idSet = new Set(ids);
      const pageSize = 1000;
      const all: HistorialEstatusRow[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await (supabase.from("historial_estatus_empresa" as any) as any)
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const batch = (data || []) as HistorialEstatusRow[];
        for (const row of batch) {
          if (idSet.has(row.proyecto_empresa_id)) all.push(row);
        }
        if (batch.length < pageSize) break;
      }
      return all;
    },
  });
}

export function useCreateHistorialEstatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      proyecto_empresa_id: string;
      categoria_id: string | null;
      subcategoria_id: string | null;
      monto_uf: number;
      fecha: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("No autenticado");
      const { data, error } = await (supabase.from("historial_estatus_empresa" as any) as any)
        .insert({ ...input, created_by: uid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
    },
    onError: (e: any) => toast.error("Error al guardar historial: " + e.message),
  });
}

export function useDeleteHistorialEstatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("historial_estatus_empresa" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
      toast.success("Entrada eliminada");
    },
    onError: (e: any) => toast.error("Error al eliminar entrada: " + e.message),
  });
}

export function useDeleteHistorialEstatusBulk() {
  const qc = useQueryClient();
  return useMutation({
    // `conservarId`: entrada que NO se borra (la vigente). Borrar la entrada más
    // reciente cambiaría el estatus vigente desde el historial, y el historial es
    // un registro, no un selector de estatus.
    mutationFn: async (arg: string | { proyecto_empresa_id: string; conservarId?: string }) => {
      const proyecto_empresa_id = typeof arg === "string" ? arg : arg.proyecto_empresa_id;
      const conservarId = typeof arg === "string" ? undefined : arg.conservarId;
      let q = (supabase.from("historial_estatus_empresa" as any) as any)
        .delete()
        .eq("proyecto_empresa_id", proyecto_empresa_id);
      if (conservarId) q = q.neq("id", conservarId);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
      toast.success("Historial eliminado");
    },
    onError: (e: any) => toast.error("Error al eliminar historial: " + e.message),
  });
}
