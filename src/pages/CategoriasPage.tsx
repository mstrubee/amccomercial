import CategoriasManagerDialog from "@/components/proyectos/CategoriasManagerDialog";
import { useState } from "react";

export default function CategoriasPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Estatus (x Empresa)</h1>
        <p className="text-muted-foreground mt-1">Gestiona los estatus y sub-estatus de proyectos por empresa</p>
      </div>
      <CategoriasManagerDialog open={open} onOpenChange={setOpen} />
      {!open && (
        <div className="text-center py-12">
          <button onClick={() => setOpen(true)} className="text-primary hover:underline text-sm">
            Abrir administrador de estatus
          </button>
        </div>
      )}
    </div>
  );
}
