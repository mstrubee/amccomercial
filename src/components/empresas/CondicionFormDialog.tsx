import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { fee_fijo_mensual: number; esquema_comision: number; fecha_vigencia: string; descripcion?: string }) => void;
  isLoading?: boolean;
  empresaNombre: string;
}

export default function CondicionFormDialog({ open, onOpenChange, onSubmit, isLoading, empresaNombre }: Props) {
  const [fee, setFee] = useState(0);
  const [comision, setComision] = useState(0);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [descripcion, setDescripcion] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ fee_fijo_mensual: fee, esquema_comision: comision, fecha_vigencia: fecha, descripcion });
  };

  const handleOpenChange = (val: boolean) => {
    if (val) {
      setFee(0);
      setComision(0);
      setFecha(new Date().toISOString().split("T")[0]);
      setDescripcion("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Condición — {empresaNombre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fee Mensual (CLP)</Label>
              <Input type="number" min={0} value={fee} onChange={(e) => setFee(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Comisión (%)</Label>
              <Input type="number" min={0} step={0.1} value={comision} onChange={(e) => setComision(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fecha de Vigencia</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Ajuste anual" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Agregar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
