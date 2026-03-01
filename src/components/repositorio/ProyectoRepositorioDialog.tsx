import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Folder, FolderPlus, Loader2, Check, X, FolderSync, ExternalLink, Clock, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import FolderTreeNode from "./FolderTreeNode";
import { useProjectFolders, useCreateProjectFolder, useUpdateProjectFolder, useDeleteProjectFolder, useGenerateFromTemplate, buildProjectTree, filterTreeForEmpresa, useSyncTemplateToProject } from "@/hooks/useProjectFolders";
import { useDriveAuthStatus, useGetDriveAuthUrl, useSyncDrive, useUploadToDrive, useDeleteDriveFolder, usePendingSyncCount, useProcessSyncQueue, useGetProjectDriveId, useAutoReconcileDrive } from "@/hooks/useDriveSync";

interface Props {
  projectId: string | null;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit?: boolean;
  filterEmpresaName?: string;
}

export default function ProyectoRepositorioDialog({ projectId, projectName, open, onOpenChange, canEdit = true, filterEmpresaName }: Props) {
  const { data: folders, isLoading } = useProjectFolders(projectId);
  const createMutation = useCreateProjectFolder();
  const updateMutation = useUpdateProjectFolder();
  const deleteMutation = useDeleteProjectFolder();
  const generateMutation = useGenerateFromTemplate();
  const syncTemplateMutation = useSyncTemplateToProject();
  const { data: driveStatus } = useDriveAuthStatus();
  const getAuthUrl = useGetDriveAuthUrl();
  const syncDrive = useSyncDrive();
  const uploadToDrive = useUploadToDrive();
  const deleteDriveFolder = useDeleteDriveFolder();
  const { data: pendingCount } = usePendingSyncCount(projectId);
  const processSyncQueue = useProcessSyncQueue();
  const getProjectDriveId = useGetProjectDriveId();
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [projectDriveUrl, setProjectDriveUrl] = useState<string | null>(null);
  const [resolvingDriveUrl, setResolvingDriveUrl] = useState(false);

  // Automatic background reconciliation: polls Drive every 30s + on window focus
  useAutoReconcileDrive(
    projectId,
    projectName,
    open && !!driveStatus?.connected && (folders || []).length > 0,
    30000
  );

  const [creatingRoot, setCreatingRoot] = useState(false);
  const [rootName, setRootName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; driveFolderId?: string | null } | null>(null);
  const rootInputRef = useRef<HTMLInputElement>(null);

  const autoSyncedRef = useRef(false);
  const templateSyncedRef = useRef(false);
  const queueIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Online detection — trigger sync queue when reconnecting
  useEffect(() => {
    const handleOnline = () => {
      console.log("Back online — processing sync queue");
      processSyncQueue.mutate();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    if (!open) {
      autoSyncedRef.current = false;
      templateSyncedRef.current = false;
      setProjectDriveUrl(null);
    }
  }, [open]);

  // Auto-sync template to project when dialog opens (once per open, if project has folders)
  useEffect(() => {
    if (open && !isLoading && folders && folders.length > 0 && projectId && !templateSyncedRef.current && !syncTemplateMutation.isPending) {
      templateSyncedRef.current = true;
      syncTemplateMutation.mutate({ projectId });
    }
  }, [open, isLoading, folders, projectId]);

  // Pre-resolve Drive folder URL when dialog opens and Drive is connected
  useEffect(() => {
    if (open && projectId && driveStatus?.connected && !projectDriveUrl && !resolvingDriveUrl) {
      setResolvingDriveUrl(true);
      getProjectDriveId.mutateAsync({ projectId, projectName })
        .then((result) => {
          const resolvedUrl = buildDriveFolderUrl(result.drive_folder_id);
          setProjectDriveUrl(resolvedUrl);
        })
        .catch(() => {
          // Will retry on button click
        })
        .finally(() => setResolvingDriveUrl(false));
    }
  }, [open, projectId, driveStatus?.connected]);

  const buildDriveFolderUrl = (folderValue: string) => {
    const rawValue = (folderValue || "").trim();
    const normalizedId = (() => {
      const fromFoldersPath = rawValue.match(/\/folders\/([^/?#]+)/i)?.[1];
      if (fromFoldersPath) return fromFoldersPath;

      return rawValue;
    })();

    return normalizedId ? `https://drive.google.com/drive/folders/${encodeURIComponent(normalizedId)}` : null;
  };

  const triggerSync = useCallback(async () => {
    if (!projectId || !driveStatus?.connected || syncDrive.isPending) return;
    try {
      await syncDrive.mutateAsync({ projectId, projectName });
    } catch {
      // silent
    }
  }, [projectId, projectName, driveStatus?.connected, syncDrive]);

  // Auto-sync on dialog open (once)
  useEffect(() => {
    if (open && !isLoading && folders && !autoSyncedRef.current && driveStatus?.connected && (folders || []).length > 0) {
      autoSyncedRef.current = true;
      triggerSync();
    }
  }, [open, isLoading, folders, driveStatus?.connected, triggerSync]);

  // Accelerated queue processing when there are pending items and dialog is open
  useEffect(() => {
    if (open && pendingCount && pendingCount > 0) {
      // Process immediately
      processSyncQueue.mutate();
      // Then poll every 15 seconds
      queueIntervalRef.current = setInterval(() => {
        if (!processSyncQueue.isPending) {
          processSyncQueue.mutate();
        }
      }, 15000);
    }
    return () => {
      if (queueIntervalRef.current) {
        clearInterval(queueIntervalRef.current);
        queueIntervalRef.current = null;
      }
    };
  }, [open, pendingCount]);

  useEffect(() => {
    if (creatingRoot) rootInputRef.current?.focus();
  }, [creatingRoot]);

  const fullTree = buildProjectTree(folders || []);
  const tree = filterEmpresaName ? filterTreeForEmpresa(fullTree, filterEmpresaName) : fullTree;
  const hasFolders = (folders || []).length > 0;

  const handleGenerate = async () => {
    if (!projectId) return;
    try {
      await generateMutation.mutateAsync({ projectId, projectName });
      toast.success("Repositorio generado desde plantilla");
      // Trigger sync to create all folders in Drive
      triggerSync();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleCreate = async (parentId: string | null, name: string) => {
    if (!projectId) return;
    try {
      await createMutation.mutateAsync({ name, project_id: projectId, parent_id: parentId });
      toast.success("Carpeta creada");
      // Trigger sync to create folder in Drive
      triggerSync();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    if (!projectId) return;
    try {
      await updateMutation.mutateAsync({ id, name: newName, project_id: projectId });
      toast.success("Carpeta renombrada");
      // Trigger sync to rename folder in Drive
      triggerSync();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !projectId) return;
    try {
      // Delete from Drive if synced
      if (deleteTarget.driveFolderId && driveStatus?.connected) {
        try {
          await deleteDriveFolder.mutateAsync({ driveFolderId: deleteTarget.driveFolderId });
        } catch {
          // Continue with local delete even if Drive delete fails
          console.warn("Drive folder delete failed, continuing with local delete");
        }
      }
      await deleteMutation.mutateAsync({ id: deleteTarget.id, project_id: projectId });
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

  const handleUploadFile = async (driveFolderId: string, file: File, projectFolderId: string) => {
    setUploadingFolderId(driveFolderId);
    try {
      const result = await uploadToDrive.mutateAsync({ file, driveFolderId, projectFolderId });
      if (result.status === "synced") {
        toast.success(`"${result.file_name}" subido exitosamente a Drive`);
      } else if (result.status === "folder_not_found") {
        // Auto-repair: trigger folder sync then retry once
        toast.info(`Reparando carpeta en Drive — reintentando subida...`);
        try {
          await triggerSync();
          // After sync, the folder should have a new drive_folder_id — re-read from folders
          // For simplicity, tell user to retry
          toast.info(`Carpeta reparada. El archivo se sincronizará automáticamente desde la cola.`);
        } catch {
          toast.warning(`"${result.file_name}" en cola — se sincronizará cuando la carpeta esté disponible`);
        }
      } else {
        toast.info(`"${result.file_name}" guardado en cola — se sincronizará automáticamente`);
      }
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
              Repositorio — {projectName}{filterEmpresaName ? ` / ${filterEmpresaName}` : ""}
              {!!pendingCount && pendingCount > 0 && (
                <Badge variant="secondary" className="gap-1 ml-2">
                  <Clock className="w-3 h-3" />
                  {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
                </Badge>
              )}
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

                    {driveStatus?.connected && (
                      projectDriveUrl ? (
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                          <a href={projectDriveUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                            Ver en Google Drive
                          </a>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={resolvingDriveUrl}
                          onClick={() => {
                            toast.info("Cargando enlace de Drive... intenta nuevamente en unos segundos.");
                            if (projectId && !resolvingDriveUrl) {
                              setResolvingDriveUrl(true);
                              getProjectDriveId.mutateAsync({ projectId, projectName })
                                .then((result) => {
                                  const resolvedUrl = buildDriveFolderUrl(result.drive_folder_id);
                                  setProjectDriveUrl(resolvedUrl);
                                })
                                .catch((e: any) => toast.error("Error: " + e.message))
                                .finally(() => setResolvingDriveUrl(false));
                            }
                          }}
                        >
                          {resolvingDriveUrl ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                          )}
                          Ver en Google Drive
                        </Button>
                      )
                    )}

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
                    onDelete={(id, driveFolderId) => setDeleteTarget({ id, driveFolderId })}
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
              ¿Estás seguro de eliminar esta carpeta? Se eliminarán también todas sus subcarpetas{deleteTarget?.driveFolderId ? " y la carpeta correspondiente en Google Drive" : ""}. Este proceso no se puede deshacer.
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
