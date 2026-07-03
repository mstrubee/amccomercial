import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parColor: string;
  imparColor: string;
  onSave: (par: string, impar: string) => void;
  onReset: () => void;
}

export default function RowColorDialog({ open, onOpenChange, parColor, imparColor, onSave, onReset }: Props) {
  const [par, setPar] = useState(parColor);
  const [impar, setImpar] = useState(imparColor);

  useEffect(() => {
    if (open) { setPar(parColor); setImpar(imparColor); }
  }, [open, parColor, imparColor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Colores de líneas</DialogTitle>
          <DialogDescription>
            Elegí un color para las líneas pares y otro para las impares. Se aplica a todas las líneas de esa paridad, junto con sus cuadros de Notas y Checklist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="row-color-par">Líneas pares</Label>
            <input
              id="row-color-par"
              type="color"
              value={par}
              onChange={(e) => setPar(e.target.value)}
              className="h-8 w-14 rounded-md border border-input cursor-pointer bg-card"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="row-color-impar">Líneas impares</Label>
            <input
              id="row-color-impar"
              type="color"
              value={impar}
              onChange={(e) => setImpar(e.target.value)}
              className="h-8 w-14 rounded-md border border-input cursor-pointer bg-card"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>Restaurar predeterminados</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={() => { onSave(par, impar); onOpenChange(false); }}>Guardar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
