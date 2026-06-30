import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistMentionRow {
  id: string;
  checklist_item_id: string;
  mentioned_user_id: string;
  proyecto_id: string | null;
  empresa_id: string;
  created_at: string;
  // joined fields when fetched for "my mentions" view
  checklist_item?: {
    id: string;
    text: string;
    created_at: string;
    created_by: string | null;
    empresa_id: string;
    proyecto_id: string | null;
  };
  proyecto?: { id: string; nombre: string } | null;
  empresa?: { id: string; nombre: string } | null;
  author?: { display_name: string | null } | null;
  mentioned?: { display_name: string | null } | null;
  is_read?: boolean;
}

/**
 * Fetch mentions visible to current user with joined item/project info and read state.
 * - When `scope = "all"` (admin), fetches every mention RLS allows.
 * - Otherwise, fetches only mentions targeted at `userId`.
 */
export function useMyMentions(userId: string | undefined, scope: "mine" | "all" = "mine") {
  return useQuery({
    queryKey: ["my-mentions", userId, scope],
    enabled: !!userId,
    queryFn: async (): Promise<ChecklistMentionRow[]> => {
      let q = supabase
        .from("checklist_mentions")
        .select(
          `id, checklist_item_id, mentioned_user_id, proyecto_id, empresa_id, created_at,
           checklist_item:empresa_checklist_items!checklist_mentions_checklist_item_id_fkey(id, text, created_at, created_by, empresa_id, proyecto_id)`,
        )
        .order("created_at", { ascending: false });
      if (scope === "mine") q = q.eq("mentioned_user_id", userId!);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [];
      // Resolve proyectos & empresas separately (no FK constraints declared)
      const proyectoIds = Array.from(new Set(rows.map((r) => r.proyecto_id).filter(Boolean)));
      const empresaIds = Array.from(new Set(rows.map((r) => r.empresa_id).filter(Boolean)));
      const proyectoMap: Record<string, { id: string; nombre: string }> = {};
      const empresaMap: Record<string, { id: string; nombre: string }> = {};
      if (proyectoIds.length) {
        const { data: ps } = await supabase.from("proyectos").select("id, nombre").in("id", proyectoIds);
        (ps || []).forEach((p: any) => { proyectoMap[p.id] = { id: p.id, nombre: p.nombre }; });
      }
      if (empresaIds.length) {
        const { data: es } = await supabase.from("empresas").select("id, nombre").in("id", empresaIds);
        (es || []).forEach((e: any) => { empresaMap[e.id] = { id: e.id, nombre: e.nombre }; });
      }
      // Fetch read state
      const ids = rows.map((r) => r.id);
      const { data: reads } = await supabase
        .from("checklist_mention_reads")
        .select("mention_id")
        .eq("user_id", userId!)
        .in("mention_id", ids);
      const readSet = new Set((reads || []).map((r: any) => r.mention_id));
      // Resolve authors + mentioned users in a single query
      const profileIds = Array.from(new Set([
        ...rows.map((r) => r.checklist_item?.created_by).filter(Boolean),
        ...rows.map((r) => r.mentioned_user_id).filter(Boolean),
      ]));
      const nameMap: Record<string, string> = {};
      if (profileIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", profileIds);
        (profs || []).forEach((p: any) => { if (p.display_name) nameMap[p.user_id] = p.display_name; });
      }
      return rows.map((r) => ({
        ...r,
        is_read: readSet.has(r.id),
        proyecto: r.proyecto_id ? proyectoMap[r.proyecto_id] || null : null,
        empresa: r.empresa_id ? empresaMap[r.empresa_id] || null : null,
        author: r.checklist_item?.created_by ? { display_name: nameMap[r.checklist_item.created_by] || null } : null,
        mentioned: r.mentioned_user_id ? { display_name: nameMap[r.mentioned_user_id] || null } : null,
      }));
    },
  });
}

/** Mark/unmark a mention as read for the current user. */
export function useToggleMentionRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mentionId, userId, read }: { mentionId: string; userId: string; read: boolean }) => {
      if (read) {
        const { error } = await supabase
          .from("checklist_mention_reads")
          .upsert({ mention_id: mentionId, user_id: userId }, { onConflict: "mention_id,user_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("checklist_mention_reads")
          .delete()
          .eq("mention_id", mentionId)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["my-mentions", vars.userId] });
      qc.invalidateQueries({ queryKey: ["my-mentions-count", vars.userId] });
    },
  });
}

/** Unread count of mentions for the given user. */
export function useMyMentionsUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-mentions-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: ments, error } = await supabase
        .from("checklist_mentions")
        .select("id")
        .eq("mentioned_user_id", userId!);
      if (error) throw error;
      const ids = (ments || []).map((m: any) => m.id);
      if (ids.length === 0) return 0;
      const { data: reads } = await supabase
        .from("checklist_mention_reads")
        .select("mention_id")
        .eq("user_id", userId!)
        .in("mention_id", ids);
      const readCount = (reads || []).length;
      return ids.length - readCount;
    },
    staleTime: 30 * 1000,
  });
}