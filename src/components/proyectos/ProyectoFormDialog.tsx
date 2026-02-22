import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Settings2, ChevronRight, Bell, Circle, CheckCircle2, UserPlus, Trophy, Pencil, Trash2 } from "lucide-react";
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
import { useClientes, useCategoriasCliente, useCreateCliente, ClienteWithCategoria, CategoriaCliente } from "@/hooks/useClientes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProyectoInput) => void;
  onCreateAlertaFromCategoria?: (context: { proyecto_id: string; empresa_id: string; fecha: string }) => void;
  isLoading?: boolean;
  initialData?: ProyectoWithEmpresas;
  mode: "create" | "edit";
  isChildRow?: boolean;
  groupItems?: ProyectoWithEmpresas[];
  alertas?: AlertaWithRelations[];
  isAdmin?: boolean;
}

const ESTADOS_AMC = ["Vigente", "Descartado", "Todo Ofrecido", "Sin Respuesta"];

const GANADO_SUBCATEGORIA_ID = "5ede8de9-4fd3-4670-85d5-4934af648e74";

interface EmpresaRow {
  empresa_id: string;
  selected: boolean;
  monto: number;
  categoria_id: string | null;
  subcategoria_id: string | null;
  fecha_categoria: string | null;
  ganado_presupuesto: number | null;
  ganado_op: string | null;
  ganado_fecha: string | null;
}

