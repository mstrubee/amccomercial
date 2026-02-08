import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CondicionRow } from "@/hooks/useEmpresas";
import MontoInput from "./MontoInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { id: string; fee_fijo_mensual: number; esquema_comision: number; fecha_vigencia: string; descripcion?: string }) => void;
  isLoading?: boolean;
  condicion: CondicionRow;
}

export default function EditCondicionDialog({ open, onOpenChange, onSubmit, isLoading, condicion }: Props) {
  const [fee, setFee] = useState(condicion.fee_fijo_mensual);
  const [comision, setComision] = useState(condicion.esquema_comision);
  const [comisionDisplay, setComisionDisplay] = useState(String(condicion.esquema_comision || ""));
  const [fecha, setFecha] = useState(condicion.fecha_vigencia);
  const [descripcion, setDescripcion] = useState(condicion.descripcion || "");

  useEffect(() => {
    if (open) {
      setFee(condicion.fee_fijo_mensual);
      setComision(condicion.esquema_comision);
      setComisionDisplay(condicion.esquema_comision ? String(condicion.esquema_comision) : "");
      setFecha(condicion.fecha_vigencia);
      setDescripcion(condicion.descripcion || "");
    }
  }, [open, condicion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ id: condicion.id, fee_fijo_mensual: fee, esquema_comision: comision, fecha_vigencia: fecha, descripcion });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Condición Comercial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <MontoInput label="Fee Mensual" value={fee} onChange={setFee} />
            <div className="space-y-1">
              <Label>Comisión (%)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={comisionDisplay}
                onChange={(e) => { setComisionDisplay(e.target.value); setComision(parseFloat(e.target.value) || 0); }}
                onFocus={(e) => { if (e.target.value === "0") setComisionDisplay(""); }}
                onBlur={() => { if (comisionDisplay === "") setComisionDisplay(comision ? String(comision) : ""); }}
                placeholder="0"
              />
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
            <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
