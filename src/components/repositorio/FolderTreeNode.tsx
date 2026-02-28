import { useState, useRef, useEffect } from "react";
import { ChevronRight, Folder, FolderOpen, FolderPlus, Pencil, Trash2, Check, X, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
  onDelete: (id: string) => void;
  onCreate: (parentId: string, name: string) => void;
  onUpload?: (driveFolderId: string, file: File) => void;
  isUploading?: boolean;
  uploadingFolderId?: string | null;
  canEdit?: boolean;
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
      onUpload(node.drive_folder_id, file);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const isBusyHere = isUploading && uploadingFolderId === node.drive_folder_id;
  const hasChildren = node.children.length > 0 || creating;

  return (
    <div>
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
                  !node.children.length && !creating && "invisible"
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
                    onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
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
