import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseDateFromText, type ChecklistItem } from "./useEmpresaChecklist";

/** Fetch checklist items scoped to a project only (empresa_id IS NULL). */
export function useProyectoChecklistItems(proyectoId: string | null | undefined) {
  return useQuery({
    queryKey: ["proyecto-checklist", proyectoId],
    enabled: !!proyectoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_checklist_items")
        .select("*")
        .is("empresa_id", null)
        .eq("proyecto_id", proyectoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown) as ChecklistItem[];
    },
  });
}

export function useAddProyectoChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proyecto_id: string; text: string; parent_id?: string | null }) => {
      const { date, cleanText } = parseDateFromText(input.text);
      const { data: userData } = await supabase.auth.getUser();
      const row: any = {
        empresa_id: null,
        proyecto_id: input.proyecto_id,
        text: cleanText || input.text,
        parent_id: input.parent_id || null,
        created_by: userData?.user?.id || null,
      };
      if (date) row.created_at = date.toISOString();
      const { data, error } = await supabase.from("empresa_checklist_items").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyecto-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });
}

export function useToggleProyectoChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; proyecto_id: string; is_completed: boolean; user_id: string }) => {
      const update: any = { is_completed: input.is_completed };
      if (input.is_completed) {
        update.completed_at = new Date().toISOString();
        update.completed_by = input.user_id;
      } else {
        update.completed_at = null;
        update.completed_by = null;
      }
      const { error } = await supabase.from("empresa_checklist_items").update(update).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyecto-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });
}

export function useUpdateProyectoChecklistItemText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; proyecto_id: string; text: string }) => {
      const { error } = await supabase.from("empresa_checklist_items").update({ text: input.text }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyecto-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });
}

export function useUpdateProyectoChecklistItemDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; proyecto_id: string; created_at: string }) => {
      const { error } = await supabase.from("empresa_checklist_items").update({ created_at: input.created_at }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyecto-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });
}

export function useDeleteProyectoChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; proyecto_id: string }) => {
      const { error } = await supabase.from("empresa_checklist_items").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyecto-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });
}

export function useDeleteProyectoChecklistItemRecursive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; proyecto_id: string; allItems: ChecklistItem[] }) => {
      const ids = new Set<string>();
      const collect = (parentId: string) => {
        ids.add(parentId);
        input.allItems.filter((i) => i.parent_id === parentId).forEach((i) => collect(i.id));
      };
      collect(input.id);
      const { error } = await supabase.from("empresa_checklist_items").delete().in("id", Array.from(ids));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proyecto-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e: any) => toast.error("Error: " + e.message),
  });
}