import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Prioridad = "baja" | "media" | "alta" | "critica";
export type EstadoNota = "pendiente" | "en_progreso" | "resuelto";

export interface AdminNota {
  id: string;
  user_id: string;
  titulo: string;
  contenido: string;
  prioridad: Prioridad;
  estado: EstadoNota;
  elemento_ruta: string | null;
  elemento_selector: string | null;
  elemento_info: Record<string, string> | null;
  imagenes: string[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = "admin_notas";

export function useAdminNotas() {
  return useQuery({
    queryKey: [QUERY_KEY, "activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notas")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdminNota[];
    },
  });
}

export function useAdminNotasPapelera() {
  return useQuery({
    queryKey: [QUERY_KEY, "papelera"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_notas")
        .select("*")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data as AdminNota[];
    },
  });
}

type NuevaNota = Pick<AdminNota, "titulo" | "contenido" | "prioridad" | "estado"> & {
  elemento_ruta?: string | null;
  elemento_selector?: string | null;
  elemento_info?: Record<string, string> | null;
  imagenes?: string[];
};

export function useCrearNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nota: NuevaNota) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("admin_notas")
        .insert({ ...nota, user_id: user!.id, imagenes: nota.imagenes ?? [] })
        .select()
        .single();
      if (error) throw error;
      return data as AdminNota;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Nota creada");
    },
    onError: () => toast.error("Error al crear nota"),
  });
}

export function useActualizarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: Partial<AdminNota> & { id: string }) => {
      const { error } = await supabase.from("admin_notas").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
    onError: () => toast.error("Error al actualizar nota"),
  });
}

export function useEliminarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_notas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Nota movida a papelera");
    },
    onError: () => toast.error("Error al mover la nota a papelera"),
  });
}

export function useRestaurarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notas").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Nota restaurada");
    },
    onError: () => toast.error("Error al restaurar la nota"),
  });
}

export function usePurgarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Nota eliminada permanentemente");
    },
    onError: () => toast.error("Error al eliminar la nota"),
  });
}

export async function subirImagenNota(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("admin-notas-media").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("admin-notas-media").getPublicUrl(path);
  return data.publicUrl;
}

export const PRIORIDAD_CONFIG: Record<Prioridad, { label: string; color: string; bg: string }> = {
  baja: { label: "Baja", color: "text-green-700", bg: "bg-green-100" },
  media: { label: "Media", color: "text-amber-700", bg: "bg-amber-100" },
  alta: { label: "Alta", color: "text-orange-700", bg: "bg-orange-100" },
  critica: { label: "Crítica", color: "text-red-700", bg: "bg-red-100" },
};

export const ESTADO_CONFIG: Record<EstadoNota, { label: string; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", color: "text-slate-600", bg: "bg-slate-100" },
  en_progreso: { label: "En progreso", color: "text-blue-700", bg: "bg-blue-100" },
  resuelto: { label: "Resuelto", color: "text-green-700", bg: "bg-green-100" },
};
