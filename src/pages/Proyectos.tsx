import { useState, useEffect, useMemo, Fragment, useRef, useCallback, memo, useDeferredValue } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Loader2, MapPin, Building2, Copy, ChevronRight, Bell, X, Check, FolderKanban, TrendingUp, Filter, Trophy, Hammer, MousePointerClick, Folder, MessageCircle, ListChecks } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { useProyectos, useCreateProyecto, useUpdateProyecto, useDeleteProyecto, useUpdateNotas, useUpdateNotaGrupo, ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCategorias } from "@/hooks/useCategorias";
import { useEstadosProyecto } from "@/hooks/useEstadosProyecto";
import { useEstadosAmc } from "@/hooks/useEstadosAmc";
import { useAlertas, useCreateAlerta, useUpdateAlerta, useDeleteAlerta, useToggleAlertaCompletada, AlertaWithRelations } from "@/hooks/useAlertas";
import { useClasificacionesAlerta } from "@/hooks/useClasificacionesAlerta";
import { getNextClasificacion } from "@/lib/clasificacion-utils";
import { useClasificaciones } from "@/hooks/useClasificaciones";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCLP, formatUF, ufToCLP } from "@/data/mock-data";
import { useVentasByProyectoEmpresaIds } from "@/hooks/useVentasProyectoEmpresa";
import ProyectoFormDialog from "@/components/proyectos/ProyectoFormDialog";
import KpiCard from "@/components/dashboard/KpiCard";
import AlertaFormDialog from "@/components/alertas/AlertaFormDialog";
import { AlertasCollapsible, ParentAlertasDisplay, AlertasFullView } from "@/components/proyectos/AlertasInline";
import ContactosColumn from "@/components/proyectos/ContactosColumn";
import { ScrollArea } from "@/components/ui/scroll-area";
import CompleteAlertaDialog from "@/components/alertas/CompleteAlertaDialog";
import AlertaTreeDialog from "@/components/alertas/AlertaTreeDialog";
import BackToAlertasFloat from "@/components/alertas/BackToAlertasFloat";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ProyectoRepositorioDialog from "@/components/repositorio/ProyectoRepositorioDialog";
import { useAddChecklistItem, startsWithDate } from "@/hooks/useEmpresaChecklist";
import EmpresaChecklistPanel from "@/components/empresas/EmpresaChecklistPanel";
import HitosEjecucionPanel from "@/components/proyectos/HitosEjecucionPanel";
import { cn } from "@/lib/utils";

/** Deduplicate alertas by content key, keeping the oldest by created_at */
function deduplicateAlertas(alertas: AlertaWithRelations[]): AlertaWithRelations[] {
  const seen = new Map<string, AlertaWithRelations>();
  for (const a of alertas) {
    const key = `${a.titulo}|${a.texto}|${a.fecha_seguimiento}|${a.empresa_id ?? ""}`;
    const existing = seen.get(key);
    if (!existing || a.created_at < existing.created_at) {
      seen.set(key, a);
    }
  }
  return Array.from(seen.values());
}

/* ── Isolated DebouncedInput to prevent parent re-renders on every keystroke ── */
const DebouncedInput = memo(function DebouncedInput({
  value: externalValue,
  onChange,
  delay = 200,
  ...props
}: { value: string; onChange: (v: string) => void; delay?: number } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  const [localValue, setLocalValue] = useState(externalValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { setLocalValue(externalValue); }, [externalValue]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), delay);
  }, [onChange, delay]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return <Input {...props} value={localValue} onChange={handleChange} />;
});

// ESTADOS_AMC now loaded dynamically via useEstadosProyecto
const ESTADOS_OBRA = ["Todos", "Anteproyecto", "Proyecto", "Licitación", "Constructora Adjudicada", "Obra/Ejecución", "Obra Gruesa Inicial", "Obra Gruesa Intermedia", "Terminaciones", "Detenida", "Sin Información"];

