import CategoriasManagerDialog from "@/components/proyectos/CategoriasManagerDialog";
import { useState } from "react";

export default function CategoriasPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Categorías Comerciales</h1>
        <p className="text-muted-foreground mt-1">Gestiona las categorías y subcategorías de proyectos</p>
      </div>
      <CategoriasManagerDialog open={open} onOpenChange={setOpen} />
      {!open && (
        <div className="text-center py-12">
          <button onClick={() => setOpen(true)} className="text-primary hover:underline text-sm">
            Abrir administrador de categorías
          </button>
        </div>
      )}
    </div>
  );
}
