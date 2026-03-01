import { useState, useRef, useEffect } from "react";
import { ChevronRight, Folder, FolderOpen, FolderPlus, Pencil, Trash2, Check, X, Upload, Loader2, FileText, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useDriveFiles, useDeleteDriveFile, usePendingFilesForFolder } from "@/hooks/useDriveSync";
import { toast } from "sonner";

export interface TreeNode {
  id: string;
  name: string;
  children: TreeNode[];
  drive_folder_id?: string | null;
}

interface Props {
  node: TreeNode;
  level: number;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string, driveFolderId?: string | null) => void;
  onCreate: (parentId: string, name: string) => void;
  onUpload?: (driveFolderId: string, file: File, projectFolderId: string) => void;
  isUploading?: boolean;
  uploadingFolderId?: string | null;
  canEdit?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FolderTreeNode({ node, level, onRename, onDelete, onCreate, onUpload, isUploading, uploadingFolderId, canEdit = true }: Props) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(node.name);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewLinkRef = useRef<HTMLAnchorElement>(null);

  const { data: files } = useDriveFiles(node.id);
  const { data: pendingFiles } = usePendingFilesForFolder(node.id);
  const deleteDriveFile = useDeleteDriveFile();
  

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    if (creating) createRef.current?.focus();
  }, [creating]);

  const handleRenameSubmit = () => {
    const trimmed = renameName.trim();
    if (trimmed && trimmed !== node.name) {
      onRename(node.id, trimmed);
    }
    setRenaming(false);
  };

  const handleCreateSubmit = () => {
    const trimmed = newName.trim();
    if (trimmed) {
      onCreate(node.id, trimmed);
      setNewName("");
      setCreating(false);
      setOpen(true);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && node.drive_folder_id && onUpload) {
      onUpload(node.drive_folder_id, file, node.id);
    }
    e.target.value = "";
  };

  const handleViewFile = (driveFileId: string) => {
    if (!driveFileId) {
      toast.error("No se encontró el ID del archivo. Intenta nuevamente.");
      return;
    }
    const viewUrl = `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/view?usp=sharing`;
    if (viewLinkRef.current) {
      viewLinkRef.current.href = viewUrl;
      viewLinkRef.current.click();
    }
  };

  const handleDeleteFile = async (driveFileId: string, driveFilesId: string, fileName: string) => {
    try {
      await deleteDriveFile.mutateAsync({ driveFileId, driveFilesId });
      toast.success(`"${fileName}" eliminado`);
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const isBusyHere = isUploading && uploadingFolderId === node.drive_folder_id;
  const hasPending = pendingFiles && pendingFiles.length > 0;
  const hasChildren = node.children.length > 0 || creating || (files && files.length > 0) || hasPending;

  return (
    <div>
      <a ref={viewLinkRef} href="#" target="_blank" rel="noopener noreferrer" className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "group flex items-center gap-1 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors",
          )}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          <CollapsibleTrigger asChild>
            <button className="p-0.5 shrink-0">
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 text-muted-foreground transition-transform",
                  open && "rotate-90",
                  !hasChildren && "invisible"
                )}
              />
            </button>
          </CollapsibleTrigger>

          {open ? (
            <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
          )}

          {renaming ? (
            <div className="flex items-center gap-1 flex-1 ml-1">
              <Input
                ref={renameRef}
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="h-6 text-xs py-0 px-1.5"
              />
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleRenameSubmit}>
                <Check className="w-3 h-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setRenaming(false)}>
                <X className="w-3 h-3 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <>
              <span className="text-sm text-foreground ml-1 flex-1 truncate">{node.name}</span>

              {isBusyHere && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto shrink-0" />
              )}

              {canEdit && !isBusyHere && (
                <div className="flex items-center gap-0.5 ml-auto">
                  {node.drive_folder_id && onUpload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Subir archivo a Drive"
                      disabled={isUploading}
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-500" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Agregar subcarpeta"
                    onClick={(e) => { e.stopPropagation(); setCreating(true); setOpen(true); }}
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Renombrar"
                    onClick={(e) => { e.stopPropagation(); setRenameName(node.name); setRenaming(true); }}
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/10"
                    title="Eliminar"
                    onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.drive_folder_id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <CollapsibleContent>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onRename={onRename}
              onDelete={onDelete}
              onCreate={onCreate}
              onUpload={onUpload}
              isUploading={isUploading}
              uploadingFolderId={uploadingFolderId}
              canEdit={canEdit}
            />
          ))}

          {/* Synced files */}
          {files && files.length > 0 && (
            <div>
              {files.map((file) => (
                <div
                  key={file.id}
                  className="group flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-accent/30 transition-colors cursor-pointer"
                  style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}
                  onClick={() => handleViewFile(file.drive_file_id)}
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1">{file.file_name}</span>
                  <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(file.file_size)}</span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10"
                      title="Eliminar archivo"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.drive_file_id, file.id, file.file_name);
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive/70" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pending files */}
          {hasPending && (
            <div>
              {pendingFiles!.map((pf) => (
                <div
                  key={pf.id}
                  className="flex items-center gap-1.5 py-1 px-2 rounded-md opacity-70"
                  style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}
                >
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground truncate flex-1">{pf.file_name}</span>
                  {pf.status === "uploading" ? (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
                  ) : pf.status === "failed" ? (
                    <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                  ) : (
                    <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {pf.status === "uploading" ? "Subiendo..." : pf.status === "failed" ? "Reintentando" : "En cola"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {creating && (
            <div className="flex items-center gap-1 py-1 px-2" style={{ paddingLeft: `${(level + 1) * 20 + 8}px` }}>
              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
              <Input
                ref={createRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre de carpeta..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateSubmit();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                className="h-6 text-xs py-0 px-1.5 flex-1"
              />
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCreateSubmit}>
                <Check className="w-3 h-3 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setCreating(false); setNewName(""); }}>
                <X className="w-3 h-3 text-muted-foreground" />
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
