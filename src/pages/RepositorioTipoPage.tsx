import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { FolderPlus, Folder, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FolderTreeNode from "@/components/repositorio/FolderTreeNode";
import {
  useFolderTemplates, useCreateFolderTemplate, useUpdateFolderTemplate, useDeleteFolderTemplate, buildTree,
} from "@/hooks/useFolderTemplates";

export default function RepositorioTipoPage() {
  const { data: templates, isLoading } = useFolderTemplates();
  const createMutation = useCreateFolderTemplate();
  const updateMutation = useUpdateFolderTemplate();
  const deleteMutation = useDeleteFolderTemplate();

  const [creatingRoot, setCreatingRoot] = useState(false);
  const [rootName, setRootName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const rootInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingRoot) rootInputRef.current?.focus();
  }, [creatingRoot]);

  const tree = buildTree(templates || []);

  const handleCreate = async (parentId: string | null, name: string) => {
    try {
      await createMutation.mutateAsync({ name, parent_id: parentId });
      toast.success("Carpeta creada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleRename = async (id: string, newName: string) => {
    try {
      await updateMutation.mutateAsync({ id, name: newName });
      toast.success("Carpeta renombrada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Repositorio Tipo</h1>
          <p className="text-muted-foreground mt-1">Plantilla maestra de carpetas para proyectos</p>
        </div>
        <Button className="gap-2" onClick={() => setCreatingRoot(true)}>
          <FolderPlus className="w-4 h-4" />
          Nueva Carpeta Raíz
        </Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 bg-card rounded-xl border border-border shadow-sm p-4 overflow-auto">
        {creatingRoot && (
          <div className="flex items-center gap-1 py-1 px-2 mb-2">
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            <Input
              ref={rootInputRef}
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              placeholder="Nombre de carpeta raíz..."
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRootSubmit();
                if (e.key === "Escape") { setCreatingRoot(false); setRootName(""); }
              }}
              className="h-7 text-sm py-0 px-2 flex-1 max-w-xs"
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRootSubmit}>
              <Check className="w-3.5 h-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCreatingRoot(false); setRootName(""); }}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}

        {tree.length === 0 && !creatingRoot ? (
          <div className="text-center py-12 text-muted-foreground">
            <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay carpetas definidas aún.</p>
            <p className="text-sm">Crea una carpeta raíz para comenzar.</p>
          </div>
        ) : (
          tree.map((node) => (
            <FolderTreeNode
              key={node.id}
              node={node}
              level={0}
              onRename={handleRename}
              onDelete={(id) => setDeleteTarget(id)}
              onCreate={handleCreate}
            />
          ))
        )}
      </motion.div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar carpeta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la carpeta y todas sus subcarpetas de forma permanente. No afectará carpetas ya generadas en proyectos.
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
    </div>
  );
}
