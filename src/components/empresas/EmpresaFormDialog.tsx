import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayLocalISO } from "@/lib/date-utils";
import MontoInput from "./MontoInput";

interface EmpresaFormData {
  nombre: string;
  estado: string;
  fecha_inicio_relacion: string;
  fee_fijo_mensual: number;
  esquema_comision: number;
  descripcion?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EmpresaFormData) => void;
  isLoading?: boolean;
  initialData?: {
    nombre: string;
    estado: string;
    fecha_inicio_relacion: string;
  };
  mode: "create" | "edit";
}

export default function EmpresaFormDialog({ open, onOpenChange, onSubmit, isLoading, initialData, mode }: Props) {
  const [nombre, setNombre] = useState(initialData?.nombre || "");
  const [estado, setEstado] = useState(initialData?.estado || "Activa");
  const [fechaInicio, setFechaInicio] = useState(initialData?.fecha_inicio_relacion || todayLocalISO());
  const [fee, setFee] = useState(0);
  const [comision, setComision] = useState(0);
  const [comisionDisplay, setComisionDisplay] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Reset the form whenever the dialog opens. The `create` instance is mounted
  // permanently (open toggled by the parent), so Radix never fires
  // onOpenChange(true) and a reset placed there would never run — leaving the
  // previous entry's values in the fields on the next "Nueva Empresa".
  useEffect(() => {
    if (open) {
      setNombre(initialData?.nombre || "");
      setEstado(initialData?.estado || "Activa");
      setFechaInicio(initialData?.fecha_inicio_relacion || todayLocalISO());
      setFee(0);
      setComision(0);
      setComisionDisplay("");
      setDescripcion("");
    }
    // Intentionally keyed on `open` only: initialData is an inline object from
    // the parent (new identity each render); depending on it would reset the
    // form mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onSubmit({
      nombre: nombre.trim(),
      estado,
      fecha_inicio_relacion: fechaInicio,
      fee_fijo_mensual: fee,
      esquema_comision: comision,
      descripcion,
    });
  };

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva Empresa" : "Editar Empresa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la empresa" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activa">Activa</SelectItem>
                  <SelectItem value="Inactiva">Inactiva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha Inicio</Label>
              <Input id="fecha" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
          </div>

          {mode === "create" && (
            <>
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Condición Comercial Inicial</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MontoInput label="Fee Mensual" value={fee} onChange={setFee} id="fee" />
                <div className="space-y-1">
                  <Label htmlFor="comision">Comisión (%)</Label>
                  <Input
                    id="comision"
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
                <Label htmlFor="desc">Descripción</Label>
                <Input id="desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Condición inicial" />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
