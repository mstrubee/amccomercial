import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderTemplate, buildTree, FolderTreeNode } from "./useFolderTemplates";

export interface ProjectFolder {
  id: string;
  name: string;
  project_id: string;
  parent_id: string | null;
  template_id: string | null;
  drive_folder_id: string | null;
  orden: number;
  created_at: string;
}

export interface ProjectFolderTreeNode extends ProjectFolder {
  children: ProjectFolderTreeNode[];
}

export function buildProjectTree(flat: ProjectFolder[]): ProjectFolderTreeNode[] {
  const map = new Map<string, ProjectFolderTreeNode>();
  const roots: ProjectFolderTreeNode[] = [];

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

  const sort = (nodes: ProjectFolderTreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

export function useProjectFolders(projectId: string | null) {
  return useQuery({
    queryKey: ["project_folders", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_folders" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProjectFolder[];
    },
  });
}

export function useCreateProjectFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; project_id: string; parent_id: string | null; orden?: number }) => {
      const { data, error } = await supabase
        .from("project_folders" as any)
        .insert({ name: params.name, project_id: params.project_id, parent_id: params.parent_id, orden: params.orden ?? 0 } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["project_folders", vars.project_id] }),
  });
}

export function useUpdateProjectFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; name: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_folders" as any)
        .update({ name: params.name } as any)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["project_folders", vars.project_id] }),
  });
}

export function useDeleteProjectFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from("project_folders" as any)
        .delete()
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["project_folders", vars.project_id] }),
  });
}

export function useGenerateFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, projectName }: { projectId: string; projectName: string }) => {
      // Fetch all templates
      const { data: templates, error: tErr } = await supabase
        .from("folder_templates" as any)
        .select("*")
        .order("orden", { ascending: true });
      if (tErr) throw tErr;
      if (!templates || templates.length === 0) throw new Error("No hay carpetas en el Repositorio Tipo");

      const typedTemplates = templates as unknown as FolderTemplate[];
      const tree = buildTree(typedTemplates);

      // Create root folder with project name
      const { data: rootFolder, error: rootErr } = await supabase
        .from("project_folders" as any)
        .insert({ name: projectName, project_id: projectId, parent_id: null, orden: 0 } as any)
        .select()
        .single();
      if (rootErr) throw rootErr;
      const rootId = (rootFolder as any).id;

      // Insert template tree under root folder
      const insertRecursive = async (nodes: FolderTreeNode[], parentId: string | null) => {
        for (const node of nodes) {
          const { data: inserted, error } = await supabase
            .from("project_folders" as any)
            .insert({
              name: node.name,
              project_id: projectId,
              parent_id: parentId,
              template_id: node.id,
              orden: node.orden,
            } as any)
            .select()
            .single();
          if (error) throw error;
          if (node.children.length > 0) {
            await insertRecursive(node.children, (inserted as any).id);
          }
        }
      };

      await insertRecursive(tree, rootId);
    },
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: ["project_folders", projectId] }),
  });
}
