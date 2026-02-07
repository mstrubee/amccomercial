import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2 } from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { ProyectoInput, ProyectoWithEmpresas, EmpresaLink } from "@/hooks/useProyectos";
import { useCategorias, CategoriaWithSubs } from "@/hooks/useCategorias";
import { formatCLP, ufToCLP } from "@/data/mock-data";
import CategoriasManagerDialog from "./CategoriasManagerDialog";
import { REGIONES_CHILE } from "@/data/chile-geo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProyectoInput) => void;
  isLoading?: boolean;
  initialData?: ProyectoWithEmpresas;
  mode: "create" | "edit";
}

const ESTADOS_AMC = ["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"];

interface EmpresaSelection {
  empresa_id: string | null;
  monto: number;
  categoria_id: string | null;
  subcategoria_id: string | null;
}

export default function ProyectoFormDialog({ open, onOpenChange, onSubmit, isLoading, initialData, mode }: Props) {
  const { data: empresas } = useEmpresas();
  const { data: categorias } = useCategorias();

  const [nombre, setNombre] = useState("");
  const [region, setRegion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [estadoObra, setEstadoObra] = useState("");
  const [fechaEstadoObra, setFechaEstadoObra] = useState("");
  const [estadoAmc, setEstadoAmc] = useState("Vigente");
  const [empresaSelection, setEmpresaSelection] = useState<EmpresaSelection>({ empresa_id: null, monto: 0, categoria_id: null, subcategoria_id: null });
  const [showCategoriasManager, setShowCategoriasManager] = useState(false);

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

  // Dirty tracking
  const snapshotRef = useRef<string>("");
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);

  const buildSnapshot = () =>
    JSON.stringify({
      nombre, region, direccion, comuna, estadoObra, fechaEstadoObra, estadoAmc, empresaSelection,
      arqNombre, arqContacto, arqMail, arqTelefono,
      constNombre, constContacto, constMail, constTelefono,
      itoNombre, itoContacto, itoMail, itoTelefono,
      duenosNombre, duenosContacto, duenosMail, duenosTelefono,
    });

  const isDirty = () => snapshotRef.current !== "" && snapshotRef.current !== buildSnapshot();

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setNombre(initialData.nombre);
      setRegion((initialData as any).region || "");
      setDireccion(initialData.direccion);
      setComuna(initialData.comuna);
      setEstadoObra(initialData.estado_obra);
      setFechaEstadoObra(initialData.fecha_estado_obra || "");
      setEstadoAmc(initialData.estado_amc);
      const pe = initialData.proyecto_empresas?.[0];
      setEmpresaSelection({
        empresa_id: pe?.empresa_id || null,
        monto: (pe as any)?.monto_cotizacion || 0,
        categoria_id: (pe as any)?.categoria_id || null,
        subcategoria_id: (pe as any)?.subcategoria_id || null,
      });
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
      setNombre(""); setRegion(""); setDireccion(""); setComuna(""); setEstadoObra(""); setFechaEstadoObra("");
      setEstadoAmc("Vigente");
      setEmpresaSelection({ empresa_id: null, monto: 0, categoria_id: null, subcategoria_id: null });
      setArqNombre(""); setArqContacto(""); setArqMail(""); setArqTelefono("");
      setConstNombre(""); setConstContacto(""); setConstMail(""); setConstTelefono("");
      setItoNombre(""); setItoContacto(""); setItoMail(""); setItoTelefono("");
      setDuenosNombre(""); setDuenosContacto(""); setDuenosMail(""); setDuenosTelefono("");
    }
  }, [open, initialData, empresas]);

  // Capture snapshot AFTER state has settled from the effect above
  useEffect(() => {
    if (!open) {
      snapshotRef.current = "";
      return;
    }
    // Use a microtask to capture after all state setters have flushed
    const timer = setTimeout(() => {
      snapshotRef.current = buildSnapshot();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData]);

  const handleRequestClose = (nextOpen: boolean) => {
    if (!nextOpen && isDirty()) {
      setShowUnsavedAlert(true);
      return;
    }
    onOpenChange(nextOpen);
  };

  const handleDiscardClose = () => {
    setShowUnsavedAlert(false);
    snapshotRef.current = ""; // prevent re-trigger
    onOpenChange(false);
  };

  // Determine if adjudicado based on category/subcategory es_adjudicado flag
  const isAdjudicado = (sel: EmpresaSelection): boolean => {
    if (!categorias) return false;
    if (sel.subcategoria_id) {
      for (const cat of categorias) {
        const sub = cat.subcategorias_proyecto.find((s) => s.id === sel.subcategoria_id);
        if (sub) return sub.es_adjudicado;
      }
    }
    if (sel.categoria_id) {
      const cat = categorias.find((c) => c.id === sel.categoria_id);
      if (cat) return cat.es_adjudicado;
    }
    return false;
  };

  const handleCategoryChange = (value: string) => {
    if (!value || value === "none") {
      setEmpresaSelection((prev) => ({ ...prev, categoria_id: null, subcategoria_id: null }));
      return;
    }
    if (value.startsWith("sub:")) {
      const subId = value.replace("sub:", "");
      const parentCat = categorias?.find((c) => c.subcategorias_proyecto.some((s) => s.id === subId));
      setEmpresaSelection((prev) => ({ ...prev, categoria_id: parentCat?.id || null, subcategoria_id: subId }));
    } else {
      const catId = value.replace("cat:", "");
      setEmpresaSelection((prev) => ({ ...prev, categoria_id: catId, subcategoria_id: null }));
    }
  };

  const getSelectValue = (): string => {
    if (empresaSelection.subcategoria_id) return `sub:${empresaSelection.subcategoria_id}`;
    if (empresaSelection.categoria_id) return `cat:${empresaSelection.categoria_id}`;
    return "none";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const empresa_links: EmpresaLink[] = empresaSelection.empresa_id
      ? [{
          empresa_id: empresaSelection.empresa_id,
          monto_cotizacion: empresaSelection.monto,
          adjudicado: isAdjudicado(empresaSelection),
          categoria_id: empresaSelection.categoria_id,
          subcategoria_id: empresaSelection.subcategoria_id,
        }]
      : [];

    // Reset snapshot so closing after save doesn't trigger alert
    snapshotRef.current = "";

    onSubmit({
      nombre: nombre.trim(),
      region, direccion, comuna, estado_obra: estadoObra,
      fecha_estado_obra: fechaEstadoObra || null,
      estado_amc: estadoAmc,
      monto_estimado: null,
      arq_nombre: arqNombre, arq_contacto: arqContacto, arq_mail: arqMail, arq_telefono: arqTelefono,
      const_nombre: constNombre, const_contacto: constContacto, const_mail: constMail, const_telefono: constTelefono,
      ito_nombre: itoNombre, ito_contacto: itoContacto, ito_mail: itoMail, ito_telefono: itoTelefono,
      duenos_nombre: duenosNombre, duenos_contacto: duenosContacto, duenos_mail: duenosMail, duenos_telefono: duenosTelefono,
      empresa_links,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleRequestClose}>
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
                <div className="space-y-1">
                  <Label>Dirección</Label>
                  <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Región</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={region}
                      onChange={(e) => { setRegion(e.target.value); setComuna(""); }}
                    >
                      <option value="">Seleccionar región...</option>
                      {REGIONES_CHILE.map((r) => (
                        <option key={r.nombre} value={r.nombre}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Comuna</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={comuna}
                      onChange={(e) => setComuna(e.target.value)}
                      disabled={!region}
                    >
                      <option value="">{region ? "Seleccionar comuna..." : "Seleccione región primero"}</option>
                      {(REGIONES_CHILE.find((r) => r.nombre === region)?.comunas || []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
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
              </div>

              {/* Empresa y cotización */}
              {empresas && empresas.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => setShowCategoriasManager(true)}>
                      <Settings2 className="w-3 h-3" /> Categorías
                    </Button>
                  </div>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={empresaSelection.empresa_id || ""}
                    onChange={(e) => setEmpresaSelection((prev) => ({ ...prev, empresa_id: e.target.value || null }))}
                  >
                    <option value="">Seleccionar empresa...</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>

                  {empresaSelection.empresa_id && (
                    <div className="p-3 rounded-lg border border-primary/30 bg-secondary/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Categoría</Label>
                        <CategoriaSelect
                          categorias={categorias || []}
                          value={getSelectValue()}
                          onChange={handleCategoryChange}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-8 w-40 text-sm"
                          placeholder="Cotización UF"
                          value={empresaSelection.monto || ""}
                          onChange={(e) => setEmpresaSelection((prev) => ({ ...prev, monto: Number(e.target.value) }))}
                        />
                        <span className="text-xs text-muted-foreground">UF</span>
                        {empresaSelection.monto > 0 && (
                          <span className="text-[10px] text-muted-foreground">≈ {formatCLP(ufToCLP(empresaSelection.monto))}</span>
                        )}
                      </div>
                    </div>
                  )}
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
                <Button type="button" variant="outline" onClick={() => handleRequestClose(false)}>Cancelar</Button>
                <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar"}</Button>
              </div>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <AlertDialog open={showUnsavedAlert} onOpenChange={setShowUnsavedAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. ¿Deseas descartarlos o volver al formulario para guardarlos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver al formulario</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDiscardClose}
            >
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CategoriasManagerDialog open={showCategoriasManager} onOpenChange={setShowCategoriasManager} />
    </>
  );
}

/* ── Category select dropdown ── */
function CategoriaSelect({
  categorias,
  value,
  onChange,
}: {
  categorias: CategoriaWithSubs[];
  value: string;
  onChange: (val: string) => void;
}) {
  let displayColor = "#6b7280";

  if (value.startsWith("sub:")) {
    const subId = value.replace("sub:", "");
    for (const cat of categorias) {
      const sub = cat.subcategorias_proyecto.find((s) => s.id === subId);
      if (sub) { displayColor = sub.color; break; }
    }
  } else if (value.startsWith("cat:")) {
    const catId = value.replace("cat:", "");
    const cat = categorias.find((c) => c.id === catId);
    if (cat) displayColor = cat.color;
  }

  return (
    <div className="relative">
      <select
        className="h-7 pl-6 pr-2 text-xs rounded-md border border-input bg-card appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[140px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="none">Elegir Categoría</option>
        {categorias.map((cat) => (
          cat.subcategorias_proyecto.length > 0 ? (
            <optgroup key={cat.id} label={cat.nombre}>
              <option value={`cat:${cat.id}`}>{cat.nombre} (general)</option>
              {cat.subcategorias_proyecto.map((sub) => (
                <option key={sub.id} value={`sub:${sub.id}`}>
                  {sub.nombre}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={cat.id} value={`cat:${cat.id}`}>{cat.nombre}</option>
          )
        ))}
      </select>
      <div
        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border border-border pointer-events-none"
        style={{ backgroundColor: displayColor }}
      />
    </div>
  );
}
