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
import { Settings2, ChevronRight, Bell, Circle, CheckCircle2, UserPlus } from "lucide-react";
import { AlertaWithRelations } from "@/hooks/useAlertas";
import { format, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useEmpresas } from "@/hooks/useEmpresas";
import { ProyectoInput, ProyectoWithEmpresas, EmpresaLink } from "@/hooks/useProyectos";
import { useCategorias, CategoriaWithSubs } from "@/hooks/useCategorias";
import { useClasificaciones } from "@/hooks/useClasificaciones";
import { formatCLP, formatUF, ufToCLP } from "@/data/mock-data";
import CategoriasManagerDialog from "./CategoriasManagerDialog";
import { REGIONES_CHILE } from "@/data/chile-geo";
import { useClientes, useCategoriasCliente, ClienteWithCategoria, CategoriaCliente } from "@/hooks/useClientes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProyectoInput) => void;
  isLoading?: boolean;
  initialData?: ProyectoWithEmpresas;
  mode: "create" | "edit";
  isChildRow?: boolean;
  groupItems?: ProyectoWithEmpresas[];
  alertas?: AlertaWithRelations[];
  isAdmin?: boolean;
}

const ESTADOS_AMC = ["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"];

interface EmpresaRow {
  empresa_id: string;
  selected: boolean;
  monto: number;
  categoria_id: string | null;
  subcategoria_id: string | null;
}

