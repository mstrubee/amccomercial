import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Folder, FolderPlus, Loader2, Check, X, FolderSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FolderTreeNode from "./FolderTreeNode";
import { useProjectFolders, useCreateProjectFolder, useUpdateProjectFolder, useDeleteProjectFolder, useGenerateFromTemplate, buildProjectTree } from "@/hooks/useProjectFolders";

interface Props {
  projectId: string | null;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
}

export default function ProyectoRepositorioDialog({ projectId, projectName, open, onOpenChange, canEdit = true }: Props) {
  const { data: folders, isLoading } = useProjectFolders(projectId);
  const createMutation = useCreateProjectFolder();
  const updateMutation = useUpdateProjectFolder();
  const deleteMutation = useDeleteProjectFolder();
  const generateMutation = useGenerateFromTemplate();

  const [creatingRoot, setCreatingRoot] = useState(false);
  const [rootName, setRootName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const rootInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingRoot) rootInputRef.current?.focus();
  }, [creatingRoot]);

  const tree = buildProjectTree(folders || []);
  const hasFolders = (folders || []).length > 0;

  const handleGenerate = async () => {
    if (!projectId) return;
    try {
      await generateMutation.mutateAsync(projectId);
      toast.success("Repositorio generado desde plantilla");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleCreate = async (parentId: string | null, name: string) => {
    if (!projectId) return;
    try {
      await createMutation.mutateAsync({ name, project_id: projectId, parent_id: parentId });
      toast.success("Carpeta creada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    if (!projectId) return;
    try {
      await updateMutation.mutateAsync({ id, name: newName, project_id: projectId });
      toast.success("Carpeta renombrada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !projectId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteTarget, project_id: projectId });
      toast.success("Carpeta eliminada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setDeleteTarget(null);
  };

  const handleRootSubmit = () => {
    const trimmed = rootName.trim();
    if (trimmed) {
      handleCreate(null, trimmed);
      setRootName("");
      setCreatingRoot(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-amber-500" />
              Repositorio — {projectName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !hasFolders ? (
              <div className="text-center py-12">
                <Folder className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground mb-4">Este proyecto no tiene carpetas aún.</p>
                {canEdit && (
                  <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2">
                    {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSync className="w-4 h-4" />}
                    Generar desde Repositorio Tipo
                  </Button>
                )}
              </div>
            ) : (
              <div>
                {canEdit && (
                  <div className="flex gap-2 mb-3">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreatingRoot(true)}>
                      <FolderPlus className="w-3.5 h-3.5" />
                      Nueva Carpeta Raíz
                    </Button>
                  </div>
                )}

                {creatingRoot && (
                  <div className="flex items-center gap-1 py-1 px-2 mb-2">
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    <Input
                      ref={rootInputRef}
                      value={rootName}
                      onChange={(e) => setRootName(e.target.value)}
                      placeholder="Nombre..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRootSubmit();
                        if (e.key === "Escape") { setCreatingRoot(false); setRootName(""); }
                      }}
                      className="h-6 text-xs py-0 px-1.5 flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleRootSubmit}>
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setCreatingRoot(false); setRootName(""); }}>
                      <X className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                )}

                {tree.map((node) => (
                  <FolderTreeNode
                    key={node.id}
                    node={node}
                    level={0}
                    onRename={handleRename}
                    onDelete={(id) => setDeleteTarget(id)}
                    onCreate={handleCreate}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar carpeta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la carpeta y todas sus subcarpetas. Esta acción solo afecta a este proyecto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