export default function Proyectos() {
  const { data: proyectos, isLoading } = useProyectos();
  const { isAdmin, isUsuarioTipo1 } = useAuth();
  const { data: empresas } = useEmpresas();
  const { data: clasificaciones } = useClasificaciones();
  const { data: estadosProyecto } = useEstadosProyecto();
  const { data: estadosAmc } = useEstadosAmc();
  const { data: clasificacionesAlerta } = useClasificacionesAlerta();
  const createProyecto = useCreateProyecto();
  const updateProyecto = useUpdateProyecto();
  const deleteProyecto = useDeleteProyecto();
  const updateNotas = useUpdateNotas();
  const updateNotaGrupo = useUpdateNotaGrupo();
  const qcMain = useQueryClient();

  const handleUpdateEstadoAmcPE = useCallback(async (proyectoEmpresaId: string, nuevoEstado: string) => {
    try {
      const { error } = await supabase.from("proyecto_empresas").update({ estado_amc: nuevoEstado } as any).eq("id", proyectoEmpresaId);
      if (error) throw error;
      qcMain.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success(`Estado AMC actualizado a "${nuevoEstado}"`);
    } catch (e: any) {
      toast.error("Error al actualizar estado: " + e.message);
    }
  }, [qcMain]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [filterEstados, setFilterEstados] = useState<string[]>([]);
  const [filterEmpresas, setFilterEmpresas] = useState<string[]>([]);
  const [filterCategorias, setFilterCategorias] = useState<string[]>([]);
  const [filterEstadosObra, setFilterEstadosObra] = useState<string[]>([]);
  const [filterClasificaciones, setFilterClasificaciones] = useState<string[]>([]);
  const [filterBotones, setFilterBotones] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ProyectoWithEmpresas[] | null>(null);
  const [viewTarget, setViewTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [templateSource, setTemplateSource] = useState<ProyectoWithEmpresas | null>(null);
  const [editParentGroup, setEditParentGroup] = useState<ProyectoWithEmpresas[] | null>(null);
  const [pendingParentSubmit, setPendingParentSubmit] = useState<{ data: any; toDelete: ProyectoWithEmpresas[] } | null>(null);
  const [repositorioTarget, setRepositorioTarget] = useState<{ id: string; name: string; empresaName?: string } | null>(null);
  const [hitosTarget, setHitosTarget] = useState<{ proyectoEmpresaId: string; empresaName?: string | null; proyectoNombre: string } | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [highlightProyectoId, setHighlightProyectoId] = useState<string | null>(null);
  const [alertaCreateContext, setAlertaCreateContext] = useState<{ proyecto_id: string; empresa_id: string | null; defaultTexto?: string; parentAlertaId?: string; defaultClasificacionId?: string; defaultSubclasificacionId?: string; defaultCategoriaProyectoId?: string; defaultSubcategoriaProyectoId?: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBackToAlertas, setShowBackToAlertas] = useState(false);

  const { data: alertas } = useAlertas();
  const { data: categorias } = useCategorias();
  const createAlerta = useCreateAlerta();
  const updateAlerta = useUpdateAlerta();
  const deleteAlertaMutation = useDeleteAlerta();
  const toggleCompletada = useToggleAlertaCompletada();

  const [alertaEditTarget, setAlertaEditTarget] = useState<AlertaWithRelations | null>(null);
  const [alertaDeleteTarget, setAlertaDeleteTarget] = useState<string | null>(null);
  const [alertaCompleteTarget, setAlertaCompleteTarget] = useState<AlertaWithRelations | null>(null);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const [showTree, setShowTree] = useState(false);
  const [treeRootId, setTreeRootId] = useState<string | null>(null);

  const handleShowTree = useCallback((alertaId: string) => {
    setTreeRootId(alertaId);
    setShowTree(true);
  }, []);

  const qc = useQueryClient();
  const handleAssignEmpresa = useCallback(async (alertaId: string, empresaId: string | null) => {
    const { error } = await supabase
      .from("alertas")
      .update({ empresa_id: empresaId } as any)
      .eq("id", alertaId);
    if (error) {
      toast.error("Error al asignar empresa: " + error.message);
    } else {
      toast.success("Empresa asignada");
      qc.invalidateQueries({ queryKey: ["alertas"] });
    }
  }, [qc]);

  const [profiles, setProfiles] = useState<{ user_id: string; display_name: string; email: string }[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");

  // (debounce moved into DebouncedInput component)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    supabase.from("profiles").select("user_id, display_name, email").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  // Highlight project from widget navigation or URL param
  const highlightProject = useCallback((proyectoId: string, empresaId?: string | null) => {
    if (proyectos) {
      const target = proyectos.find(p => p.id === proyectoId);
      if (target) {
        const key = target.nombre.trim().toLowerCase();
        setExpandedGroups(prev => ({ ...prev, [key]: true }));
      }
      // If empresaId provided, find the child proyecto row that has that empresa linked
      let targetRowId = proyectoId;
      if (empresaId) {
        const childRow = proyectos.find(p => 
          p.nombre === target?.nombre && 
          p.proyecto_empresas?.some(pe => pe.empresa_id === empresaId)
        );
        if (childRow) targetRowId = childRow.id;
      }
      setHighlightProyectoId(targetRowId);
      setTimeout(() => {
        const el = document.getElementById(`proyecto-row-${targetRowId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    } else {
      setHighlightProyectoId(proyectoId);
      setTimeout(() => {
        const el = document.getElementById(`proyecto-row-${proyectoId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
    setTimeout(() => setHighlightProyectoId(null), 3000);
  }, [proyectos]);

  useEffect(() => {
    const id = searchParams.get("highlight");
    const empresaId = searchParams.get("highlight_empresa");
    const from = searchParams.get("from");
    if (id && proyectos?.length) {
      highlightProject(id, empresaId);
      if (from === "alertas") setShowBackToAlertas(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, proyectos, highlightProject, setSearchParams]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        if (typeof detail === "string") {
          highlightProject(detail);
        } else {
          highlightProject(detail.proyectoId, detail.empresaId);
        }
      }
    };
    window.addEventListener("highlight-proyecto", handler);
    return () => window.removeEventListener("highlight-proyecto", handler);
  }, [highlightProject]);

  const toggleFilter = useCallback((setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }, []);

  const projectSearchIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const p of proyectos || []) {
      const clientNames = (p.proyecto_clientes || [])
        .map((pc) => pc.clientes?.nombre || "")
        .filter(Boolean)
        .join(" ");
      index.set(p.id, `${p.nombre} ${p.comuna} ${clientNames}`.toLowerCase());
    }
    return index;
  }, [proyectos]);

  const buttonLabelsByLink = useMemo(() => {
    const categoriaLabels = new Map<string, string>();
    const subcategoriaLabels = new Map<string, string>();

    for (const categoria of categorias || []) {
      if ((categoria as any).boton_label) categoriaLabels.set(categoria.id, (categoria as any).boton_label);
      for (const subcategoria of categoria.subcategorias_proyecto || []) {
        if ((subcategoria as any).boton_label) subcategoriaLabels.set(subcategoria.id, (subcategoria as any).boton_label);
      }
    }

    return { categoriaLabels, subcategoriaLabels };
  }, [categorias]);

  const filtered = useMemo(() => (proyectos || []).filter((p) => {
    const searchLower = deferredSearch.trim().toLowerCase();
    const matchSearch = !searchLower || (projectSearchIndex.get(p.id)?.includes(searchLower) ?? false);
    const matchEstado = filterEstados.length === 0 || filterEstados.includes(p.estado_amc);
    const matchEstadoObra = filterEstadosObra.length === 0 || filterEstadosObra.includes(p.estado_obra);
    const matchEmpresa =
      filterEmpresas.length === 0 ||
      p.proyecto_empresas?.some((pe) => filterEmpresas.includes(pe.empresa_id));
    const matchCategoria =
      filterCategorias.length === 0 ||
      p.proyecto_empresas?.some((pe) => filterCategorias.includes(pe.categoria_id || "") || filterCategorias.includes(pe.subcategoria_id || ""));
    const matchClasificacion =
      filterClasificaciones.length === 0 || filterClasificaciones.includes(p.clasificacion_id || "");
    const matchBoton = filterBotones.length === 0 || p.proyecto_empresas?.some((pe) => {
      return filterBotones.includes((pe as any).estado_amc || "Vigente");
    });
    return matchSearch && matchEstado && matchEstadoObra && matchEmpresa && matchCategoria && matchClasificacion && matchBoton;
  }), [proyectos, deferredSearch, projectSearchIndex, filterEstados, filterEstadosObra, filterEmpresas, filterCategorias, filterClasificaciones, filterBotones, buttonLabelsByLink]);

  // Full (unfiltered) group sizes — used to keep parent-line rendering even when filter reduces items to 1
  const fullGroupSizes = useMemo(() => {
    const sizes: Record<string, number> = {};
    (proyectos || []).forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      sizes[key] = (sizes[key] || 0) + 1;
    });
    return sizes;
  }, [proyectos]);

  // Group projects by name
  const groupedRows = useMemo(() => {
    const groups: Record<string, ProyectoWithEmpresas[]> = {};
    filtered.forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    // Build ordered list: iterate filtered to maintain order, emit group once
    const seen = new Set<string>();
    const result: { key: string; items: ProyectoWithEmpresas[] }[] = [];
    filtered.forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ key, items: groups[key] });
      }
    });
    return result;
  }, [filtered]);

  // Lift ventas data: single query for all proyecto_empresa IDs
  const allPeIds = useMemo(() => {
    const ids: string[] = [];
    for (const p of (proyectos || [])) {
      for (const pe of (p.proyecto_empresas || [])) {
        ids.push(pe.id);
      }
    }
    return ids;
  }, [proyectos]);

  const { data: allVentasData } = useVentasByProyectoEmpresaIds(allPeIds);

  // Pre-compute ventas totals per proyecto_empresa ID (ppto + ventas adicionales)
  const ventasMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of (proyectos || [])) {
      for (const pe of (p.proyecto_empresas || [])) {
        const ppto = Number((pe as any).ganado_presupuesto) || 0;
        if (ppto !== 0) map.set(pe.id, ppto);
      }
    }
    for (const v of (allVentasData || [])) {
      map.set(v.proyecto_empresa_id, (map.get(v.proyecto_empresa_id) || 0) + Number(v.monto_uf));
    }
    return map;
  }, [proyectos, allVentasData]);

  // KPI stats
  const GANADO_SUBCATEGORIA_ID = "5ede8de9-4fd3-4670-85d5-4934af648e74";

  const kpiStats = useMemo(() => {
    const allProyectos = proyectos || [];
    const groupsAll: Record<string, ProyectoWithEmpresas[]> = {};
    allProyectos.forEach(p => {
      const k = p.nombre.trim().toLowerCase();
      if (!groupsAll[k]) groupsAll[k] = [];
      groupsAll[k].push(p);
    });
    const totalProyectos = Object.keys(groupsAll).length;
    let adjudicados = 0;
    let ganados = 0;
    let obrasEjecucion = 0;
    const OBRAS_LABEL = "Obra/Ejecución";
    Object.values(groupsAll).forEach(g => {
      if (g.some(p => p.adjudicado)) adjudicados++;
      if (g.some(p => p.proyecto_empresas?.some(pe => pe.subcategoria_id === GANADO_SUBCATEGORIA_ID))) ganados++;
      if (g.some(p => p.proyecto_empresas?.some(pe => {
        return ((pe as any).estado_amc || "Vigente") === OBRAS_LABEL;
      }))) obrasEjecucion++;
    });
    const filteredGroups = groupedRows.length;
    const hasActiveFilters = !!(search || filterEstados.length || filterEmpresas.length || filterCategorias.length || filterEstadosObra.length || filterClasificaciones.length || filterBotones.length);
    return { totalProyectos, adjudicados, ganados, obrasEjecucion, filteredGroups, hasActiveFilters };
  }, [proyectos, categorias, groupedRows, search, filterEstados, filterEmpresas, filterCategorias, filterEstadosObra, filterClasificaciones, filterBotones]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openProjectChat = useCallback((projectId: string, projectName: string, empresaId?: string | null, empresaName?: string | null) => {
    window.dispatchEvent(
      new CustomEvent("open-project-chat", {
        detail: { projectId, projectName, empresaId: empresaId ?? null, empresaName: empresaName ?? null },
      })
    );
  }, []);

  const executeParentSubmit = async (
    data: any,
    sharedFields: any,
    group: ProyectoWithEmpresas[],
    toDelete: ProyectoWithEmpresas[],
    selectedEmpresaIds: Set<string>,
  ) => {
    const existingMap = new Map<string, ProyectoWithEmpresas>();
    for (const p of group) {
      for (const pe of (p.proyecto_empresas || [])) {
        existingMap.set(pe.empresa_id, p);
      }
    }

    for (const p of group) {
      const pe = p.proyecto_empresas?.[0];
      if (pe && selectedEmpresaIds.has(pe.empresa_id)) {
        const link = data.empresa_links.find((l: any) => l.empresa_id === pe.empresa_id)!;
        await updateProyecto.mutateAsync({
          ...sharedFields, notas: p.notas || "", monto_estimado: null, empresa_links: [link], id: p.id,
        });
      } else if (toDelete.some((d) => d.id === p.id)) {
        await deleteProyecto.mutateAsync(p.id);
      }
    }

    const newLinks = data.empresa_links.filter((l: any) => !existingMap.has(l.empresa_id));
    for (const link of newLinks) {
      await createProyecto.mutateAsync({
        ...sharedFields, notas: "", monto_estimado: null, empresa_links: [link],
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    {showBackToAlertas && <BackToAlertasFloat />}
    <div className="h-full flex flex-col overflow-hidden gap-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proyectos</h1>
          <p className="text-muted-foreground mt-1">Base de datos de proyectos</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Nuevo Proyecto
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <DebouncedInput value={search} onChange={setSearch} placeholder="Buscar por nombre, comuna o cliente..." className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* 1. Estado (x Proyecto) — was Estado AMC */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Estado (x Proyecto) {filterEstados.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{filterEstados.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {(estadosProyecto || []).map((ep) => (
                    <label key={ep.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={filterEstados.includes(ep.nombre)} onCheckedChange={() => toggleFilter(setFilterEstados, ep.nombre)} />
                      {ep.nombre}
                    </label>
                  ))}

              </div>
              {filterEstados.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setFilterEstados([])}>Limpiar</Button>
              )}
            </PopoverContent>
          </Popover>

          {/* 2. Tipo de Proyecto — was Clasificación */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Tipo de Proyecto {filterClasificaciones.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{filterClasificaciones.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {clasificaciones?.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={filterClasificaciones.includes(c.id)} onCheckedChange={() => toggleFilter(setFilterClasificaciones, c.id)} />
                      {c.nombre}
                    </label>
                  ))}
              </div>
              {filterClasificaciones.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setFilterClasificaciones([])}>Limpiar</Button>
              )}
            </PopoverContent>
          </Popover>

          {/* 3. Estado Obra */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Estado Obra {filterEstadosObra.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{filterEstadosObra.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {ESTADOS_OBRA.filter(e => e !== "Todos").map((estado) => (
                    <label key={estado} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={filterEstadosObra.includes(estado)} onCheckedChange={() => toggleFilter(setFilterEstadosObra, estado)} />
                      {estado}
                    </label>
                  ))}
              </div>
              {filterEstadosObra.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setFilterEstadosObra([])}>Limpiar</Button>
              )}
            </PopoverContent>
          </Popover>

          {/* 4. Empresa */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Empresa {filterEmpresas.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{filterEmpresas.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {empresas?.map((e) => (
                    <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={filterEmpresas.includes(e.id)} onCheckedChange={() => toggleFilter(setFilterEmpresas, e.id)} />
                      {e.nombre}
                    </label>
                  ))}
              </div>
              {filterEmpresas.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setFilterEmpresas([])}>Limpiar</Button>
              )}
            </PopoverContent>
          </Popover>

          {/* 5. Estado AMC (x Empresa) */}
          {estadosAmc && estadosAmc.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <MousePointerClick className="w-3 h-3" />
                  Estado AMC (x Empresa) {filterBotones.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{filterBotones.length}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start">
                <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {estadosAmc.map((ea) => (
                    <label key={ea.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                      <Checkbox checked={filterBotones.includes(ea.nombre)} onCheckedChange={() => toggleFilter(setFilterBotones, ea.nombre)} />
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ea.color }} />
                      {ea.nombre}
                    </label>
                  ))}
                </div>
                {filterBotones.length > 0 && (
                  <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setFilterBotones([])}>Limpiar</Button>
                )}
              </PopoverContent>
            </Popover>
          )}

          {/* 6. Estatus (x Empresa) — was Categoría */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                Estatus (x Empresa) {filterCategorias.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{filterCategorias.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-2" align="start">
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                  {categorias?.map((cat) => (
                    <Fragment key={cat.id}>
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox checked={filterCategorias.includes(cat.id)} onCheckedChange={() => toggleFilter(setFilterCategorias, cat.id)} />
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.nombre}
                      </label>
                      {cat.subcategorias_proyecto?.map((sub) => (
                        <label key={sub.id} className="flex items-center gap-2 px-2 py-1.5 pl-6 rounded hover:bg-accent cursor-pointer text-sm">
                          <Checkbox checked={filterCategorias.includes(sub.id)} onCheckedChange={() => toggleFilter(setFilterCategorias, sub.id)} />
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                          {sub.nombre}
                        </label>
                      ))}
                    </Fragment>
                  ))}
              </div>
              {filterCategorias.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => setFilterCategorias([])}>Limpiar</Button>
              )}
            </PopoverContent>
          </Popover>
          {kpiStats.hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setSearch("");
                setFilterEstados([]);
                setFilterEmpresas([]);
                setFilterCategorias([]);
                setFilterEstadosObra([]);
                setFilterClasificaciones([]);
                setFilterBotones([]);
              }}
            >
              <X className="w-3 h-3" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <KpiCard
          title="Total Proyectos"
          value={String(kpiStats.totalProyectos)}
          subtitle={`${kpiStats.adjudicados} adjudicados`}
          icon={FolderKanban}
          variant="info"
          delay={0.08}
        />
        <KpiCard
          title="Ganados"
          value={String(kpiStats.ganados)}
          subtitle="Proyectos ganados"
          icon={Trophy}
          variant="success"
          delay={0.12}
          onClick={() => {
            const isActive = filterCategorias.length === 1 && filterCategorias[0] === GANADO_SUBCATEGORIA_ID;
            if (isActive) {
              setFilterCategorias([]);
            } else {
              setFilterCategorias([GANADO_SUBCATEGORIA_ID]);
              setFilterEstados([]);
              setFilterEmpresas([]);
              setFilterEstadosObra([]);
              setFilterClasificaciones([]);
              setFilterBotones([]);
              setSearch("");
            }
          }}
          active={filterCategorias.length === 1 && filterCategorias[0] === GANADO_SUBCATEGORIA_ID}
        />
        <KpiCard
          title="Obras / Ejecución"
          value={String(kpiStats.obrasEjecucion)}
          subtitle="Estado AMC (x Empresa)"
          icon={Hammer}
          variant="warning"
          delay={0.14}
          onClick={() => {
            const isActive = filterBotones.length === 1 && filterBotones[0] === "Obra/Ejecución";
            if (isActive) {
              setFilterBotones([]);
            } else {
              setFilterBotones(["Obra/Ejecución"]);
              setFilterEstados([]);
              setFilterEmpresas([]);
              setFilterCategorias([]);
              setFilterEstadosObra([]);
              setFilterClasificaciones([]);
              setSearch("");
            }
          }}
          active={filterBotones.length === 1 && filterBotones[0] === "Obra/Ejecución"}
        />
        <KpiCard
          title="Resultado Filtros"
          value={String(kpiStats.filteredGroups)}
          subtitle={kpiStats.hasActiveFilters ? "con filtros aplicados" : "sin filtros activos"}
          icon={Filter}
          variant={kpiStats.hasActiveFilters ? "warning" : "default"}
          delay={0.16}
        />
      </div>


      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 min-h-0 bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-secondary/80 backdrop-blur-sm">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">N°</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contactos</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingreso</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comuna</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado Obra</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado (x Proyecto)</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresas / Cotización</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado AMC</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ key, items }, groupIdx) => {
                const isGroup = (fullGroupSizes[key] || items.length) > 1;
                const expanded = expandedGroups[key] ?? false;
                const parentNum = groupIdx + 1;
                const isEven = groupIdx % 2 === 1;
                const evenBg = isEven ? "bg-muted/40" : "";

                if (!isGroup) {
                  const p = items[0];
                  return <ProjectRow key={p.id} p={p} displayNum={String(parentNum)} isEven={isEven} onView={setViewTarget} onEdit={setEditTarget} onDelete={setDeleteTarget} onTemplate={setTemplateSource} onOpenChat={openProjectChat} updateNotas={updateNotas.mutate} filterBotones={filterBotones} filterEmpresas={filterEmpresas} ventasMap={ventasMap} estadosAmc={estadosAmc} onUpdateEstadoAmcPE={handleUpdateEstadoAmcPE} />;
                }

                // Grouped header
                const first = items[0];
                return (
                  <Fragment key={key}>
                    <tr
                      id={`proyecto-row-${first.id}`}
                      className={`hover:bg-secondary/30 transition-colors cursor-pointer border-t-[3px] border-muted-foreground/30 ${evenBg} ${highlightProyectoId === first.id ? "ring-2 ring-primary ring-inset" : ""}`}
                      onClick={() => toggleGroup(key)}
                    >
                      <td className="px-5 py-3 text-muted-foreground">
                        <ChevronRight className={`w-4 h-4 inline transition-transform ${expanded ? "rotate-90" : ""}`} /> {parentNum}
                      </td>
                      <td className="px-5 py-3 font-medium text-card-foreground">
                        <div>{first.nombre} <span className="ml-1.5 text-xs text-muted-foreground font-normal">({items.length})</span></div>
                        {first.clasificaciones_proyecto && (
                          <div className="text-[10px] text-muted-foreground">{first.clasificaciones_proyecto.nombre}</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <ContactosColumn proyecto={first} groupItems={items} />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-xs">{(first as any).fecha_ingreso ? new Date((first as any).fecha_ingreso).toLocaleDateString("es-CL") : "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{first.comuna}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div>{first.estado_obra}</div>
                        {first.fecha_estado_obra && (
                          <div className="text-[10px] text-muted-foreground/70">{new Date(first.fecha_estado_obra).toLocaleDateString("es-CL")}</div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {/* Estado (x Proyecto) — project-level estado_amc */}
                        <StatusBadge status={first.estado_amc} color={(estadosAmc || []).find(ea => ea.nombre === first.estado_amc)?.color} />
                      </td>
                      <td className="px-5 py-3">
                        <GroupEmpresasCell items={items} filterEmpresas={filterEmpresas} ventasMap={ventasMap} />
                      </td>
                      <td className="px-5 py-3"></td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(() => {
                            const groupIds2 = new Set(items.map(i => i.id));
                            const childEmpresaAlertas = (alertas || []).filter(a => groupIds2.has(a.proyecto_id) && a.empresa_id && !a.completada && !a.deleted);
                            if (childEmpresaAlertas.length === 0) return null;
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-500 hover:text-amber-600"
                                title={`${childEmpresaAlertas.length} alerta${childEmpresaAlertas.length !== 1 ? "s" : ""} pendiente${childEmpresaAlertas.length !== 1 ? "s" : ""} en empresas`}
                                onClick={(e) => { e.stopPropagation(); setExpandedGroups(prev => ({ ...prev, [key]: true })); }}
                              >
                                <Bell className="w-3.5 h-3.5 fill-amber-500" />
                              </Button>
                            );
                          })()}
                          {(() => {
                            const groupIds = new Set(items.map(i => i.id));
                            const parentAlertasRaw = (alertas || []).filter(a => groupIds.has(a.proyecto_id) && !a.empresa_id);
                            const parentAlertas = deduplicateAlertas(parentAlertasRaw);
                            const activeCount = parentAlertas.filter(a => !a.completada && !a.deleted).length;
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 relative" title="Alertas del proyecto" onClick={(e) => e.stopPropagation()}>
                                    <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                                    {activeCount > 0 && (
                                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] text-white flex items-center justify-center font-bold">{activeCount}</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 max-h-[400px] overflow-y-auto" align="end" onClick={(e) => e.stopPropagation()}>
                                  <div className="text-xs font-semibold text-foreground mb-2">Alertas del Proyecto</div>
                                  <AlertasFullView
                                    alertas={parentAlertas}
                                    allAlertas={alertas}
                                    onEdit={(a) => setAlertaEditTarget(a)}
                                    onDelete={(id) => setAlertaDeleteTarget(id)}
                                    onComplete={(a) => setAlertaCompleteTarget(a)}
                                    onShowTree={handleShowTree}
                                    onCreateDependent={(a) => setAlertaCreateContext({ proyecto_id: a.proyecto_id, empresa_id: a.empresa_id || null, parentAlertaId: a.id })}
                                    onCreateNew={() => setAlertaCreateContext({ proyecto_id: first.id, empresa_id: null })}
                                    empresas={empresas?.map(e => ({ id: e.id, nombre: e.nombre })) || []}
                                    onAssignEmpresa={handleAssignEmpresa}
                                  />
                                </PopoverContent>
                              </Popover>
                            );
                          })()}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Abrir chat del proyecto"
                            onClick={(e) => {
                              e.stopPropagation();
                              openProjectChat(first.id, first.nombre, null, null);
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-chart-effective fill-chart-effective" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Repositorio" onClick={(e) => { e.stopPropagation(); setRepositorioTarget({ id: first.id, name: first.nombre }); }}>
                            <Folder className="w-3.5 h-3.5 text-amber-500" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar línea madre" onClick={(e) => { e.stopPropagation(); setEditParentGroup(items); }}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" title="Eliminar grupo" onClick={(e) => { e.stopPropagation(); setDeleteGroupTarget(items); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Parent note row */}
                    <tr className={evenBg}>
                       <td className="px-5 pb-2 pt-0" colSpan={10}>
                        <NotaGrupoCell proyecto={first} onSave={updateNotaGrupo.mutate} onCreateAlerta={(texto) => setAlertaCreateContext({ proyecto_id: first.id, empresa_id: null, defaultTexto: texto })} />
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expanded && (() => {
                         // Flatten: one child row per unique empresa across all items
                        // When empresa filter is active, only show matching empresas
                        const seenEmpresas = new Set<string>();
                        const childRows: { p: ProyectoWithEmpresas; pe: ProyectoWithEmpresas["proyecto_empresas"][0] }[] = [];
                        for (const p of items) {
                          for (const pe of (p.proyecto_empresas || [])) {
                            if (!seenEmpresas.has(pe.empresa_id)) {
                              seenEmpresas.add(pe.empresa_id);
                              // Skip empresas that don't match the active filter
                              if (filterEmpresas.length > 0 && !filterEmpresas.includes(pe.empresa_id)) continue;
                              childRows.push({ p, pe });
                            }
                          }
                        }
                        const groupChildIds = new Set(items.map(i => i.id));
                        const childBg = isEven ? "bg-muted/30" : "bg-secondary/10";

                        return childRows.map(({ p, pe }, childIdx) => {
                          const empresaId = pe.empresa_id;
                          const childAlertasRaw = (alertas || []).filter(a => groupChildIds.has(a.proyecto_id) && a.empresa_id === empresaId);
                          const childAlertas = deduplicateAlertas(childAlertasRaw);
                          return (
                            <Fragment key={`${p.id}-${empresaId}`}>
                              <motion.tr
                                id={`proyecto-row-${p.id}`}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`hover:bg-secondary/30 transition-colors ${childBg} ${highlightProyectoId === p.id ? "ring-2 ring-primary ring-inset" : ""}`}
                              >
                                <td className="px-5 py-2 text-muted-foreground pl-10 align-top">{parentNum}.{childIdx + 1}</td>
                                <td colSpan={3} className="px-5 py-2 align-top">
                                  <NotasCell proyecto={p} onSave={updateNotas.mutate} onCreateAlerta={(texto) => setAlertaCreateContext({ proyecto_id: p.id, empresa_id: empresaId, defaultTexto: texto })} empresaId={empresaId} />
                                </td>
                                <td colSpan={2} className="px-5 py-2 align-top">
                                  <AlertasCollapsible alertas={childAlertas} allAlertas={alertas} onEdit={(a) => setAlertaEditTarget(a)} onDelete={(id) => setAlertaDeleteTarget(id)} onComplete={(a) => setAlertaCompleteTarget(a)} onShowTree={handleShowTree} onCreateDependent={(a) => setAlertaCreateContext({ proyecto_id: a.proyecto_id, empresa_id: a.empresa_id || null, parentAlertaId: a.id })} />
                                </td>
                                <td className="px-5 py-2 align-top"><EmpresasCell proyectoEmpresas={[pe]} ventasMap={ventasMap} /></td>
                                <td className="px-5 py-2 align-top text-center">
                                  {/* Estado AMC per empresa */}
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    <EstadoAmcPopoverInline
                                      currentStatus={(pe as any).estado_amc || "Vigente"}
                                      estadosAmc={estadosAmc || []}
                                      onUpdate={(nuevo) => handleUpdateEstadoAmcPE(pe.id, nuevo)}
                                    />
                                    {((pe as any).estado_amc === "Obra/Ejecución") && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setHitosTarget({ proyectoEmpresaId: pe.id, empresaName: pe.empresas?.nombre, proyectoNombre: p.nombre });
                                        }}
                                        title="Hitos Ejecución Proyectos"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                                      >
                                        <ListChecks className="w-3 h-3" />
                                        Hitos
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-5 py-2 text-right align-top">
                                  <div className="flex justify-end gap-1">
                                    {(() => {
                                      const empresaAlertas = childAlertas.filter(a => a.empresa_id === empresaId);
                                      const activeCount = empresaAlertas.filter(a => !a.completada && !a.deleted).length;
                                      return (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 relative" title="Alertas de empresa">
                                              <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                                              {activeCount > 0 && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-[8px] text-white flex items-center justify-center font-bold">{activeCount}</span>
                                              )}
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80 max-h-[400px] overflow-y-auto" align="end">
                                            <div className="text-xs font-semibold text-foreground mb-2">Alertas — {pe.empresas?.nombre || "Empresa"}</div>
                                            <AlertasFullView
                                              alertas={empresaAlertas}
                                              allAlertas={alertas}
                                              onEdit={(a) => setAlertaEditTarget(a)}
                                              onDelete={(id) => setAlertaDeleteTarget(id)}
                                              onComplete={(a) => setAlertaCompleteTarget(a)}
                                              onShowTree={handleShowTree}
                                              onCreateDependent={(a) => setAlertaCreateContext({ proyecto_id: a.proyecto_id, empresa_id: a.empresa_id || null, parentAlertaId: a.id })}
                                              onCreateNew={() => setAlertaCreateContext({ proyecto_id: p.id, empresa_id: empresaId })}
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      );
                                    })()}
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Repositorio empresa" onClick={(e) => { e.stopPropagation(); setRepositorioTarget({ id: first.id, name: first.nombre, empresaName: pe.empresas?.nombre }); }}>
                                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Abrir chat de esta empresa"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openProjectChat(first.id, first.nombre, empresaId, pe.empresas?.nombre || null);
                                      }}
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 text-chart-potential fill-chart-potential" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(p)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                  </div>
                                </td>
                              </motion.tr>
                              {empresaId && (
                                <tr className={childBg}>
                                  <td colSpan={10} className="px-5 pb-2 pt-0 pl-10">
                                    <EmpresaChecklistPanel empresaId={empresaId} proyectoId={p.id} readOnly={false} />
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        });
                      })()}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            {(proyectos || []).length === 0 ? (
              <div>
                <p>No hay proyectos registrados.</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>Crear primer proyecto</Button>
              </div>
            ) : (
              <p>No se encontraron proyectos con los filtros aplicados</p>
            )}
          </div>
        )}
      </motion.div>

      {/* Create dialog */}
      <ProyectoFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        mode="create"
        isLoading={createProyecto.isPending}
        isAdmin={isAdmin}
        onSubmit={(data) => {
          createProyecto.mutate(data, { onSuccess: () => setShowCreate(false) });
        }}
      />

      {/* Template dialog */}
      {templateSource && (
        <ProyectoFormDialog
          open={!!templateSource}
          onOpenChange={(val) => !val && setTemplateSource(null)}
          mode="create"
          initialData={{ ...templateSource, nombre: `${templateSource.nombre} (copia)` }}
          isLoading={createProyecto.isPending}
          isAdmin={isAdmin}
          onSubmit={(data) => {
            createProyecto.mutate(data, { onSuccess: () => setTemplateSource(null) });
          }}
        />
      )}

      {/* (Add line dialog removed - managed via parent edit) */}
      {/* Edit child row dialog */}
      {editTarget && (
        <ProyectoFormDialog
          open={!!editTarget}
          onOpenChange={(val) => !val && setEditTarget(null)}
          mode="edit"
          initialData={editTarget}
          isChildRow
          isLoading={updateProyecto.isPending}
          isAdmin={isAdmin}
          alertas={(alertas || []).filter(a => a.proyecto_id === editTarget.id)}
          onCompleteAlerta={(a) => setAlertaCompleteTarget(a)}
          onCreateAlertaFromCategoria={(ctx) => {
            setAlertaCreateContext({ proyecto_id: ctx.proyecto_id, empresa_id: ctx.empresa_id, defaultTexto: `Seguimiento categoría` });
          }}
          onSubmit={(data) => {
            updateProyecto.mutate({ ...data, id: editTarget.id }, { onSuccess: () => setEditTarget(null) });
          }}
        />
      )}

      {/* Edit parent group dialog (ubicación + contactos apply to all rows) */}
      {editParentGroup && (
        <ProyectoFormDialog
          open={!!editParentGroup}
          onOpenChange={(val) => !val && setEditParentGroup(null)}
          mode="edit"
          initialData={editParentGroup[0]}
          groupItems={editParentGroup}
          isLoading={updateProyecto.isPending}
          isAdmin={isAdmin}
          alertas={(alertas || []).filter(a => editParentGroup.some(p => p.id === a.proyecto_id))}
          onCompleteAlerta={(a) => setAlertaCompleteTarget(a)}
          onSubmit={async (data) => {
            const sharedFields = {
              nombre: data.nombre, region: data.region, direccion: data.direccion, comuna: data.comuna,
              estado_obra: data.estado_obra, fecha_estado_obra: data.fecha_estado_obra,
              estado_amc: data.estado_amc, fecha_ingreso: data.fecha_ingreso, clasificacion_id: data.clasificacion_id,
              arq_nombre: data.arq_nombre, arq_contacto: data.arq_contacto, arq_mail: data.arq_mail, arq_telefono: data.arq_telefono,
              const_nombre: data.const_nombre, const_contacto: data.const_contacto, const_mail: data.const_mail, const_telefono: data.const_telefono,
              ito_nombre: data.ito_nombre, ito_contacto: data.ito_contacto, ito_mail: data.ito_mail, ito_telefono: data.ito_telefono,
              duenos_nombre: data.duenos_nombre, duenos_contacto: data.duenos_contacto, duenos_mail: data.duenos_mail, duenos_telefono: data.duenos_telefono,
            };

            const selectedEmpresaIds = new Set(data.empresa_links.map((l) => l.empresa_id));

            // Find projects that would be deleted (empresa deselected)
            const toDelete = editParentGroup.filter((p) => {
              const pe = p.proyecto_empresas?.[0];
              return pe && !selectedEmpresaIds.has(pe.empresa_id);
            });

            if (toDelete.length > 0) {
              setPendingParentSubmit({ data: { ...data, sharedFields }, toDelete });
              return;
            }

            await executeParentSubmit(data, sharedFields, editParentGroup, [], selectedEmpresaIds);
            setEditParentGroup(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(val) => !val && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.nombre}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteProyecto.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete group confirmation */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(val) => !val && setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto completo?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>{deleteGroupTarget?.[0]?.nombre}</strong> y todas sus {deleteGroupTarget?.length} sublíneas con sus alertas asociadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteGroupTarget) {
                  try {
                    for (const p of deleteGroupTarget) {
                      await deleteProyecto.mutateAsync(p.id);
                    }
                    toast.success(`Proyecto "${deleteGroupTarget[0].nombre}" eliminado completamente`);
                  } catch (e: any) {
                    toast.error("Error al eliminar: " + e.message);
                  }
                  setDeleteGroupTarget(null);
                }
              }}
            >
              Eliminar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete from parent edit */}
      <AlertDialog open={!!pendingParentSubmit} onOpenChange={(val) => !val && setPendingParentSubmit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sublíneas?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {pendingParentSubmit?.toDelete.length} sublínea(s) con empresas desvinculadas:
              <ul className="mt-2 list-disc pl-5">
                {pendingParentSubmit?.toDelete.map((p) => {
                  const empName = p.proyecto_empresas?.[0]?.empresas?.nombre || "Sin empresa";
                  return <li key={p.id}>{empName}</li>;
                })}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (pendingParentSubmit && editParentGroup) {
                  const { data, toDelete } = pendingParentSubmit;
                  const selectedEmpresaIds = new Set<string>(data.empresa_links.map((l: any) => l.empresa_id));
                  await executeParentSubmit(data, data.sharedFields, editParentGroup, toDelete, selectedEmpresaIds);
                  setPendingParentSubmit(null);
                  setEditParentGroup(null);
                }
              }}
            >
              Eliminar y guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline alert creation */}
      {alertaCreateContext && !alertaEditTarget && (
        <AlertaFormDialog
          open={!!alertaCreateContext}
          onClose={() => { setAlertaCreateContext(null); setPendingCompleteId(null); }}
          onSubmit={(data) => {
            if (pendingCompleteId) {
              toggleCompletada.mutate({ id: pendingCompleteId, completada: true });
              setPendingCompleteId(null);
            }
            createAlerta.mutate(data);
            setAlertaCreateContext(null);
          }}
          proyectos={(proyectos || []).map(p => ({ id: p.id, nombre: p.nombre, numero: p.numero }))}
          empresas={empresas || []}
          profiles={profiles}
          currentUserId={currentUserId}
          defaultProyectoId={alertaCreateContext.proyecto_id}
          defaultEmpresaId={alertaCreateContext.empresa_id || undefined}
          defaultTexto={alertaCreateContext.defaultTexto}
          parentAlertaId={alertaCreateContext.parentAlertaId}
          defaultClasificacionId={alertaCreateContext.defaultClasificacionId}
          defaultSubclasificacionId={alertaCreateContext.defaultSubclasificacionId}
          defaultCategoriaProyectoId={alertaCreateContext.defaultCategoriaProyectoId}
          defaultSubcategoriaProyectoId={alertaCreateContext.defaultSubcategoriaProyectoId}
        />
      )}

      {/* Edit alert dialog */}
      {alertaEditTarget && (
        <AlertaFormDialog
          open={!!alertaEditTarget}
          onClose={() => setAlertaEditTarget(null)}
          onSubmit={(data) => {
            if (data.id) {
              updateAlerta.mutate(data as any);
            }
            setAlertaEditTarget(null);
          }}
          editTarget={alertaEditTarget}
          proyectos={(proyectos || []).map(p => ({ id: p.id, nombre: p.nombre, numero: p.numero }))}
          empresas={empresas || []}
          profiles={profiles}
          currentUserId={currentUserId}
        />
      )}

      {/* Delete alert confirmation */}
      <AlertDialog open={!!alertaDeleteTarget} onOpenChange={(v) => !v && setAlertaDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar alerta?</AlertDialogTitle>
            <AlertDialogDescription>La alerta será movida a la papelera y podrá ser restaurada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (alertaDeleteTarget) deleteAlertaMutation.mutate(alertaDeleteTarget); setAlertaDeleteTarget(null); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete alert dialog */}
      <CompleteAlertaDialog
        alerta={alertaCompleteTarget}
        open={!!alertaCompleteTarget}
        onClose={() => setAlertaCompleteTarget(null)}
        mode={alertaCompleteTarget?.completada ? "uncomplete" : "complete"}
        categorias={categorias}
        onAdvanceCategoria={async (pId, eId, catId, subId) => {
          await supabase.from("proyecto_empresas").update({ categoria_id: catId, subcategoria_id: subId }).eq("proyecto_id", pId).eq("empresa_id", eId);
          qc.invalidateQueries({ queryKey: ["proyectos"] });
        }}
        onComplete={(id) => toggleCompletada.mutate({ id, completada: true })}
        onUncomplete={(id, newDate) => {
          toggleCompletada.mutate({ id, completada: false });
        }}
        onCompleteAndCreate={(a) => {
          setPendingCompleteId(a.id);
          const next = clasificacionesAlerta
            ? getNextClasificacion((a as any).clasificacion_alerta_id, (a as any).subclasificacion_alerta_id, clasificacionesAlerta)
            : { clasificacionId: "", subclasificacionId: "" };
          setAlertaCreateContext({ proyecto_id: a.proyecto_id, empresa_id: a.empresa_id || null, parentAlertaId: a.id, defaultClasificacionId: next.clasificacionId, defaultSubclasificacionId: next.subclasificacionId, defaultCategoriaProyectoId: (a as any).categoria_proyecto_id || undefined, defaultSubcategoriaProyectoId: (a as any).subcategoria_proyecto_id || undefined });
        }}
      />

      {/* View detail dialog */}
      <ProyectoDetailDialog viewTarget={viewTarget} onClose={() => setViewTarget(null)} />

      {/* Tree dialog */}
      <AlertaTreeDialog open={showTree} onClose={() => setShowTree(false)} rootAlertaId={treeRootId} />

      {/* Repositorio del proyecto */}
      <ProyectoRepositorioDialog
        projectId={repositorioTarget?.id ?? null}
        projectName={repositorioTarget?.name ?? ""}
        open={!!repositorioTarget}
        onOpenChange={(o) => !o && setRepositorioTarget(null)}
        canEdit={repositorioTarget?.empresaName ? false : (isAdmin || isUsuarioTipo1)}
        filterEmpresaName={repositorioTarget?.empresaName}
      />

      {/* Hitos Ejecución dialog */}
      <Dialog open={!!hitosTarget} onOpenChange={(o) => !o && setHitosTarget(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Hitos Ejecución — {hitosTarget?.proyectoNombre}
              {hitosTarget?.empresaName ? ` · ${hitosTarget.empresaName}` : ""}
            </DialogTitle>
          </DialogHeader>
          {hitosTarget && (
            <HitosEjecucionPanel
              proyectoEmpresaId={hitosTarget.proyectoEmpresaId}
              empresaName={hitosTarget.empresaName}
              defaultOpen
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

/* ── Estado AMC Popover with controlled close ── */
function EstadoAmcPopoverInline({ currentStatus, estadosAmc, onUpdate }: { currentStatus: string; estadosAmc: { id: string; nombre: string; color: string }[]; onUpdate: (estado: string) => void }) {
  const [open, setOpen] = useState(false);
  const matchedColor = estadosAmc.find(ea => ea.nombre === currentStatus)?.color;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={currentStatus} color={matchedColor} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-0.5">
          {estadosAmc.map((ea) => (
            <button
              key={ea.id}
              className={cn("w-full text-left px-3 py-1.5 rounded text-xs hover:bg-accent transition-colors", currentStatus === ea.nombre && "bg-accent font-semibold")}
              onClick={() => { onUpdate(ea.nombre); setOpen(false); }}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: ea.color }} />
              {ea.nombre}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Single project row ── */
const ProjectRow = memo(function ProjectRow({ p, displayNum, isEven, onView, onEdit, onDelete, onTemplate, onOpenChat, updateNotas, filterBotones, filterEmpresas = [], ventasMap, estadosAmc, onUpdateEstadoAmcPE }: {
  p: ProyectoWithEmpresas;
  displayNum: string;
  isEven: boolean;
  onView: (p: ProyectoWithEmpresas) => void;
  onEdit: (p: ProyectoWithEmpresas) => void;
  onDelete: (p: ProyectoWithEmpresas) => void;
  onTemplate: (p: ProyectoWithEmpresas) => void;
  onOpenChat: (projectId: string, projectName: string, empresaId?: string | null, empresaName?: string | null) => void;
  updateNotas: (data: { id: string; notas: string }) => void;
  filterBotones: string[];
  filterEmpresas?: string[];
  ventasMap?: Map<string, number>;
  estadosAmc?: { id: string; nombre: string; color: string }[];
  onUpdateEstadoAmcPE: (peId: string, estado: string) => void;
}) {
  const evenBg = isEven ? "bg-muted/40" : "";
  // For single-project rows: show Estatus summary in col 7, Estado AMC per empresa in col 8
  const pe0 = p.proyecto_empresas?.[0];
  return (
    <>
      <tr className={`hover:bg-secondary/30 transition-colors border-t-[3px] border-muted-foreground/30 ${evenBg}`}>
        <td className="px-5 py-3 text-muted-foreground">{displayNum}</td>
        <td className="px-5 py-3 font-medium text-card-foreground cursor-pointer hover:underline" onClick={() => onView(p)}>{p.nombre}</td>
        <td className="px-5 py-3"><ContactosColumn proyecto={p} /></td>
        <td className="px-5 py-3 text-muted-foreground text-xs">{(p as any).fecha_ingreso ? new Date((p as any).fecha_ingreso).toLocaleDateString("es-CL") : "—"}</td>
        <td className="px-5 py-3 text-muted-foreground">{p.comuna}</td>
        <td className="px-5 py-3 text-muted-foreground">{p.estado_obra}</td>
        <td className="px-5 py-3">
          {/* Estado (x Proyecto) — project-level estado_amc */}
          <StatusBadge status={p.estado_amc} color={(estadosAmc || []).find(ea => ea.nombre === p.estado_amc)?.color} />
        </td>
        <td className="px-5 py-3"><EmpresasCell proyectoEmpresas={p.proyecto_empresas} filterEmpresas={filterEmpresas} ventasMap={ventasMap} /></td>
        <td className="px-5 py-3">
          {/* Estado AMC per empresa */}
          {pe0 && (
            <EstadoAmcPopoverInline
              currentStatus={(pe0 as any).estado_amc || "Vigente"}
              estadosAmc={estadosAmc || []}
              onUpdate={(nuevo) => onUpdateEstadoAmcPE(pe0.id, nuevo)}
            />
          )}
        </td>
        <td className="px-5 py-3 text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir chat del proyecto" onClick={() => onOpenChat(p.id, p.nombre, null, null)}><MessageCircle className="w-3.5 h-3.5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Usar como plantilla" onClick={() => onTemplate(p)}><Copy className="w-3.5 h-3.5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </td>
      </tr>
      <tr className={evenBg}>
        <td className="px-5 pb-2 pt-0" colSpan={10}>
          <NotasCell proyecto={p} onSave={updateNotas} empresaId={p.proyecto_empresas?.[0]?.empresa_id || null} />
        </td>
      </tr>
      {p.estado_obra === "Obra/Ejecución" && pe0 && (
        <tr className={evenBg}>
          <td className="px-5 pb-2 pt-0" colSpan={10}>
            <HitosEjecucionPanel proyectoEmpresaId={pe0.id} empresaName={pe0.empresas?.nombre} />
          </td>
        </tr>
      )}
    </>
  );
});

ProjectRow.displayName = "ProjectRow";

/* ── Empresas cell component ── */
const EmpresasCell = memo(function EmpresasCell({ proyectoEmpresas, filterEmpresas = [], ventasMap }: { proyectoEmpresas: ProyectoWithEmpresas["proyecto_empresas"]; filterEmpresas?: string[]; ventasMap?: Map<string, number> }) {
  if (!proyectoEmpresas || proyectoEmpresas.length === 0) {
    return <span className="text-muted-foreground text-xs">Sin empresas</span>;
  }

  return (
    <div className="space-y-1">
      {proyectoEmpresas.filter((pe, i, arr) => pe.empresas && arr.findIndex(x => x.empresa_id === pe.empresa_id) === i && (filterEmpresas.length === 0 || filterEmpresas.includes(pe.empresa_id))).map((pe) => {
        const totalVentas = ventasMap?.get(pe.id) || 0;
        const sub = (pe as any).subcategorias_proyecto;
        const cat = (pe as any).categorias_proyecto;
        const statusColor = sub?.color || cat?.color || null;
        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
        const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;
        const fechaCat = (pe as any).fecha_categoria || null;

        return (
          <div key={pe.id} className="leading-tight">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                !isAdj && !statusColor ? "bg-secondary text-secondary-foreground" : ""
              }`}
              style={isAdj
                ? { backgroundColor: "#22c55e", color: "#000" }
                : statusColor
                  ? { backgroundColor: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}44` }
                  : undefined
              }
            >
              {statusColor && (
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />
              )}
              {pe.empresas.nombre.split(" ")[0]}
              {fechaCat && (
                <span className="text-[9px] opacity-75 ml-0.5">
                  {new Date(fechaCat + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                </span>
              )}
            </span>
            {statusName && (
              <span className="ml-1 text-[10px] text-muted-foreground">{statusName}</span>
            )}
            {totalVentas !== 0 && (
              <>
                <br />
                <span className="ml-0.5 text-[11px] font-medium text-card-foreground">{formatUF(totalVentas)}</span>
                <br />
                <span className="ml-0.5 text-[10px] text-muted-foreground">{formatCLP(ufToCLP(totalVentas))}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});

/* ── Group header empresas cell (name + category + monto) ── */
const GroupEmpresasCell = memo(function GroupEmpresasCell({ items, filterEmpresas = [], ventasMap }: { items: ProyectoWithEmpresas[]; filterEmpresas?: string[]; ventasMap?: Map<string, number> }) {
  const allEmpresasRaw = useMemo(() => items.flatMap((p) => p.proyecto_empresas || []), [items]);
  const allEmpresas = useMemo(() => {
    const seen = new Set<string>();
    return allEmpresasRaw.filter((pe) => {
      if (!pe.empresa_id || seen.has(pe.empresa_id)) return false;
      seen.add(pe.empresa_id);
      if (filterEmpresas.length > 0 && !filterEmpresas.includes(pe.empresa_id)) return false;
      return true;
    });
  }, [allEmpresasRaw, filterEmpresas]);

  // Aggregate ventas by empresa_id using the parent-level ventasMap
  const ventasByEmpresa = useMemo(() => {
    const map = new Map<string, number>();
    for (const pe of allEmpresasRaw) {
      const total = ventasMap?.get(pe.id) || 0;
      if (total !== 0) map.set(pe.empresa_id, (map.get(pe.empresa_id) || 0) + total);
    }
    return map;
  }, [allEmpresasRaw, ventasMap]);

  if (allEmpresas.length === 0) {
    return <span className="text-muted-foreground text-xs">Sin empresas</span>;
  }
  return (
    <div className="space-y-1">
      {allEmpresas.map((pe) => {
        if (!pe.empresas) return null;
        const sub = (pe as any).subcategorias_proyecto;
        const cat = (pe as any).categorias_proyecto;
        const statusColor = sub?.color || cat?.color || null;
        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
        const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;
        const fechaCat = (pe as any).fecha_categoria || null;
        const totalVentas = ventasByEmpresa.get(pe.empresa_id) || 0;
        return (
          <div key={pe.id} className="leading-tight">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                !isAdj && !statusColor ? "bg-secondary text-secondary-foreground" : ""
              }`}
              style={isAdj
                ? { backgroundColor: "#22c55e", color: "#000" }
                : statusColor
                  ? { backgroundColor: statusColor + "22", color: statusColor, border: `1px solid ${statusColor}44` }
                  : undefined
              }
            >
              {statusColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor }} />}
              {pe.empresas.nombre.split(" ")[0]}
              {statusName && <span className="text-[10px] opacity-80">· {statusName}</span>}
              {fechaCat && (
                <span className="text-[9px] opacity-75">
                  {new Date(fechaCat + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}
                </span>
              )}
            </span>
            {totalVentas !== 0 && (
              <span className="ml-1 text-[11px] font-medium text-card-foreground">
                {formatUF(totalVentas)} <span className="text-[10px] text-muted-foreground font-normal">≈ {formatCLP(ufToCLP(totalVentas))}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

/* ── Nota grupo cell (no char limit, only for parent row) ── */
function NotaGrupoCell({ proyecto, onSave, onCreateAlerta }: { proyecto: ProyectoWithEmpresas; onSave: (data: { id: string; nota_grupo: string }) => void; onCreateAlerta?: (texto: string) => void }) {
  const [value, setValue] = useState((proyecto as any).nota_grupo || "");
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue((proyecto as any).nota_grupo || "");
    }
  }, [(proyecto as any).nota_grupo]);

  const handleChange = (text: string) => {
    setValue(text);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave({ id: proyecto.id, nota_grupo: text });
      setSaved(true);
    }, 800);
  };

  return (
    <div className="relative">
      <textarea
        className="w-full min-h-[32px] resize-y rounded-md border border-border bg-card/50 px-2 py-1 text-xs text-card-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Nota del proyecto..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => { isFocusedRef.current = true; }}
        onBlur={() => { isFocusedRef.current = false; }}
      />
      <div className="flex items-center justify-between mt-0.5">
        {onCreateAlerta && value.trim() ? (
          <button
            className="text-[9px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
            onClick={(e) => { e.stopPropagation(); onCreateAlerta(value.trim().slice(0, 100)); }}
            title="Crear alerta a partir de esta nota"
          >
            <Bell className="w-2.5 h-2.5" /> Crear alerta
          </button>
        ) : <span />}
        <span className="text-[9px] text-muted-foreground">
          {value.length} chars{!saved && " · guardando..."}
        </span>
      </div>
    </div>
  );
}

/* ── Detail dialog component ── */
function ProyectoDetailDialog({ viewTarget, onClose }: { viewTarget: ProyectoWithEmpresas | null; onClose: () => void }) {
  const peIds = viewTarget?.proyecto_empresas?.map(pe => pe.id) || [];
  const { data: detailVentas } = useVentasByProyectoEmpresaIds(peIds);
  const ventasByPeDetail = new Map<string, number>();
  for (const pe of (viewTarget?.proyecto_empresas || [])) {
    const ppto = Number((pe as any).ganado_presupuesto) || 0;
    if (ppto !== 0) ventasByPeDetail.set(pe.id, ppto);
  }
  for (const v of detailVentas || []) {
    ventasByPeDetail.set(v.proyecto_empresa_id, (ventasByPeDetail.get(v.proyecto_empresa_id) || 0) + Number(v.monto_uf));
  }

  if (!viewTarget) return null;

  return (
    <Dialog open={!!viewTarget} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{viewTarget.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <div className="flex gap-3 flex-wrap">
            {viewTarget.proyecto_empresas?.map((pe) => (
              <div key={pe.id} className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{pe.empresas?.nombre?.split(" ")[0]}:</span>
                <StatusBadge status={(pe as any).estado_amc || "Vigente"} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Dirección</p>
              <p className="text-card-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                {viewTarget.direccion || "—"}, {viewTarget.comuna || "—"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Estado Obra</p>
              <p className="text-card-foreground">{viewTarget.estado_obra || "—"} {viewTarget.fecha_estado_obra ? `— ${new Date(viewTarget.fecha_estado_obra).toLocaleDateString("es-CL")}` : ""}</p>
            </div>
          </div>

          {/* Empresas vinculadas detail */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Empresas Vinculadas
            </p>
            <div className="space-y-2">
              {viewTarget.proyecto_empresas?.map((pe) => {
                if (!pe.empresas) return null;
                const sub = (pe as any).subcategorias_proyecto;
                const cat = (pe as any).categorias_proyecto;
                const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;
                const statusColor = sub?.color || cat?.color || null;
                const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
                
                return (
                  <div key={pe.id} className={`px-3 py-2 rounded-lg text-sm border ${isAdj ? "bg-success/10 border-success/30" : "bg-secondary/30 border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusColor && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColor }} />}
                        <span className={`font-medium ${isAdj ? "text-success" : "text-card-foreground"}`}>{pe.empresas.nombre}</span>
                      </div>
                      {statusName && <span className="text-[10px] font-semibold uppercase" style={{ color: statusColor || undefined }}>{statusName}</span>}
                    </div>
                    {(() => {
                      const totalVentas = ventasByPeDetail.get(pe.id) || 0;
                      return totalVentas !== 0 ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ventas: {formatUF(totalVentas)} <span className="ml-1">≈ {formatCLP(ufToCLP(totalVentas))}</span>
                        </p>
                      ) : null;
                    })()}
                  </div>
                );
              })}
              {(!viewTarget.proyecto_empresas || viewTarget.proyecto_empresas.length === 0) && (
                <span className="text-sm text-muted-foreground">Sin empresas vinculadas</span>
              )}
            </div>
          </div>

          {[
            { label: "Arquitectura", n: viewTarget.arq_nombre, c: viewTarget.arq_contacto, m: viewTarget.arq_mail, t: viewTarget.arq_telefono },
            { label: "Constructora", n: viewTarget.const_nombre, c: viewTarget.const_contacto, m: viewTarget.const_mail, t: viewTarget.const_telefono },
            { label: "ITO", n: viewTarget.ito_nombre, c: viewTarget.ito_contacto, m: viewTarget.ito_mail, t: viewTarget.ito_telefono },
            { label: "Dueños", n: viewTarget.duenos_nombre, c: viewTarget.duenos_contacto, m: viewTarget.duenos_mail, t: viewTarget.duenos_telefono },
          ].filter((s) => s.n).map(({ label, n, c, m, t }) => (
            <div key={label} className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Empresa:</span> <span className="text-card-foreground">{n}</span></div>
                <div><span className="text-muted-foreground">Contacto:</span> <span className="text-card-foreground">{c}</span></div>
                <div><span className="text-muted-foreground">Email:</span> <span className="text-card-foreground">{m}</span></div>
                <div><span className="text-muted-foreground">Teléfono:</span> <span className="text-card-foreground">{t}</span></div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Inline notas cell ── */
function NotasCell({ proyecto, onSave, onCreateAlerta, empresaId }: { proyecto: ProyectoWithEmpresas; onSave: (data: { id: string; notas: string }) => void; onCreateAlerta?: (texto: string) => void; empresaId?: string | null }) {
  const [value, setValue] = useState((proyecto as any).notas || "");
  const [saved, setSaved] = useState(true);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocusedRef = useRef(false);
  const addChecklistItem = useAddChecklistItem();

  useEffect(() => {
    if (!isFocusedRef.current) {
      setValue((proyecto as any).notas || "");
    }
  }, [(proyecto as any).notas]);

  const handleChange = (text: string) => {
    setValue(text);
    setSaved(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave({ id: proyecto.id, notas: text });
      setSaved(true);
    }, 800);
  };

  const isDatePrefixed = startsWithDate(value);

  const handleCreateChecklist = () => {
    if (!empresaId || !value.trim()) return;
    addChecklistItem.mutate(
      { empresa_id: empresaId, proyecto_id: proyecto.id, text: value.trim() },
      { onSuccess: () => { setValue(""); onSave({ id: proyecto.id, notas: "" }); } }
    );
  };

  return (
    <div className="relative">
      <textarea
        className="w-full min-h-[36px] resize-y rounded-md border border-border bg-card/50 px-2 py-1 text-xs text-card-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Notas..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => { setFocused(true); isFocusedRef.current = true; }}
        onBlur={() => { setFocused(false); isFocusedRef.current = false; }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;

          e.stopPropagation();

          if ((e.ctrlKey || e.metaKey) && isDatePrefixed && empresaId) {
            e.preventDefault();
            handleCreateChecklist();
          }
        }}
      />
      {focused && (
        <div className="flex items-center justify-between mt-0.5 gap-2">
          <div className="flex items-center gap-2">
            {onCreateAlerta && value.trim() && (
              <button
                className="text-[9px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCreateAlerta(value.trim().slice(0, 100)); }}
                title="Crear alerta a partir de esta nota"
              >
                <Bell className="w-2.5 h-2.5" /> Crear alerta
              </button>
            )}
            {empresaId && value.trim() && (
              <button
                className={cn(
                  "text-[9px] font-medium flex items-center gap-0.5",
                  isDatePrefixed ? "text-emerald-600 hover:text-emerald-700" : "text-blue-600 hover:text-blue-700"
                )}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleCreateChecklist(); }}
                title="Crear ítem de checklist"
              >
                <ListChecks className="w-2.5 h-2.5" /> {isDatePrefixed ? "↵ Checklist" : "Crear nota checklist"}
              </button>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground">
            {value.length} chars{!saved && " · guardando..."}
          </span>
        </div>
      )}
      
    </div>
  );
}
