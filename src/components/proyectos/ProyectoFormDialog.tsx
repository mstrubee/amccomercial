import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmpresas } from "@/hooks/useEmpresas";
import { ProyectoInput, ProyectoWithEmpresas, EmpresaLink } from "@/hooks/useProyectos";
import { formatCLP, ufToCLP } from "@/data/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProyectoInput) => void;
  isLoading?: boolean;
  initialData?: ProyectoWithEmpresas;
  mode: "create" | "edit";
}

const ESTADOS_AMC = ["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"];

export default function ProyectoFormDialog({ open, onOpenChange, onSubmit, isLoading, initialData, mode }: Props) {
  const { data: empresas } = useEmpresas();

  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [estadoObra, setEstadoObra] = useState("");
  const [fechaEstadoObra, setFechaEstadoObra] = useState("");
  const [estadoAmc, setEstadoAmc] = useState("Vigente");
  const [monto, setMonto] = useState(0);
  const [empresaLinks, setEmpresaLinks] = useState<Record<string, { selected: boolean; monto: number; adjudicado: boolean }>>({});

  // Contactos
  const [arqNombre, setArqNombre] = useState("");
  const [arqContacto, setArqContacto] = useState("");
  const [arqMail, setArqMail] = useState("");
  const [arqTelefono, setArqTelefono] = useState("");
  const [constNombre, setConstNombre] = useState("");
  const [constContacto, setConstContacto] = useState("");
  const [constMail, setConstMail] = useState("");
  const [constTelefono, setConstTelefono] = useState("");
  const [itoNombre, setItoNombre] = useState("");
  const [itoContacto, setItoContacto] = useState("");
  const [itoMail, setItoMail] = useState("");
  const [itoTelefono, setItoTelefono] = useState("");
  const [duenosNombre, setDuenosNombre] = useState("");
  const [duenosContacto, setDuenosContacto] = useState("");
  const [duenosMail, setDuenosMail] = useState("");
  const [duenosTelefono, setDuenosTelefono] = useState("");

  useEffect(() => {
    if (!open) return;

    const buildLinks = () => {
      const links: Record<string, { selected: boolean; monto: number; adjudicado: boolean }> = {};
      empresas?.forEach((emp) => {
        links[emp.id] = { selected: false, monto: 0, adjudicado: false };
      });
      if (initialData?.proyecto_empresas) {
        initialData.proyecto_empresas.forEach((pe) => {
          links[pe.empresa_id] = {
            selected: true,
            monto: (pe as any).monto_cotizacion || 0,
            adjudicado: (pe as any).adjudicado || false,
          };
        });
      }
      return links;
    };

    if (initialData) {
      setNombre(initialData.nombre);
      setDireccion(initialData.direccion);
      setComuna(initialData.comuna);
      setEstadoObra(initialData.estado_obra);
      setFechaEstadoObra(initialData.fecha_estado_obra || "");
      setEstadoAmc(initialData.estado_amc);
      setMonto(initialData.monto_estimado || 0);
      setArqNombre(initialData.arq_nombre || "");
      setArqContacto(initialData.arq_contacto || "");
      setArqMail(initialData.arq_mail || "");
      setArqTelefono(initialData.arq_telefono || "");
      setConstNombre(initialData.const_nombre || "");
      setConstContacto(initialData.const_contacto || "");
      setConstMail(initialData.const_mail || "");
      setConstTelefono(initialData.const_telefono || "");
      setItoNombre(initialData.ito_nombre || "");
      setItoContacto(initialData.ito_contacto || "");
      setItoMail(initialData.ito_mail || "");
      setItoTelefono(initialData.ito_telefono || "");
      setDuenosNombre(initialData.duenos_nombre || "");
      setDuenosContacto(initialData.duenos_contacto || "");
      setDuenosMail(initialData.duenos_mail || "");
      setDuenosTelefono(initialData.duenos_telefono || "");
    } else {
      setNombre(""); setDireccion(""); setComuna(""); setEstadoObra(""); setFechaEstadoObra("");
      setEstadoAmc("Vigente"); setMonto(0);
      setArqNombre(""); setArqContacto(""); setArqMail(""); setArqTelefono("");
      setConstNombre(""); setConstContacto(""); setConstMail(""); setConstTelefono("");
      setItoNombre(""); setItoContacto(""); setItoMail(""); setItoTelefono("");
      setDuenosNombre(""); setDuenosContacto(""); setDuenosMail(""); setDuenosTelefono("");
    }
    setEmpresaLinks(buildLinks());
  }, [open, initialData, empresas]);

  const updateEmpresaLink = (id: string, field: string, value: any) => {
    setEmpresaLinks((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const empresa_links: EmpresaLink[] = Object.entries(empresaLinks)
      .filter(([, v]) => v.selected)
      .map(([id, v]) => ({
        empresa_id: id,
        monto_cotizacion: v.monto,
        adjudicado: v.adjudicado,
      }));

    onSubmit({
      nombre: nombre.trim(),
      direccion, comuna, estado_obra: estadoObra,
      fecha_estado_obra: fechaEstadoObra || null,
      estado_amc: estadoAmc,
      monto_estimado: monto || null,
      arq_nombre: arqNombre, arq_contacto: arqContacto, arq_mail: arqMail, arq_telefono: arqTelefono,
      const_nombre: constNombre, const_contacto: constContacto, const_mail: constMail, const_telefono: constTelefono,
      ito_nombre: itoNombre, ito_contacto: itoContacto, ito_mail: itoMail, ito_telefono: itoTelefono,
      duenos_nombre: duenosNombre, duenos_contacto: duenosContacto, duenos_mail: duenosMail, duenos_telefono: duenosTelefono,
      empresa_links,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{mode === "create" ? "Nuevo Proyecto" : "Editar Proyecto"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic info */}
            <div className="space-y-3">
              <Label htmlFor="pnombre">Nombre del Proyecto *</Label>
              <Input id="pnombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Dirección</Label>
                  <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Comuna</Label>
                  <Input value={comuna} onChange={(e) => setComuna(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Estado Obra</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={estadoObra}
                    onChange={(e) => setEstadoObra(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {["Anteproyecto", "Proyecto", "Licitación", "Constructora Adjudicada", "Obra Gruesa Inicial", "Obra Gruesa Intermedia", "Terminaciones", "Detenida", "Sin Información"].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Fecha Estado</Label>
                  <Input type="date" value={fechaEstadoObra} onChange={(e) => setFechaEstadoObra(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Estado AMC</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={estadoAmc}
                    onChange={(e) => setEstadoAmc(e.target.value)}
                  >
                    {ESTADOS_AMC.map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Monto Estimado (UF)</Label>
                <Input type="number" min={0} step={0.01} value={monto || ""} onChange={(e) => setMonto(Number(e.target.value))} placeholder="Ej: 1200.50" />
                {monto > 0 && (
                  <p className="text-xs text-muted-foreground">≈ {formatCLP(ufToCLP(monto))}</p>
                )}
              </div>
            </div>

            {/* Empresas vinculadas con cotización y adjudicación */}
            {empresas && empresas.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresas Vinculadas</Label>
                <div className="space-y-2">
                  {empresas.map((emp) => {
                    const link = empresaLinks[emp.id] || { selected: false, monto: 0, adjudicado: false };
                    return (
                      <div key={emp.id} className={`p-3 rounded-lg border transition-colors ${link.selected ? "bg-secondary/50 border-primary/30" : "bg-secondary/20 border-border"}`}>
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={link.selected}
                            onCheckedChange={(checked) => updateEmpresaLink(emp.id, "selected", !!checked)}
                          />
                          <span className="text-sm font-medium text-card-foreground flex-1">{emp.nombre}</span>
                          {link.selected && (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={link.adjudicado}
                                onCheckedChange={(checked) => updateEmpresaLink(emp.id, "adjudicado", checked)}
                              />
                              <span className={`text-xs font-medium ${link.adjudicado ? "text-success" : "text-muted-foreground"}`}>
                                {link.adjudicado ? "Adjudicada" : "No adjudicada"}
                              </span>
                            </div>
                          )}
                        </div>
                        {link.selected && (
                          <div className="mt-2 ml-7">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                className="h-8 w-40 text-sm"
                                placeholder="Cotización UF"
                                value={link.monto || ""}
                                onChange={(e) => updateEmpresaLink(emp.id, "monto", Number(e.target.value))}
                              />
                              <span className="text-xs text-muted-foreground">UF</span>
                              {link.monto > 0 && (
                                <span className="text-[10px] text-muted-foreground">≈ {formatCLP(ufToCLP(link.monto))}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contactos sections */}
            {[
              { title: "Arquitectura", values: [arqNombre, arqContacto, arqMail, arqTelefono], setters: [setArqNombre, setArqContacto, setArqMail, setArqTelefono] },
              { title: "Constructora", values: [constNombre, constContacto, constMail, constTelefono], setters: [setConstNombre, setConstContacto, setConstMail, setConstTelefono] },
              { title: "ITO", values: [itoNombre, itoContacto, itoMail, itoTelefono], setters: [setItoNombre, setItoContacto, setItoMail, setItoTelefono] },
              { title: "Dueños", values: [duenosNombre, duenosContacto, duenosMail, duenosTelefono], setters: [setDuenosNombre, setDuenosContacto, setDuenosMail, setDuenosTelefono] },
            ].map(({ title, values, setters }) => (
              <div key={title} className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Nombre" value={values[0]} onChange={(e) => setters[0](e.target.value)} />
                  <Input placeholder="Contacto" value={values[1]} onChange={(e) => setters[1](e.target.value)} />
                  <Input placeholder="Email" value={values[2]} onChange={(e) => setters[2](e.target.value)} />
                  <Input placeholder="Teléfono" value={values[3]} onChange={(e) => setters[3](e.target.value)} />
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar"}</Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
