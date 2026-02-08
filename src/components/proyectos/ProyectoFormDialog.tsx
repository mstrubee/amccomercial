import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings2, ChevronRight } from "lucide-react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { ProyectoInput, ProyectoWithEmpresas, EmpresaLink } from "@/hooks/useProyectos";
import { useCategorias, CategoriaWithSubs } from "@/hooks/useCategorias";
import { useClasificaciones } from "@/hooks/useClasificaciones";
import { formatCLP, formatUF, ufToCLP } from "@/data/mock-data";
import CategoriasManagerDialog from "./CategoriasManagerDialog";
import { REGIONES_CHILE } from "@/data/chile-geo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProyectoInput) => void;
  isLoading?: boolean;
  initialData?: ProyectoWithEmpresas;
  mode: "create" | "edit";
  /** When true, hides Ubicación, Contactos, and Empresas (child row editing) */
  isChildRow?: boolean;
  /** All group items for parent edit - used to show all empresas across the group */
  groupItems?: ProyectoWithEmpresas[];
}

const ESTADOS_AMC = ["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"];

interface EmpresaRow {
  empresa_id: string;
  selected: boolean;
  monto: number;
  categoria_id: string | null;
  subcategoria_id: string | null;
}

export default function ProyectoFormDialog({ open, onOpenChange, onSubmit, isLoading, initialData, mode, isChildRow, groupItems }: Props) {
  const { data: empresas } = useEmpresas();
  const { data: categorias } = useCategorias();
  const { data: clasificaciones } = useClasificaciones();

  const [nombre, setNombre] = useState("");
  const [region, setRegion] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [estadoObra, setEstadoObra] = useState("");
  const [fechaEstadoObra, setFechaEstadoObra] = useState("");
  const [estadoAmc, setEstadoAmc] = useState("Vigente");
  const [notas, setNotas] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().split("T")[0]);
  const [clasificacionId, setClasificacionId] = useState<string | null>(null);
  const [empresaRows, setEmpresaRows] = useState<EmpresaRow[]>([]);
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
      nombre, region, direccion, comuna, estadoObra, fechaEstadoObra, estadoAmc, notas,
      fechaIngreso, clasificacionId, empresaRows,
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
      setNotas(initialData.notas || "");
      setFechaIngreso((initialData as any).fecha_ingreso || new Date().toISOString().split("T")[0]);
      setClasificacionId((initialData as any).clasificacion_id || null);

      // Build empresa rows from existing links
      if (empresas) {
        const existingLinks = initialData.proyecto_empresas || [];
        const rows = empresas.map((emp) => {
          const link = existingLinks.find((l) => l.empresa_id === emp.id);
          return {
            empresa_id: emp.id,
            selected: !!link,
            monto: (link as any)?.monto_cotizacion || 0,
            categoria_id: (link as any)?.categoria_id || null,
            subcategoria_id: (link as any)?.subcategoria_id || null,
          };
        });
        setEmpresaRows(rows);
      }

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
      setEstadoAmc("Vigente"); setNotas("");
      setFechaIngreso(new Date().toISOString().split("T")[0]);
      setClasificacionId(null);
      // All empresas selected by default for new projects
      if (empresas) {
        setEmpresaRows(empresas.map((emp) => ({
          empresa_id: emp.id,
          selected: true,
          monto: 0,
          categoria_id: null,
          subcategoria_id: null,
        })));
      }
      setArqNombre(""); setArqContacto(""); setArqMail(""); setArqTelefono("");
      setConstNombre(""); setConstContacto(""); setConstMail(""); setConstTelefono("");
      setItoNombre(""); setItoContacto(""); setItoMail(""); setItoTelefono("");
      setDuenosNombre(""); setDuenosContacto(""); setDuenosMail(""); setDuenosTelefono("");
    }
  }, [open, initialData, empresas]);

  useEffect(() => {
    if (!open) { snapshotRef.current = ""; return; }
    const timer = setTimeout(() => { snapshotRef.current = buildSnapshot(); }, 0);
    return () => clearTimeout(timer);
  }, [open, initialData]);

  const handleRequestClose = (nextOpen: boolean) => {
    if (!nextOpen && isDirty()) { setShowUnsavedAlert(true); return; }
    onOpenChange(nextOpen);
  };

  const handleDiscardClose = () => {
    setShowUnsavedAlert(false);
    snapshotRef.current = "";
    onOpenChange(false);
  };

  const isAdjudicado = (catId: string | null, subId: string | null): boolean => {
    if (!categorias) return false;
    if (subId) {
      for (const cat of categorias) {
        const sub = cat.subcategorias_proyecto.find((s) => s.id === subId);
        if (sub) return sub.es_adjudicado;
      }
    }
    if (catId) {
      const cat = categorias.find((c) => c.id === catId);
      if (cat) return cat.es_adjudicado;
    }
    return false;
  };

  const updateEmpresaRow = (empresa_id: string, updates: Partial<EmpresaRow>) => {
    setEmpresaRows((prev) => prev.map((r) => r.empresa_id === empresa_id ? { ...r, ...updates } : r));
  };

  const handleCategoryChange = (empresa_id: string, value: string) => {
    if (!value || value === "none") {
      updateEmpresaRow(empresa_id, { categoria_id: null, subcategoria_id: null });
      return;
    }
    if (value.startsWith("sub:")) {
      const subId = value.replace("sub:", "");
      const parentCat = categorias?.find((c) => c.subcategorias_proyecto.some((s) => s.id === subId));
      updateEmpresaRow(empresa_id, { categoria_id: parentCat?.id || null, subcategoria_id: subId });
    } else {
      const catId = value.replace("cat:", "");
      updateEmpresaRow(empresa_id, { categoria_id: catId, subcategoria_id: null });
    }
  };

  const getSelectValue = (row: EmpresaRow): string => {
    if (row.subcategoria_id) return `sub:${row.subcategoria_id}`;
    if (row.categoria_id) return `cat:${row.categoria_id}`;
    return "none";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    const empresa_links: EmpresaLink[] = empresaRows
      .filter((r) => r.selected)
      .map((r) => ({
        empresa_id: r.empresa_id,
        monto_cotizacion: r.monto,
        adjudicado: isAdjudicado(r.categoria_id, r.subcategoria_id),
        categoria_id: r.categoria_id,
        subcategoria_id: r.subcategoria_id,
      }));

    snapshotRef.current = "";

    onSubmit({
      nombre: nombre.trim(),
      region, direccion, comuna, estado_obra: estadoObra,
      fecha_estado_obra: fechaEstadoObra || null,
      estado_amc: estadoAmc,
      monto_estimado: null,
      notas,
      fecha_ingreso: fechaIngreso,
      clasificacion_id: clasificacionId,
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
              {/* Nombre */}
              <div className="space-y-1">
                <Label htmlFor="pnombre">Nombre del Proyecto *</Label>
                <Input id="pnombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>

              {/* Fecha Ingreso + Clasificación */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha Ingreso</Label>
                  <Input type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Clasificación</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={clasificacionId || ""}
                    onChange={(e) => setClasificacionId(e.target.value || null)}
                  >
                    <option value="">Sin clasificación</option>
                    {clasificaciones?.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estado Obra / Fecha / Estado AMC */}
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

              {/* Empresas section */}
              {empresas && empresas.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {mode === "create" ? "Empresas Asignadas" : isChildRow ? "Empresa" : "Empresas del Proyecto"}
                    </Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => setShowCategoriasManager(true)}>
                      <Settings2 className="w-3 h-3" /> Categorías
                    </Button>
                  </div>

                  {mode === "create" ? (
                    /* Create mode: checkboxes for all empresas */
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {empresaRows.map((row) => {
                        const emp = empresas.find((e) => e.id === row.empresa_id);
                        if (!emp) return null;
                        return (
                          <div key={row.empresa_id} className={`rounded-lg border p-2 transition-colors ${row.selected ? "border-primary/30 bg-secondary/50" : "border-border bg-card/50 opacity-60"}`}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={row.selected}
                                onCheckedChange={(checked) => updateEmpresaRow(row.empresa_id, { selected: !!checked })}
                              />
                              <span className="text-sm font-medium text-card-foreground flex-1">{emp.nombre}</span>
                            </div>
                            {row.selected && (
                              <div className="mt-2 pl-6 flex items-center gap-2 flex-wrap">
                                <CategoriaSelect
                                  categorias={categorias || []}
                                  value={getSelectValue(row)}
                                  onChange={(val) => handleCategoryChange(row.empresa_id, val)}
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  className="h-7 w-32 text-xs"
                                  placeholder="Cotización UF"
                                  value={row.monto || ""}
                                  onChange={(e) => updateEmpresaRow(row.empresa_id, { monto: Number(e.target.value) })}
                                />
                                <span className="text-[10px] text-muted-foreground">UF</span>
                                {row.monto > 0 && (
                                  <span className="text-[10px] text-muted-foreground">≈ {formatCLP(ufToCLP(row.monto))}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : !isChildRow && groupItems ? (
                    /* Parent edit: show all empresas from all group items (read-only overview) */
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {groupItems.map((p) => {
                        const pe = p.proyecto_empresas?.[0];
                        if (!pe?.empresas) return null;
                        const sub = (pe as any).subcategorias_proyecto;
                        const cat = (pe as any).categorias_proyecto;
                        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
                        const statusColor = sub?.color || cat?.color || null;
                        const monto = (pe as any).monto_cotizacion || 0;
                        return (
                          <div key={p.id} className="rounded-lg border border-border bg-secondary/30 p-2">
                            <div className="flex items-center gap-2">
                              {statusColor && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />}
                              <span className="text-sm font-medium text-card-foreground">{pe.empresas.nombre}</span>
                              {statusName && <span className="text-[10px] text-muted-foreground ml-auto">{statusName}</span>}
                            </div>
                            {monto > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1 pl-5">
                                {formatUF(monto)} ≈ {formatCLP(ufToCLP(monto))}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Child edit: show only the linked empresa (no checkbox) */
                    <div className="space-y-2">
                      {empresaRows.filter((r) => r.selected).map((row) => {
                        const emp = empresas.find((e) => e.id === row.empresa_id);
                        if (!emp) return null;
                        return (
                          <div key={row.empresa_id} className="rounded-lg border border-primary/30 bg-secondary/50 p-2">
                            <span className="text-sm font-medium text-card-foreground">{emp.nombre}</span>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <CategoriaSelect
                                categorias={categorias || []}
                                value={getSelectValue(row)}
                                onChange={(val) => handleCategoryChange(row.empresa_id, val)}
                              />
                              <Input
                                type="number"
                                min={0}
                                step={0.01}
                                className="h-7 w-32 text-xs"
                                placeholder="Cotización UF"
                                value={row.monto || ""}
                                onChange={(e) => updateEmpresaRow(row.empresa_id, { monto: Number(e.target.value) })}
                              />
                              <span className="text-[10px] text-muted-foreground">UF</span>
                              {row.monto > 0 && (
                                <span className="text-[10px] text-muted-foreground">≈ {formatCLP(ufToCLP(row.monto))}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Notas (hidden for parent edit) */}
              {!(!isChildRow && groupItems) && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notas</Label>
                  <Textarea
                    placeholder="Notas del proyecto..."
                    maxLength={500}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="min-h-[80px] resize-none text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{notas.length}/500</p>
                </div>
              )}

              {!isChildRow && (<>
              {/* Collapsible: Ubicación */}
              <CollapsibleSection title="Ubicación" defaultOpen={false}>
                <div className="space-y-3">
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
                </div>
              </CollapsibleSection>

              {/* Collapsible: Contactos */}
              <CollapsibleSection title="Contactos" defaultOpen={false}>
                <div className="space-y-4">
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
                </div>
              </CollapsibleSection>
              </>)}

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

/* ── Collapsible Section ── */
function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
          {title}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
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
