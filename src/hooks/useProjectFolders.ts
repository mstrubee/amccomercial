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
  is_repo_comun: boolean;
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

      // Fetch empresas linked to ALL projects in the same group (same name)
      const { data: siblingProjects } = await supabase
        .from("proyectos")
        .select("id")
        .eq("nombre", projectName);
      const allProjectIds = (siblingProjects || []).map((p: any) => p.id);
      if (allProjectIds.length === 0) allProjectIds.push(projectId);

      const { data: peRows } = await supabase
        .from("proyecto_empresas")
        .select("empresa_id, empresas(nombre)")
        .in("proyecto_id", allProjectIds);
      const empresaNames = new Set(
        (peRows || []).map((r: any) => (r.empresas?.nombre || "").toLowerCase())
      );

      const typedTemplates = templates as unknown as FolderTemplate[];
      const tree = buildTree(typedTemplates);

      const insertRecursive = async (
        nodes: FolderTreeNode[],
        parentId: string | null,
        parentIsRepoComun?: boolean,
        isInsideEmpresas?: boolean
      ) => {
        for (const node of nodes) {
          // If inside "Empresas" root, skip children not matching a project empresa
          if (isInsideEmpresas && parentId !== null) {
            // This is a direct child of the "Empresas" folder — filter by name
            // Actually we need to check depth: direct children of Empresas root
          }

          const isEmpresasRoot = parentId === null && node.name.toLowerCase() === "empresas";
          const isComun = parentId === null ? (node as any).is_repo_comun || false : parentIsRepoComun || false;

          const { data: inserted, error } = await supabase
            .from("project_folders" as any)
            .insert({
              name: node.name,
              project_id: projectId,
              parent_id: parentId,
              template_id: node.id,
              orden: node.orden,
              is_repo_comun: isComun,
            } as any)
            .select()
            .single();
          if (error) throw error;

          if (node.children.length > 0) {
            if (isEmpresasRoot) {
              // Only insert children whose name matches a project empresa
              const filtered = node.children.filter(c =>
                empresaNames.has(c.name.toLowerCase())
              );
              await insertRecursive(filtered, (inserted as any).id, isComun, true);
            } else {
              await insertRecursive(node.children, (inserted as any).id, isComun, isInsideEmpresas);
            }
          }
        }
      };

      await insertRecursive(tree, null);
    },
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: ["project_folders", projectId] }),
  });
}

/**
 * Incremental sync: compare folder_templates with project_folders (via template_id)
 * and insert missing folders / update is_repo_comun flag.
 */
export function useSyncTemplateToProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      // First get the project name to find all siblings in the group
      const { data: thisProject } = await supabase
        .from("proyectos")
        .select("nombre")
        .eq("id", projectId)
        .single();
      const projectName = thisProject?.nombre || "";

      // Find all sibling project IDs (same name = same group)
      const { data: siblingProjects } = await supabase
        .from("proyectos")
        .select("id")
        .eq("nombre", projectName);
      const allProjectIds = (siblingProjects || []).map((p: any) => p.id);
      if (allProjectIds.length === 0) allProjectIds.push(projectId);

      // Fetch templates + project folders + empresas from ALL siblings in parallel
      const [templatesRes, foldersRes, empresasRes] = await Promise.all([
        supabase.from("folder_templates" as any).select("*").order("orden", { ascending: true }),
        supabase.from("project_folders" as any).select("*").eq("project_id", projectId),
        supabase.from("proyecto_empresas").select("empresa_id, empresas(nombre)").in("proyecto_id", allProjectIds),
      ]);

      if (templatesRes.error) throw templatesRes.error;
      if (foldersRes.error) throw foldersRes.error;

      const templates = (templatesRes.data || []) as unknown as FolderTemplate[];
      const projectFolders = (foldersRes.data || []) as unknown as ProjectFolder[];
      const empresaNames = new Set(
        (empresasRes.data || []).map((r: any) => (r.empresas?.nombre || "").toLowerCase())
      );

      if (templates.length === 0 || projectFolders.length === 0) return { inserted: 0, updated: 0 };

      // Build lookup: template_id -> project_folder
      const templateToFolder = new Map<string, ProjectFolder>();
      for (const pf of projectFolders) {
        if (pf.template_id) templateToFolder.set(pf.template_id, pf);
      }

      const tree = buildTree(templates);
      let inserted = 0;
      let updated = 0;

      const syncRecursive = async (
        nodes: FolderTreeNode[],
        parentProjectFolderId: string | null,
        parentIsRepoComun: boolean,
        isInsideEmpresas: boolean
      ) => {
        for (const node of nodes) {
          const isEmpresasRoot = parentProjectFolderId === null && node.name.toLowerCase() === "empresas";
          const isComun = parentProjectFolderId === null ? node.is_repo_comun || false : parentIsRepoComun;

          const existing = templateToFolder.get(node.id);

          if (existing) {
            // Update is_repo_comun if it changed
            if (existing.is_repo_comun !== isComun) {
              await supabase
                .from("project_folders" as any)
                .update({ is_repo_comun: isComun } as any)
                .eq("id", existing.id);
              updated++;
            }

            // Recurse into children
            if (isEmpresasRoot) {
              const filtered = node.children.filter(c => empresaNames.has(c.name.toLowerCase()));
              await syncRecursive(filtered, existing.id, isComun, true);
            } else {
              await syncRecursive(node.children, existing.id, isComun, isInsideEmpresas);
            }
          } else {
            // Template folder not in project yet — insert it
            const { data: ins, error } = await supabase
              .from("project_folders" as any)
              .insert({
                name: node.name,
                project_id: projectId,
                parent_id: parentProjectFolderId,
                template_id: node.id,
                orden: node.orden,
                is_repo_comun: isComun,
              } as any)
              .select()
              .single();
            if (error) throw error;
            inserted++;

            // Recurse children of new folder
            if (node.children.length > 0) {
              if (isEmpresasRoot) {
                const filtered = node.children.filter(c => empresaNames.has(c.name.toLowerCase()));
                await syncRecursive(filtered, (ins as any).id, isComun, true);
              } else {
                await syncRecursive(node.children, (ins as any).id, isComun, isInsideEmpresas);
              }
            }
          }
        }
      };

      await syncRecursive(tree, null, false, false);
      return { inserted, updated };
    },
    onSuccess: (_, { projectId }) => qc.invalidateQueries({ queryKey: ["project_folders", projectId] }),
  });
}

/**
 * Filter a project folder tree for a specific empresa.
 * Shows: root folders with is_repo_comun=true + the Empresas/[empresaName] subtree.
 */
export function filterTreeForEmpresa(
  tree: ProjectFolderTreeNode[],
  empresaName: string
): ProjectFolderTreeNode[] {
  const result: ProjectFolderTreeNode[] = [];
  for (const root of tree) {
    if (root.is_repo_comun) {
      result.push(root);
    } else if (root.name.toLowerCase() === "empresas") {
      // Find the child matching the empresa name
      const match = root.children.find(
        (c) => c.name.toLowerCase() === empresaName.toLowerCase()
      );
      if (match) {
        result.push({ ...root, children: [match] });
      }
    }
  }
  return result;
}
