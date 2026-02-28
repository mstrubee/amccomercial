import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Folder, FolderPlus, Loader2, Check, X, FolderSync, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import FolderTreeNode from "./FolderTreeNode";
import { useProjectFolders, useCreateProjectFolder, useUpdateProjectFolder, useDeleteProjectFolder, useGenerateFromTemplate, buildProjectTree } from "@/hooks/useProjectFolders";
import { useDriveAuthStatus, useGetDriveAuthUrl, useSyncDrive, useUploadToDrive } from "@/hooks/useDriveSync";

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
  const { data: driveStatus } = useDriveAuthStatus();
  const getAuthUrl = useGetDriveAuthUrl();
  const syncDrive = useSyncDrive();
  const uploadToDrive = useUploadToDrive();
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);

  const [creatingRoot, setCreatingRoot] = useState(false);
  const [rootName, setRootName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const rootInputRef = useRef<HTMLInputElement>(null);

  // Track whether we've already auto-synced for this dialog open
  const autoSyncedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      autoSyncedRef.current = false;
    }
  }, [open]);

  // Auto-sync when dialog opens and there are unsynced folders
  const triggerAutoSync = useCallback(async () => {
    if (!projectId || !driveStatus?.connected || syncDrive.isPending || autoSyncedRef.current) return;
    const hasUnsynced = (folders || []).some((f) => !f.drive_folder_id);
    if (!hasUnsynced || (folders || []).length === 0) return;
    autoSyncedRef.current = true;
    try {
      await syncDrive.mutateAsync({ projectId, projectName });
    } catch {
      // silent — user will see upload buttons missing for unsynced folders
    }
  }, [projectId, projectName, driveStatus?.connected, folders, syncDrive]);

  useEffect(() => {
    if (open && !isLoading && folders) {
      triggerAutoSync();
    }
  }, [open, isLoading, folders, triggerAutoSync]);

  useEffect(() => {
    if (creatingRoot) rootInputRef.current?.focus();
  }, [creatingRoot]);

  const tree = buildProjectTree(folders || []);
  const hasFolders = (folders || []).length > 0;

  const handleGenerate = async () => {
    if (!projectId) return;
    try {
      await generateMutation.mutateAsync({ projectId, projectName });
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
      // Auto-sync new folder to Drive
      if (driveStatus?.connected) {
        autoSyncedRef.current = false; // allow re-sync
      }
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

  const handleConnectDrive = async () => {
    try {
      const result = await getAuthUrl.mutateAsync();
      window.open(result.auth_url, "_blank", "width=600,height=700");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleUploadFile = async (driveFolderId: string, file: File) => {
    setUploadingFolderId(driveFolderId);
    try {
      const result = await uploadToDrive.mutateAsync({ file, driveFolderId });
      toast.success(`"${result.file_name}" subido exitosamente a Drive`);
    } catch (e: any) {
      if (e.message?.includes("NO_REFRESH_TOKEN")) {
        toast.error("Primero debes conectar Google Drive");
      } else {
        toast.error("Error al subir: " + e.message);
      }
    } finally {
      setUploadingFolderId(null);
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
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setCreatingRoot(true)}>
                      <FolderPlus className="w-3.5 h-3.5" />
                      Nueva Carpeta Raíz
                    </Button>

                    {!driveStatus?.connected && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={handleConnectDrive}
                        disabled={getAuthUrl.isPending}
                      >
                        {getAuthUrl.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                        Conectar Google Drive
                      </Button>
                    )}
                  </div>
                )}

                {syncDrive.isPending && (
                  <div className="mb-3 space-y-1">
                    <Progress value={undefined} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">Sincronizando carpetas con Google Drive...</p>
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
                    onUpload={driveStatus?.connected ? handleUploadFile : undefined}
                    isUploading={uploadToDrive.isPending}
                    uploadingFolderId={uploadingFolderId}
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
              ¿Estás seguro de eliminar esta carpeta? Se eliminarán también todas sus subcarpetas y este proceso no se puede deshacer.
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