export default function ProyectoFormDialog({ open, onOpenChange, onSubmit, isLoading, initialData, mode, isChildRow, groupItems, alertas, isAdmin }: Props) {
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

      // Build empresa rows from existing links (or from all group items for parent edit)
      if (empresas) {
        // Collect all empresa links across group items (parent edit) or just from this project
        const allLinks: { empresa_id: string; monto_cotizacion: number; categoria_id: string | null; subcategoria_id: string | null }[] = [];
        const sourceItems = groupItems && groupItems.length > 0 ? groupItems : [initialData];
        for (const item of sourceItems) {
          for (const pe of (item.proyecto_empresas || [])) {
            if (!allLinks.some((l) => l.empresa_id === pe.empresa_id)) {
              allLinks.push({
                empresa_id: pe.empresa_id,
                monto_cotizacion: (pe as any).monto_cotizacion || 0,
                categoria_id: (pe as any).categoria_id || null,
                subcategoria_id: (pe as any).subcategoria_id || null,
              });
            }
          }
        }
        const rows = empresas.map((emp) => {
          const link = allLinks.find((l) => l.empresa_id === emp.id);
          return {
            empresa_id: emp.id,
            selected: !!link,
            monto: link?.monto_cotizacion || 0,
            categoria_id: link?.categoria_id || null,
            subcategoria_id: link?.subcategoria_id || null,
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
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{mode === "create" ? "Nuevo Proyecto" : "Editar Proyecto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-5 pb-4">
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
                <div className="space-y-1 min-w-0">
                  <Label>Clasificación</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring truncate"
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
                    {isAdmin && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => setShowCategoriasManager(true)}>
                        <Settings2 className="w-3 h-3" /> Categorías
                      </Button>
                    )}
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
                                  disabled={!isAdmin}
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
                    /* Parent edit: editable empresas with checkboxes (pre-populated from group) */
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
                                  disabled={!isAdmin}
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
                                disabled={!isAdmin}
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
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="min-h-[80px] resize-y text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{notas.length} caracteres</p>
                </div>
              )}

              {/* Alertas relacionadas */}
              {mode === "edit" && alertas && alertas.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Bell className="w-3 h-3" /> Alertas ({alertas.filter(a => !a.completada).length} activas)
                  </Label>
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                    {alertas.map(a => {
                      const today = startOfDay(new Date());
                      const isOverdue = !a.completada && isBefore(new Date(a.fecha_seguimiento), today);
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                            a.completada ? "border-border bg-muted/30 opacity-60" : isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
                          )}
                        >
                          {a.completada
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                            : <Circle className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")} />
                          }
                          <div className="flex-1 min-w-0">
                            {a.titulo && <div className="font-semibold text-amber-700 text-[11px]">{a.titulo}</div>}
                            <div className={cn("truncate", a.completada && "line-through text-muted-foreground")}>{a.texto}</div>
                            <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                              <span>{a.responsable_profile?.display_name || a.responsable_profile?.email || "—"}</span>
                              <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                {format(new Date(a.fecha_seguimiento), "dd MMM yyyy", { locale: es })}
                                {isOverdue && " (vencida)"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                <ContactosSection
                  arqNombre={arqNombre} arqContacto={arqContacto} arqMail={arqMail} arqTelefono={arqTelefono}
                  setArqNombre={setArqNombre} setArqContacto={setArqContacto} setArqMail={setArqMail} setArqTelefono={setArqTelefono}
                  constNombre={constNombre} constContacto={constContacto} constMail={constMail} constTelefono={constTelefono}
                  setConstNombre={setConstNombre} setConstContacto={setConstContacto} setConstMail={setConstMail} setConstTelefono={setConstTelefono}
                  itoNombre={itoNombre} itoContacto={itoContacto} itoMail={itoMail} itoTelefono={itoTelefono}
                  setItoNombre={setItoNombre} setItoContacto={setItoContacto} setItoMail={setItoMail} setItoTelefono={setItoTelefono}
                  duenosNombre={duenosNombre} duenosContacto={duenosContacto} duenosMail={duenosMail} duenosTelefono={duenosTelefono}
                  setDuenosNombre={setDuenosNombre} setDuenosContacto={setDuenosContacto} setDuenosMail={setDuenosMail} setDuenosTelefono={setDuenosTelefono}
                />
              </CollapsibleSection>
              </>)}

              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 px-6 py-3 border-t border-border shrink-0">
              <Button type="button" variant="outline" onClick={() => handleRequestClose(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>{isLoading ? "Guardando..." : "Guardar"}</Button>
            </div>
          </form>
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

/* ── Contactos Section with client picker ── */
interface ContactosSectionProps {
  arqNombre: string; arqContacto: string; arqMail: string; arqTelefono: string;
  setArqNombre: (v: string) => void; setArqContacto: (v: string) => void; setArqMail: (v: string) => void; setArqTelefono: (v: string) => void;
  constNombre: string; constContacto: string; constMail: string; constTelefono: string;
  setConstNombre: (v: string) => void; setConstContacto: (v: string) => void; setConstMail: (v: string) => void; setConstTelefono: (v: string) => void;
  itoNombre: string; itoContacto: string; itoMail: string; itoTelefono: string;
  setItoNombre: (v: string) => void; setItoContacto: (v: string) => void; setItoMail: (v: string) => void; setItoTelefono: (v: string) => void;
  duenosNombre: string; duenosContacto: string; duenosMail: string; duenosTelefono: string;
  setDuenosNombre: (v: string) => void; setDuenosContacto: (v: string) => void; setDuenosMail: (v: string) => void; setDuenosTelefono: (v: string) => void;
}

const CONTACTO_CAT_MAP: Record<string, string> = {
  "Arquitectura": "Arquitectura",
  "Constructora": "Constructora",
  "ITO": "ITO",
  "Dueños": "Dueños",
};

function ContactosSection(props: ContactosSectionProps) {
  const { data: clientes } = useClientes();
  const { data: categoriasCliente } = useCategoriasCliente();

  const sections = [
    { title: "Arquitectura", values: [props.arqNombre, props.arqContacto, props.arqMail, props.arqTelefono], setters: [props.setArqNombre, props.setArqContacto, props.setArqMail, props.setArqTelefono] },
    { title: "Constructora", values: [props.constNombre, props.constContacto, props.constMail, props.constTelefono], setters: [props.setConstNombre, props.setConstContacto, props.setConstMail, props.setConstTelefono] },
    { title: "ITO", values: [props.itoNombre, props.itoContacto, props.itoMail, props.itoTelefono], setters: [props.setItoNombre, props.setItoContacto, props.setItoMail, props.setItoTelefono] },
    { title: "Dueños", values: [props.duenosNombre, props.duenosContacto, props.duenosMail, props.duenosTelefono], setters: [props.setDuenosNombre, props.setDuenosContacto, props.setDuenosMail, props.setDuenosTelefono] },
  ];

  const getClientesForCategory = (title: string): ClienteWithCategoria[] => {
    if (!clientes || !categoriasCliente) return [];
    const cat = categoriasCliente.find((c) => c.nombre === CONTACTO_CAT_MAP[title]);
    if (!cat) return [];
    return clientes.filter((c) => c.categoria_id === cat.id);
  };

  const applyCliente = (cliente: ClienteWithCategoria, setters: ((v: string) => void)[]) => {
    const currentNombre = sections.find(s => s.setters === setters)?.values[0] || "";
    const currentContacto = sections.find(s => s.setters === setters)?.values[1] || "";
    const currentEmail = sections.find(s => s.setters === setters)?.values[2] || "";
    const currentTelefono = sections.find(s => s.setters === setters)?.values[3] || "";

    const append = (current: string, newVal: string) => {
      if (!newVal) return current;
      if (!current) return newVal;
      return `${current} / ${newVal}`;
    };

    setters[0](append(currentNombre, cliente.nombre));
    setters[1](append(currentContacto, cliente.contacto));
    setters[2](append(currentEmail, cliente.email));
    setters[3](append(currentTelefono, cliente.telefono));
  };

  return (
    <div className="space-y-4">
      {sections.map(({ title, values, setters }) => {
        const availableClientes = getClientesForCategory(title);
        return (
          <div key={title} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Label>
              {availableClientes.length > 0 && (
                <ClientePicker
                  clientes={availableClientes}
                  onSelect={(c) => applyCliente(c, setters)}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nombre" value={values[0]} onChange={(e) => setters[0](e.target.value)} />
              <Input placeholder="Contacto" value={values[1]} onChange={(e) => setters[1](e.target.value)} />
              <Input placeholder="Email" value={values[2]} onChange={(e) => setters[2](e.target.value)} />
              <Input placeholder="Teléfono" value={values[3]} onChange={(e) => setters[3](e.target.value)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Client Picker Popover ── */
function ClientePicker({ clientes, onSelect }: { clientes: ClienteWithCategoria[]; onSelect: (c: ClienteWithCategoria) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.contacto.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => setOpen(!open)}>
        <UserPlus className="w-3 h-3" /> Agregar cliente
      </Button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-64 rounded-md border border-border bg-popover shadow-md">
          <div className="p-2">
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-[150px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  onClick={() => { onSelect(c); setOpen(false); setSearch(""); }}
                >
                  <div className="font-medium text-popover-foreground">{c.nombre}</div>
                  {c.contacto && <div className="text-muted-foreground">{c.contacto}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
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
  disabled,
}: {
  categorias: CategoriaWithSubs[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
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
        className="h-7 pl-6 pr-2 text-xs rounded-md border border-input bg-card appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[140px] disabled:opacity-60 disabled:cursor-not-allowed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
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