export default function ProyectoFormDialog({ open, onOpenChange, onSubmit, onCreateAlertaFromCategoria, isLoading, initialData, mode, isChildRow, groupItems, alertas, isAdmin }: Props) {
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
  const [crearAlertaEmpresaIds, setCrearAlertaEmpresaIds] = useState<Set<string>>(new Set());
  const [showCategoriasManager, setShowCategoriasManager] = useState(false);

  // Ganado dialog state
  const [ganadoDialogOpen, setGanadoDialogOpen] = useState(false);
  const [ganadoDialogEmpresaId, setGanadoDialogEmpresaId] = useState<string | null>(null);
  const [ganadoPrevSubId, setGanadoPrevSubId] = useState<string | null>(null);
  const [ganadoPrevCatId, setGanadoPrevCatId] = useState<string | null>(null);
  const [ganadoPresupuesto, setGanadoPresupuesto] = useState<string>("");
  const [ganadoOp, setGanadoOp] = useState("");
  const [ganadoFecha, setGanadoFecha] = useState(new Date().toISOString().split("T")[0]);

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
  const scrollRef = useRef<HTMLDivElement>(null);
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
    setCrearAlertaEmpresaIds(new Set());
    // Reset scroll to top when dialog opens
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, 0);

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
        const allLinks: { empresa_id: string; monto_cotizacion: number; categoria_id: string | null; subcategoria_id: string | null; fecha_categoria: string | null; ganado_presupuesto: number | null; ganado_op: string | null; ganado_fecha: string | null }[] = [];
        const sourceItems = groupItems && groupItems.length > 0 ? groupItems : [initialData];
        for (const item of sourceItems) {
          for (const pe of (item.proyecto_empresas || [])) {
            if (!allLinks.some((l) => l.empresa_id === pe.empresa_id)) {
              allLinks.push({
                empresa_id: pe.empresa_id,
                monto_cotizacion: (pe as any).monto_cotizacion || 0,
                categoria_id: (pe as any).categoria_id || null,
                subcategoria_id: (pe as any).subcategoria_id || null,
                fecha_categoria: (pe as any).fecha_categoria || null,
                ganado_presupuesto: (pe as any).ganado_presupuesto || null,
                ganado_op: (pe as any).ganado_op || null,
                ganado_fecha: (pe as any).ganado_fecha || null,
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
            fecha_categoria: link?.fecha_categoria || null,
            ganado_presupuesto: (link as any)?.ganado_presupuesto || null,
            ganado_op: (link as any)?.ganado_op || null,
            ganado_fecha: (link as any)?.ganado_fecha || null,
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
          fecha_categoria: null,
          ganado_presupuesto: null,
          ganado_op: null,
          ganado_fecha: null,
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

  const categoryPermiteFecha = (catId: string | null, subId: string | null): boolean => {
    if (!categorias) return false;
    // Check subcategory's parent category
    if (subId) {
      for (const cat of categorias) {
        if (cat.subcategorias_proyecto.some(s => s.id === subId)) {
          return (cat as any).permite_fecha || false;
        }
      }
    }
    if (catId) {
      const cat = categorias.find(c => c.id === catId);
      return (cat as any)?.permite_fecha || false;
    }
    return false;
  };

  const handleCategoryChange = (empresa_id: string, value: string) => {
    if (!value || value === "none") {
      updateEmpresaRow(empresa_id, { categoria_id: null, subcategoria_id: null, fecha_categoria: null, ganado_presupuesto: null, ganado_op: null, ganado_fecha: null });
      return;
    }
    let newCatId: string | null = null;
    let newSubId: string | null = null;
    if (value.startsWith("sub:")) {
      newSubId = value.replace("sub:", "");
      const parentCat = categorias?.find((c) => c.subcategorias_proyecto.some((s) => s.id === newSubId));
      newCatId = parentCat?.id || null;
    } else {
      newCatId = value.replace("cat:", "");
    }
    const permiteFecha = categoryPermiteFecha(newCatId, newSubId);
    const row = empresaRows.find(r => r.empresa_id === empresa_id);
    const fecha = permiteFecha && !row?.fecha_categoria ? new Date().toISOString().split("T")[0] : row?.fecha_categoria || null;

    // If selecting "Ganado", open dialog to capture extra data
    if (newSubId === GANADO_SUBCATEGORIA_ID) {
      setGanadoDialogEmpresaId(empresa_id);
      setGanadoPrevCatId(row?.categoria_id || null);
      setGanadoPrevSubId(row?.subcategoria_id || null);
      setGanadoPresupuesto(row?.ganado_presupuesto ? String(row.ganado_presupuesto) : "");
      setGanadoOp(row?.ganado_op || "");
      setGanadoFecha(row?.ganado_fecha || new Date().toISOString().split("T")[0]);
      // Apply the category change optimistically
      updateEmpresaRow(empresa_id, { categoria_id: newCatId, subcategoria_id: newSubId, fecha_categoria: permiteFecha ? fecha : null });
      setGanadoDialogOpen(true);
      return;
    }

    // If changing away from Ganado, clear ganado fields
    if (row?.subcategoria_id === GANADO_SUBCATEGORIA_ID && newSubId !== GANADO_SUBCATEGORIA_ID) {
      updateEmpresaRow(empresa_id, { categoria_id: newCatId, subcategoria_id: newSubId, fecha_categoria: permiteFecha ? fecha : null, ganado_presupuesto: null, ganado_op: null, ganado_fecha: null });
      return;
    }

    updateEmpresaRow(empresa_id, { categoria_id: newCatId, subcategoria_id: newSubId, fecha_categoria: permiteFecha ? fecha : null });
  };

  const handleGanadoConfirm = () => {
    if (!ganadoDialogEmpresaId) return;
    updateEmpresaRow(ganadoDialogEmpresaId, {
      ganado_presupuesto: ganadoPresupuesto ? parseFloat(ganadoPresupuesto) : null,
      ganado_op: ganadoOp || null,
      ganado_fecha: ganadoFecha || null,
    });
    setGanadoDialogOpen(false);
    setGanadoDialogEmpresaId(null);
  };

  const handleGanadoCancel = () => {
    // Revert category change
    if (ganadoDialogEmpresaId) {
      updateEmpresaRow(ganadoDialogEmpresaId, {
        categoria_id: ganadoPrevCatId,
        subcategoria_id: ganadoPrevSubId,
        fecha_categoria: null,
      });
    }
    setGanadoDialogOpen(false);
    setGanadoDialogEmpresaId(null);
  };

  const openGanadoEdit = (empresa_id: string) => {
    const row = empresaRows.find(r => r.empresa_id === empresa_id);
    if (!row) return;
    setGanadoDialogEmpresaId(empresa_id);
    setGanadoPrevCatId(row.categoria_id);
    setGanadoPrevSubId(row.subcategoria_id);
    setGanadoPresupuesto(row.ganado_presupuesto ? String(row.ganado_presupuesto) : "");
    setGanadoOp(row.ganado_op || "");
    setGanadoFecha(row.ganado_fecha || new Date().toISOString().split("T")[0]);
    setGanadoDialogOpen(true);
  };

  const clearGanadoData = (empresa_id: string) => {
    updateEmpresaRow(empresa_id, { ganado_presupuesto: null, ganado_op: null, ganado_fecha: null });
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
        fecha_categoria: r.fecha_categoria,
        ganado_presupuesto: r.ganado_presupuesto,
        ganado_op: r.ganado_op,
        ganado_fecha: r.ganado_fecha,
      }));

    snapshotRef.current = "";

    // Trigger alert creation for empresas that requested it
    if (onCreateAlertaFromCategoria && initialData) {
      for (const row of empresaRows) {
        if (crearAlertaEmpresaIds.has(row.empresa_id) && row.fecha_categoria) {
          onCreateAlertaFromCategoria({
            proyecto_id: initialData.id,
            empresa_id: row.empresa_id,
            fecha: row.fecha_categoria,
          });
        }
      }
    }
    setCrearAlertaEmpresaIds(new Set());

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
        <DialogContent className="max-w-2xl max-h-[85vh] w-[calc(100vw-2rem)] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{mode === "create" ? "Nuevo Proyecto" : "Editar Proyecto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-5 pb-4 px-6 max-w-full">
              {/* Nombre */}
              <div className="space-y-1">
                <Label htmlFor="pnombre">Nombre del Proyecto *</Label>
                <Input id="pnombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </div>

              {/* Fecha Ingreso + Clasificación */}
              <div className="grid grid-cols-2 gap-3 min-w-0">
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
                              <>
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
                              {categoryPermiteFecha(row.categoria_id, row.subcategoria_id) && (
                                <div className="mt-1.5 pl-6 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-[10px] text-muted-foreground">Fecha:</Label>
                                    <Input type="date" className="h-7 w-36 text-xs" value={row.fecha_categoria || ""} onChange={(e) => updateEmpresaRow(row.empresa_id, { fecha_categoria: e.target.value || null })} />
                                  </div>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <Checkbox className="h-3.5 w-3.5" checked={crearAlertaEmpresaIds.has(row.empresa_id)} onCheckedChange={(v) => { const next = new Set(crearAlertaEmpresaIds); v ? next.add(row.empresa_id) : next.delete(row.empresa_id); setCrearAlertaEmpresaIds(next); }} />
                                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5"><Bell className="w-2.5 h-2.5" /> Crear alerta de seguimiento</span>
                                  </label>
                                </div>
                              )}
                              {row.subcategoria_id === GANADO_SUBCATEGORIA_ID && (row.ganado_presupuesto || row.ganado_op || row.ganado_fecha) && (
                                <div className="mt-1.5 pl-6 flex items-center gap-2 flex-wrap">
                                  <Trophy className="w-3 h-3 text-emerald-600" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {row.ganado_presupuesto != null && `Ppto: ${formatCLP(ufToCLP(row.ganado_presupuesto))} `}
                                    {row.ganado_op && `OP: ${row.ganado_op} `}
                                    {row.ganado_fecha && `Fecha: ${row.ganado_fecha}`}
                                  </span>
                                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openGanadoEdit(row.empresa_id)}><Pencil className="w-3 h-3" /></button>
                                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => clearGanadoData(row.empresa_id)}><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                              </>
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
                              <>
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
                              {categoryPermiteFecha(row.categoria_id, row.subcategoria_id) && (
                                <div className="mt-1.5 pl-6 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-[10px] text-muted-foreground">Fecha:</Label>
                                    <Input type="date" className="h-7 w-36 text-xs" value={row.fecha_categoria || ""} onChange={(e) => updateEmpresaRow(row.empresa_id, { fecha_categoria: e.target.value || null })} />
                                  </div>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <Checkbox className="h-3.5 w-3.5" checked={crearAlertaEmpresaIds.has(row.empresa_id)} onCheckedChange={(v) => { const next = new Set(crearAlertaEmpresaIds); v ? next.add(row.empresa_id) : next.delete(row.empresa_id); setCrearAlertaEmpresaIds(next); }} />
                                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5"><Bell className="w-2.5 h-2.5" /> Crear alerta de seguimiento</span>
                                  </label>
                                </div>
                              )}
                              {row.subcategoria_id === GANADO_SUBCATEGORIA_ID && (row.ganado_presupuesto || row.ganado_op || row.ganado_fecha) && (
                                <div className="mt-1.5 pl-6 flex items-center gap-2 flex-wrap">
                                  <Trophy className="w-3 h-3 text-emerald-600" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {row.ganado_presupuesto != null && `Ppto: ${formatCLP(ufToCLP(row.ganado_presupuesto))} `}
                                    {row.ganado_op && `OP: ${row.ganado_op} `}
                                    {row.ganado_fecha && `Fecha: ${row.ganado_fecha}`}
                                  </span>
                                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openGanadoEdit(row.empresa_id)}><Pencil className="w-3 h-3" /></button>
                                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => clearGanadoData(row.empresa_id)}><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                              </>
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
                            {categoryPermiteFecha(row.categoria_id, row.subcategoria_id) && (
                              <div className="mt-1.5 space-y-1">
                                <div className="flex items-center gap-2">
                                  <Label className="text-[10px] text-muted-foreground">Fecha:</Label>
                                  <Input type="date" className="h-7 w-36 text-xs" value={row.fecha_categoria || ""} onChange={(e) => updateEmpresaRow(row.empresa_id, { fecha_categoria: e.target.value || null })} />
                                </div>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <Checkbox className="h-3.5 w-3.5" checked={crearAlertaEmpresaIds.has(row.empresa_id)} onCheckedChange={(v) => { const next = new Set(crearAlertaEmpresaIds); v ? next.add(row.empresa_id) : next.delete(row.empresa_id); setCrearAlertaEmpresaIds(next); }} />
                                  <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5"><Bell className="w-2.5 h-2.5" /> Crear alerta de seguimiento</span>
                                </label>
                              </div>
                             )}
                            {row.subcategoria_id === GANADO_SUBCATEGORIA_ID && (row.ganado_presupuesto || row.ganado_op || row.ganado_fecha) && (
                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <Trophy className="w-3 h-3 text-emerald-600" />
                                <span className="text-[10px] text-muted-foreground">
                                  {row.ganado_presupuesto != null && `Ppto: ${formatCLP(ufToCLP(row.ganado_presupuesto))} `}
                                  {row.ganado_op && `OP: ${row.ganado_op} `}
                                  {row.ganado_fecha && `Fecha: ${row.ganado_fecha}`}
                                </span>
                                <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => openGanadoEdit(row.empresa_id)}><Pencil className="w-3 h-3" /></button>
                                <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => clearGanadoData(row.empresa_id)}><Trash2 className="w-3 h-3" /></button>
                              </div>
                            )}
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
              {mode === "edit" && alertas && alertas.length > 0 && (() => {
                const sorted = [...alertas].sort((a, b) => new Date(b.fecha_seguimiento).getTime() - new Date(a.fecha_seguimiento).getTime());
                const activas = sorted.filter(a => !a.completada);
                const completadas = sorted.filter(a => a.completada);
                const renderAlerta = (a: AlertaWithRelations) => {
                  const today = startOfDay(new Date());
                  const isOverdue = !a.completada && isBefore(new Date(a.fecha_seguimiento), today);
                  return (
                    <div key={a.id} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs", a.completada ? "border-border bg-muted/30 opacity-60" : isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-card")}>
                      {a.completada ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" /> : <Circle className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", isOverdue ? "text-destructive" : "text-muted-foreground")} />}
                      <div className="flex-1 min-w-0">
                        {a.titulo && <div className="font-semibold text-amber-700 text-[11px]">{a.titulo}</div>}
                        <div className={cn("truncate", a.completada && "line-through text-muted-foreground")}>{a.texto}</div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{a.responsable_profile?.display_name || a.responsable_profile?.email || "—"}</span>
                          <span className={isOverdue ? "text-destructive font-medium" : ""}>{format(new Date(a.fecha_seguimiento), "dd MMM yyyy", { locale: es })}{isOverdue && " (vencida)"}</span>
                        </div>
                      </div>
                    </div>
                  );
                };
                return (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Alertas ({activas.length} activas)
                    </Label>
                    {activas.length > 0 && <div className="space-y-1.5">{activas.map(renderAlerta)}</div>}
                    {completadas.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <button type="button" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
                            <ChevronRight className="w-3 h-3 transition-transform [[data-state=open]>&]:rotate-90" />
                            Completadas ({completadas.length})
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-1.5 space-y-1.5">
                          {completadas.map(renderAlerta)}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                );
              })()}

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
            </div>
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

      {/* Ganado data dialog */}
      <Dialog open={ganadoDialogOpen} onOpenChange={(open) => { if (!open) handleGanadoCancel(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trophy className="w-4 h-4 text-emerald-600" /> Datos de Ganado</DialogTitle>
            <DialogDescription>Ingresa los datos del proyecto ganado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Presupuesto (UF)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="Presupuesto en UF"
                value={ganadoPresupuesto}
                onChange={(e) => setGanadoPresupuesto(e.target.value)}
                onFocus={(e) => { if (e.target.value === "0") setGanadoPresupuesto(""); }}
              />
              {ganadoPresupuesto && parseFloat(ganadoPresupuesto) > 0 && (
                <p className="text-[10px] text-muted-foreground">≈ {formatCLP(ufToCLP(parseFloat(ganadoPresupuesto)))}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>OP</Label>
              <Input placeholder="Número de OP" value={ganadoOp} onChange={(e) => setGanadoOp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fecha</Label>
              <Input type="date" value={ganadoFecha} onChange={(e) => setGanadoFecha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleGanadoCancel}>Cancelar</Button>
            <Button type="button" onClick={handleGanadoConfirm}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

    // Build concatenated contact info from all contactos
    const contactos = cliente.contactos_cliente || [];
    const allContacto = contactos.map(c => c.contacto).filter(Boolean).join(" / ");
    const allEmail = contactos.map(c => c.email).filter(Boolean).join(" / ");
    const allTelefono = contactos.map(c => c.telefono).filter(Boolean).join(" / ");

    setters[0](append(currentNombre, cliente.nombre));
    setters[1](append(currentContacto, allContacto));
    setters[2](append(currentEmail, allEmail));
    setters[3](append(currentTelefono, allTelefono));
  };

  return (
    <div className="space-y-4">
      {sections.map(({ title, values, setters }) => {
        const availableClientes = getClientesForCategory(title);
        const catForTitle = categoriasCliente?.find((c) => c.nombre === CONTACTO_CAT_MAP[title]);
        return (
          <div key={title} className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Label>
              <ClientePicker
                clientes={availableClientes}
                onSelect={(c) => applyCliente(c, setters)}
                categoryId={catForTitle?.id}
              />
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

/* ── Client Picker Popover with create new ── */
function ClientePicker({ clientes, onSelect, categoryId }: { clientes: ClienteWithCategoria[]; onSelect: (c: ClienteWithCategoria) => void; categoryId?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newContacto, setNewContacto] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTelefono, setNewTelefono] = useState("");
  const createCliente = useCreateCliente();

  const filtered = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.contactos_cliente || []).some(ct => ct.contacto.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = () => {
    if (!newNombre.trim() || !categoryId) return;
    createCliente.mutate(
      { categoria_id: categoryId, nombre: newNombre.trim(), contactos: [{ contacto: newContacto, email: newEmail, telefono: newTelefono }] },
      {
        onSuccess: (data: any) => {
          onSelect({ ...data, categorias_cliente: {} } as any);
          setShowCreate(false);
          setNewNombre(""); setNewContacto(""); setNewEmail(""); setNewTelefono("");
          setOpen(false);
        },
      }
    );
  };

  return (
    <div className="relative">
      <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => setOpen(!open)}>
        <UserPlus className="w-3 h-3" /> Agregar cliente
      </Button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-72 rounded-md border border-border bg-popover shadow-md">
          <div className="p-2 space-y-1">
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          {!showCreate ? (
            <>
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
                      {(c.contactos_cliente || []).length > 0 && <div className="text-muted-foreground">{c.contactos_cliente.map(ct => ct.contacto).filter(Boolean).join(", ")}</div>}
                    </button>
                  ))
                )}
              </div>
              <div className="border-t p-2">
                <Button type="button" variant="ghost" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => setShowCreate(true)}>
                  <UserPlus className="w-3 h-3" /> Crear nuevo cliente
                </Button>
              </div>
            </>
          ) : (
            <div className="p-2 space-y-2">
              <Input placeholder="Nombre *" value={newNombre} onChange={(e) => setNewNombre(e.target.value)} className="h-7 text-xs" />
              <Input placeholder="Contacto" value={newContacto} onChange={(e) => setNewContacto(e.target.value)} className="h-7 text-xs" />
              <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-7 text-xs" />
              <Input placeholder="Teléfono" value={newTelefono} onChange={(e) => setNewTelefono(e.target.value)} className="h-7 text-xs" />
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
                <Button type="button" size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newNombre.trim() || createCliente.isPending}>
                  {createCliente.isPending ? "..." : "Crear"}
                </Button>
              </div>
            </div>
          )}
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
