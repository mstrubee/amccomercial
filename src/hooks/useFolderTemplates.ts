import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FolderTemplate {
  id: string;
  name: string;
  parent_id: string | null;
  orden: number;
  created_at: string;
}

export interface FolderTreeNode extends FolderTemplate {
  children: FolderTreeNode[];
}

export function buildTree(flat: FolderTemplate[]): FolderTreeNode[] {
  const map = new Map<string, FolderTreeNode>();
  const roots: FolderTreeNode[] = [];

  for (const item of flat) {
    map.set(item.id, { ...item, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (nodes: FolderTreeNode[]) => {
    nodes.sort((a, b) => a.orden - b.orden || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function useFolderTemplates() {
  return useQuery({
    queryKey: ["folder_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("folder_templates" as any)
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FolderTemplate[];
    },
  });
}

export function useCreateFolderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; parent_id: string | null; orden?: number }) => {
      const { data, error } = await supabase
        .from("folder_templates" as any)
        .insert({ name: params.name, parent_id: params.parent_id, orden: params.orden ?? 0 } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder_templates"] }),
  });
}

export function useUpdateFolderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; name: string }) => {
      const { error } = await supabase
        .from("folder_templates" as any)
        .update({ name: params.name } as any)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder_templates"] }),
  });
}

export function useDeleteFolderTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("folder_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folder_templates"] }),
  });
}
