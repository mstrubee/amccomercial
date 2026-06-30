import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ChecklistItem {
  id: string;
  empresa_id: string;
  proyecto_id: string | null;
  text: string;
  is_completed: boolean;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
  parent_id: string | null;
  created_by: string | null;
}

/** Fetch checklist items for a specific proyecto + empresa combo */
export function useEmpresaChecklistItems(empresaId: string | null, proyectoId?: string | null) {
  return useQuery({
    queryKey: ["empresa-checklist", empresaId, proyectoId],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("empresa_checklist_items")
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("created_at", { ascending: true });
      if (proyectoId) q = q.eq("proyecto_id", proyectoId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ChecklistItem[];
    },
  });
}

/** Fetch ALL checklist items (for Reuniones page) */
export function useAllChecklistItems() {
  return useQuery({
    queryKey: ["empresa-checklist-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresa_checklist_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ChecklistItem[];
    },
  });
}

function parseDateFromText(raw: string): { date: Date | null; cleanText: string } {
  const patterns = [
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*/,
    /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\s*/,
    /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2})\s*/,
    /^(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*/i,
  ];

  const monthNames: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };

  let m = raw.match(patterns[0]);
  if (m) {
    const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 12);
    return { date: d, cleanText: raw.slice(m[0].length).trim() };
  }
  m = raw.match(patterns[1]);
  if (m) {
    const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]), 12);
    return { date: d, cleanText: raw.slice(m[0].length).trim() };
  }
  m = raw.match(patterns[2]);
  if (m) {
    const yr = 2000 + parseInt(m[3]);
    const d = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]), 12);
    return { date: d, cleanText: raw.slice(m[0].length).trim() };
  }
  m = raw.match(patterns[3]);
  if (m) {
    const mon = monthNames[m[2].toLowerCase()];
    const d = new Date(new Date().getFullYear(), mon, parseInt(m[1]), 12);
    return { date: d, cleanText: raw.slice(m[0].length).trim() };
  }

  // mm.dd format (no year) → use current year
  const mmddPattern = /^(\d{1,2})[.\-/](\d{1,2})\s*/;
  m = raw.match(mmddPattern);
  if (m) {
    const mo = parseInt(m[1]);
    const da = parseInt(m[2]);
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      const d = new Date(new Date().getFullYear(), mo - 1, da, 12);
      return { date: d, cleanText: raw.slice(m[0].length).trim() };
    }
  }

  return { date: null, cleanText: raw };
}

export { parseDateFromText };

/** Check if text starts with a date pattern (yyyy.mm.dd, dd.mm.yyyy, dd.mm.yy, mm.dd, or "dd de mes") */
export function startsWithDate(text: string): boolean {
  const t = text.trim();
  return /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(t) ||
    /^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(t) ||
    /^\d{1,2}[.\-/]\d{1,2}(\s|$)/.test(t) ||
    /^\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i.test(t);
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { empresa_id: string; proyecto_id?: string | null; text: string; parent_id?: string | null }) => {
      const { date, cleanText } = parseDateFromText(input.text);
      const { data: userData } = await supabase.auth.getUser();
      const row: any = {
        empresa_id: input.empresa_id,
        proyecto_id: input.proyecto_id || null,
        text: cleanText || input.text,
        parent_id: input.parent_id || null,
        created_by: userData?.user?.id || null,
      };
      if (date) row.created_at = date.toISOString();
      const { data, error } = await supabase.from("empresa_checklist_items").insert(row).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["empresa-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; empresa_id: string; is_completed: boolean; user_id: string }) => {
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
      qc.invalidateQueries({ queryKey: ["empresa-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateChecklistItemText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; empresa_id: string; text: string }) => {
      const { error } = await supabase.from("empresa_checklist_items").update({ text: input.text }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateChecklistItemDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; empresa_id: string; created_at: string }) => {
      const { error } = await supabase.from("empresa_checklist_items").update({ created_at: input.created_at }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; empresa_id: string }) => {
      const { error } = await supabase.from("empresa_checklist_items").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteChecklistItemRecursive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; empresa_id: string; allItems: ChecklistItem[] }) => {
      const ids = new Set<string>();
      const collect = (parentId: string) => {
        ids.add(parentId);
        input.allItems.filter(i => i.parent_id === parentId).forEach(i => collect(i.id));
      };
      collect(input.id);
      const { error } = await supabase.from("empresa_checklist_items").delete().in("id", Array.from(ids));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-checklist"] });
      qc.invalidateQueries({ queryKey: ["empresa-checklist-all"] });
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateEmpresaNotasAtencion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { empresa_id: string; notas: string }) => {
      const { error } = await supabase.from("empresas").update({ notas_atencion_especial: input.notas } as any).eq("id", input.empresa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}
