import { useState, useEffect, useMemo, Fragment, useRef, useCallback, memo, useDeferredValue } from "react";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Loader2, MapPin, Building2, Copy, ChevronRight, Bell, X, Check, FolderKanban, TrendingUp, Filter, Trophy, Hammer, MousePointerClick, Folder, MessageCircle, ListChecks, ArrowLeft, UserCircle2, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { useProyectos, useCreateProyecto, useUpdateProyecto, useDeleteProyecto, useUpdateNotas, useUpdateNotaGrupo, ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { RESUME_PROYECTO_KEY, RESUME_PROYECTO_EVENT } from "@/components/proyectos/BackToProyectoFloat";
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
import { useHistorialEstatusByIds, useCreateHistorialEstatus, HistorialEstatusRow } from "@/hooks/useHistorialEstatus";
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
import HitosEjecucionPanel, { type HitosEjecucionPanelHandle } from "@/components/proyectos/HitosEjecucionPanel";
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

/* ── Búsqueda multi-campo configurable ──────────────────────────────────────
 * Cada entrada define un campo buscable. Admin puede activar/desactivar.
 * Se persiste en localStorage (LS_SEARCH_FIELDS_KEY).
 * Para agregar un nuevo campo basta con añadir una entrada aquí.
 * ────────────────────────────────────────────────────────────────────────── */
const LS_SEARCH_FIELDS_KEY = "amc_proyecto_search_fields";

interface SearchFieldDef {
  key: string;
  label: string;
  group: string;
  defaultOn: boolean;
  getValue: (p: ProyectoWithEmpresas) => string;
}

const SEARCH_FIELD_DEFS: SearchFieldDef[] = [
  // Datos básicos
  { key: "nombre",          label: "Nombre del proyecto",   group: "Proyecto",    defaultOn: true,  getValue: p => p.nombre || "" },
  { key: "direccion",       label: "Dirección",              group: "Proyecto",    defaultOn: true,  getValue: p => (p as any).direccion || "" },
  { key: "comuna",          label: "Comuna",                 group: "Proyecto",    defaultOn: true,  getValue: p => p.comuna || "" },
  { key: "region",          label: "Región",                 group: "Proyecto",    defaultOn: false, getValue: p => p.region || "" },
  // Clientes
  { key: "clientes",        label: "Clientes (nombres)",     group: "Clientes",    defaultOn: true,  getValue: p => (p.proyecto_clientes || []).map((pc: any) => pc.clientes?.nombre || "").filter(Boolean).join(" ") },
  // Contactos por categoría
  { key: "arq_contacto",   label: "Contacto Arquitectura",  group: "Contactos",  defaultOn: true,  getValue: p => (p as any).arq_contacto || "" },
  { key: "const_contacto", label: "Contacto Constructora",  group: "Contactos",  defaultOn: true,  getValue: p => (p as any).const_contacto || "" },
  { key: "ito_contacto",   label: "Contacto ITO",           group: "Contactos",  defaultOn: true,  getValue: p => (p as any).ito_contacto || "" },
  { key: "duenos_contacto",label: "Contacto Dueños",        group: "Contactos",  defaultOn: true,  getValue: p => (p as any).duenos_contacto || "" },
  // Firmas (desactivadas por defecto — muchos registros, ruido en búsqueda general)
  { key: "arq_nombre",     label: "Firma Arquitectura",     group: "Firmas",     defaultOn: false, getValue: p => (p as any).arq_nombre || "" },
  { key: "const_nombre",   label: "Firma Constructora",     group: "Firmas",     defaultOn: false, getValue: p => (p as any).const_nombre || "" },
  { key: "ito_nombre",     label: "Firma ITO",              group: "Firmas",     defaultOn: false, getValue: p => (p as any).ito_nombre || "" },
  { key: "duenos_nombre",  label: "Firma Dueños",           group: "Firmas",     defaultOn: false, getValue: p => (p as any).duenos_nombre || "" },
];

const DEFAULT_SEARCH_FIELD_KEYS = SEARCH_FIELD_DEFS.filter(f => f.defaultOn).map(f => f.key);

function loadSearchFieldKeys(): string[] {
  try {
    const raw = localStorage.getItem(LS_SEARCH_FIELDS_KEY);
    if (!raw) return DEFAULT_SEARCH_FIELD_KEYS;
    const parsed: string[] = JSON.parse(raw);
    const valid = parsed.filter(k => SEARCH_FIELD_DEFS.some(f => f.key === k));
    return valid.length > 0 ? valid : DEFAULT_SEARCH_FIELD_KEYS;
  } catch {
    return DEFAULT_SEARCH_FIELD_KEYS;
  }
}

/* ── Filtros en cascada (dependent dropdowns) ───────────────────────────────
 * Para cada filtro, calcula las opciones disponibles aplicando TODOS los
 * demás filtros activos al dataset completo. Así los dropdowns solo muestran
 * combinaciones válidas según lo que el usuario ya eligió.
 * ────────────────────────────────────────────────────────────────────────── */
interface CascadeCtx {
  searchLower: string;
  searchIndex: Map<string, string>;
  filterEstados: string[];
  filterEstadosObra: string[];
  filterEmpresas: string[];
  filterCategorias: string[];
  filterClasificaciones: string[];
  filterBotones: string[];
  filterCaptadores: string[];
  visibleNames: Set<string> | null | undefined;
  statusByPe: Map<string, any>;
}

/** Evalúa si `p` pasa TODOS los filtros activos excepto el indicado en `skip`. */
function matchAllExcept(p: ProyectoWithEmpresas, skip: string, ctx: CascadeCtx): boolean {
  const {
    searchLower, searchIndex,
    filterEstados, filterEstadosObra, filterEmpresas, filterCategorias,
    filterClasificaciones, filterBotones, filterCaptadores,
    visibleNames, statusByPe,
  } = ctx;

  if (skip !== "search" && searchLower) {
    if (!(searchIndex.get(p.id)?.includes(searchLower) ?? false)) return false;
  }
  if (skip !== "estados" && filterEstados.length > 0 && !filterEstados.includes(p.estado_amc)) return false;
  if (skip !== "estadoObra" && filterEstadosObra.length > 0 && !filterEstadosObra.includes(p.estado_obra)) return false;
  if (skip !== "empresa" && filterEmpresas.length > 0) {
    if (!(p.proyecto_empresas || []).some((pe: any) => filterEmpresas.includes(pe.empresa_id))) return false;
  }
  if (skip !== "categoria" && filterCategorias.length > 0) {
    if (!(p.proyecto_empresas || []).some((pe: any) => {
      const eff = statusByPe.get(pe.id);
      const catId = eff?.categoria?.id || pe.categoria_id || "";
      const subId = eff?.subcategoria?.id || pe.subcategoria_id || "";
      return filterCategorias.includes(catId) || filterCategorias.includes(subId);
    })) return false;
  }
  if (skip !== "clasificacion" && filterClasificaciones.length > 0 && !filterClasificaciones.includes(p.clasificacion_id || "")) return false;
  if (skip !== "boton" && filterBotones.length > 0) {
    if (!(p.proyecto_empresas || []).some((pe: any) => filterBotones.includes(pe.estado_amc || "Vigente"))) return false;
  }
  if (skip !== "captador" && filterCaptadores.length > 0) {
    if (!(visibleNames?.has(p.nombre.trim().toLowerCase()) ?? false)) return false;
  }
  return true;
}

export default function Proyectos() {
  const { data: proyectos, isLoading } = useProyectos();
  const { isAdmin, isUsuarioTipo1, isCaptador, captadorId, permissions, user, isSectionRestrictedToAssigned } = useAuth();
  const { data: captadoresConUsuarios } = useCaptadoresConUsuarios(isAdmin || isUsuarioTipo1 || isCaptador);
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
  // "Vigente" activo por defecto — la card KPI lo gestiona
  const [filterEstados, setFilterEstados] = useState<string[]>(["Vigente"]);
  const [filterEmpresas, setFilterEmpresas] = useState<string[]>([]);
  const [filterCategorias, setFilterCategorias] = useState<string[]>([]);
  const [filterEstadosObra, setFilterEstadosObra] = useState<string[]>([]);
  const [filterClasificaciones, setFilterClasificaciones] = useState<string[]>([]);
  const [filterBotones, setFilterBotones] = useState<string[]>([]);
  const [filterCaptadores, setFilterCaptadores] = useState<string[]>([]);
  // Apply captador's own filter once their ID loads (auth is async)
  useEffect(() => {
    if (captadorId && !isAdmin && !isUsuarioTipo1) setFilterCaptadores([captadorId]);
  }, [captadorId, isAdmin, isUsuarioTipo1]);

  // Campos habilitados en la búsqueda de texto libre (admin-configurable, persiste en localStorage)
  const [searchFieldKeys, setSearchFieldKeys] = useState<string[]>(loadSearchFieldKeys);
  const updateSearchFields = useCallback((keys: string[]) => {
    setSearchFieldKeys(keys);
    try { localStorage.setItem(LS_SEARCH_FIELDS_KEY, JSON.stringify(keys)); } catch {}
  }, []);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ProyectoWithEmpresas[] | null>(null);
  const [viewTarget, setViewTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [templateSource, setTemplateSource] = useState<ProyectoWithEmpresas | null>(null);
  const [editParentGroup, setEditParentGroup] = useState<ProyectoWithEmpresas[] | null>(null);
  const [pendingParentSubmit, setPendingParentSubmit] = useState<{ data: any; toDelete: ProyectoWithEmpresas[] } | null>(null);
  const [isSavingParent, setIsSavingParent] = useState(false);
  const [repositorioTarget, setRepositorioTarget] = useState<{ id: string; name: string; empresaName?: string } | null>(null);
  const [hitosTarget, setHitosTarget] = useState<{ proyectoEmpresaId: string; empresaName?: string | null; proyectoNombre: string } | null>(null);

  // Resume "Editar Proyecto" after navigating to /clientes to create a client.
  useEffect(() => {
    if (!proyectos || proyectos.length === 0) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(RESUME_PROYECTO_KEY); } catch { return; }
    if (!raw) return;
    try {
      const snap = JSON.parse(raw) as { proyectoId: string | null; groupIds: string[] | null; mode: "create" | "edit" };
      if (snap.groupIds && snap.groupIds.length > 0) {
        const group = proyectos.filter(p => snap.groupIds!.includes(p.id));
        if (group.length > 0) setEditParentGroup(group);
      } else if (snap.proyectoId) {
        const target = proyectos.find(p => p.id === snap.proyectoId);
        if (target) setEditTarget(target);
      }
      sessionStorage.removeItem(RESUME_PROYECTO_KEY);
      window.dispatchEvent(new Event(RESUME_PROYECTO_EVENT));
    } catch {
      try { sessionStorage.removeItem(RESUME_PROYECTO_KEY); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectos]);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [highlightProyectoId, setHighlightProyectoId] = useState<string | null>(null);
  const [alertaCreateContext, setAlertaCreateContext] = useState<{ proyecto_id: string; empresa_id: string | null; defaultTexto?: string; parentAlertaId?: string; defaultClasificacionId?: string; defaultSubclasificacionId?: string; defaultCategoriaProyectoId?: string; defaultSubcategoriaProyectoId?: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showBackToAlertas, setShowBackToAlertas] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Latch the back-to-clientes state in a ref the moment we land on this page.
  // location.state gets wiped when setSearchParams fires (e.g. clearing ?highlight=).
  const backToClientesRef = useRef<{ clienteId?: string; clienteNombre?: string } | null>(null);
  const [showBackToClientes, setShowBackToClientes] = useState(() => {
    const s = location.state as any;
    if (s?.from === "clientes") {
      backToClientesRef.current = { clienteId: s.clienteId, clienteNombre: s.clienteNombre };
      return true;
    }
    return false;
  });

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
    const activeDefs = SEARCH_FIELD_DEFS.filter(f => searchFieldKeys.includes(f.key));
    const index = new Map<string, string>();
    for (const p of proyectos || []) {
      index.set(p.id, activeDefs.map(f => f.getValue(p)).join(" ").toLowerCase());
    }
    return index;
  }, [proyectos, searchFieldKeys]);

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

  // Lift ventas + historial: single queries for all proyecto_empresa IDs.
  // Defined BEFORE `filtered` because filters/KPIs read from `statusByPe`.
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
  const { data: allHistorialData } = useHistorialEstatusByIds(allPeIds);
  const createHistorialMain = useCreateHistorialEstatus();

  /**
   * Latest historial entry per proyecto_empresa_id (sorted by fecha desc, then created_at desc).
   * Source of truth for the status badge in the listing.
   */
  const latestHistorialByPe = useMemo(() => {
    const map = new Map<string, HistorialEstatusRow>();
    for (const h of (allHistorialData || [])) {
      const existing = map.get(h.proyecto_empresa_id);
      if (!existing) { map.set(h.proyecto_empresa_id, h); continue; }
      const a = `${h.fecha}|${h.created_at}`;
      const b = `${existing.fecha}|${existing.created_at}`;
      if (a > b) map.set(h.proyecto_empresa_id, h);
    }
    return map;
  }, [allHistorialData]);

  /**
   * Effective status per proyecto_empresa_id, using the latest historial entry
   * as the source of truth (falling back to proyecto_empresas if no historial).
   */
  type EffectiveStatus = {
    categoria: { id: string; nombre: string; color: string; es_adjudicado: boolean } | null;
    subcategoria: { id: string; nombre: string; color: string; es_adjudicado: boolean } | null;
    fecha: string | null;
  };
  const statusByPe = useMemo(() => {
    const map = new Map<string, EffectiveStatus>();
    if (!proyectos) return map;
    const catById = new Map<string, { id: string; nombre: string; color: string; es_adjudicado: boolean }>();
    const subById = new Map<string, { id: string; nombre: string; color: string; es_adjudicado: boolean }>();
    for (const c of (categorias || [])) {
      catById.set(c.id, { id: c.id, nombre: c.nombre, color: c.color, es_adjudicado: c.es_adjudicado });
      for (const s of (c.subcategorias_proyecto || [])) {
        subById.set(s.id, { id: s.id, nombre: s.nombre, color: s.color, es_adjudicado: s.es_adjudicado });
      }
    }
    for (const p of proyectos) {
      for (const pe of (p.proyecto_empresas || [])) {
        const latest = latestHistorialByPe.get(pe.id);
        let categoria: EffectiveStatus["categoria"] = null;
        let subcategoria: EffectiveStatus["subcategoria"] = null;
        let fecha: string | null = null;
        if (latest) {
          if (latest.subcategoria_id) subcategoria = subById.get(latest.subcategoria_id) || null;
          if (latest.categoria_id) categoria = catById.get(latest.categoria_id) || null;
          fecha = latest.fecha || null;
        } else {
          const cat = (pe as any).categorias_proyecto;
          const sub = (pe as any).subcategorias_proyecto;
          if (cat) categoria = { id: cat.id, nombre: cat.nombre, color: cat.color, es_adjudicado: cat.es_adjudicado };
          if (sub) subcategoria = { id: sub.id, nombre: sub.nombre, color: sub.color, es_adjudicado: sub.es_adjudicado };
          fecha = (pe as any).fecha_categoria || null;
        }
        map.set(pe.id, { categoria, subcategoria, fecha });
      }
    }
    return map;
  }, [proyectos, categorias, latestHistorialByPe]);

  // Pre-compute visible project names for captador filter.
  // A project is visible if ANY of its rows passes the captador check.
  // Then ALL rows of that project are included (not just the matching one).
  const visibleProyectoNamesByCaptador = useMemo(() => {
    if (filterCaptadores.length === 0) return null; // no filter active
    const visible = new Set<string>();
    for (const p of (proyectos || [])) {
      // System 1: proyecto_captadores (legacy)
      const hasLegacy = (p.proyecto_captadores || []).some((pc: any) => filterCaptadores.includes(pc.captador_id));
      if (hasLegacy) { visible.add(p.nombre.trim().toLowerCase()); continue; }
      // System 2: captador has empresa of this project in empresas_visibles
      const empresaIds = (p.proyecto_empresas || []).map(pe => pe.empresa_id);
      for (const cid of filterCaptadores) {
        const cap = captadoresConUsuarios?.find(c => c.captadorId === cid);
        if (cap?.empresasVisibles && empresaIds.some(eid => cap.empresasVisibles!.includes(eid))) {
          visible.add(p.nombre.trim().toLowerCase());
          break;
        }
      }
    }
    return visible;
  }, [proyectos, filterCaptadores, captadoresConUsuarios]);

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
      p.proyecto_empresas?.some((pe) => {
        const eff = statusByPe.get(pe.id);
        const catId = eff?.categoria?.id || pe.categoria_id || "";
        const subId = eff?.subcategoria?.id || pe.subcategoria_id || "";
        return filterCategorias.includes(catId) || filterCategorias.includes(subId);
      });
    const matchClasificacion =
      filterClasificaciones.length === 0 || filterClasificaciones.includes(p.clasificacion_id || "");
    const matchBoton = filterBotones.length === 0 || p.proyecto_empresas?.some((pe) => {
      return filterBotones.includes((pe as any).estado_amc || "Vigente");
    });
    // matchCaptador: uses pre-computed set — all rows of a visible project pass together
    const matchCaptador = filterCaptadores.length === 0 ||
      (visibleProyectoNamesByCaptador?.has(p.nombre.trim().toLowerCase()) ?? false);
    return matchSearch && matchEstado && matchEstadoObra && matchEmpresa && matchCategoria && matchClasificacion && matchBoton && matchCaptador;
  }), [proyectos, deferredSearch, projectSearchIndex, filterEstados, filterEstadosObra, filterEmpresas, filterCategorias, filterClasificaciones, filterBotones, filterCaptadores, visibleProyectoNamesByCaptador, buttonLabelsByLink, statusByPe]);

  // ── Contexto para filtros en cascada ──────────────────────────────────────
  const cascadeCtx = useMemo((): CascadeCtx => ({
    searchLower: deferredSearch.trim().toLowerCase(),
    searchIndex: projectSearchIndex, filterEstados, filterEstadosObra,
    filterEmpresas, filterCategorias, filterClasificaciones, filterBotones,
    filterCaptadores, visibleNames: visibleProyectoNamesByCaptador, statusByPe,
  }), [deferredSearch, projectSearchIndex, filterEstados, filterEstadosObra,
      filterEmpresas, filterCategorias, filterClasificaciones, filterBotones,
      filterCaptadores, visibleProyectoNamesByCaptador, statusByPe]);

  // Opciones disponibles para cada filtro (solo las que existen dado el resto de filtros activos)
  // Incluye siempre los valores ya seleccionados para que el usuario pueda deseleccionarlos.
  const availableEstadosSet = useMemo(() => {
    const set = new Set(filterEstados);
    (proyectos || []).forEach(p => { if (matchAllExcept(p, "estados", cascadeCtx) && p.estado_amc) set.add(p.estado_amc); });
    return set;
  }, [proyectos, cascadeCtx, filterEstados]);

  const availableEstadosObraSet = useMemo(() => {
    const set = new Set(filterEstadosObra);
    (proyectos || []).forEach(p => { if (matchAllExcept(p, "estadoObra", cascadeCtx) && p.estado_obra) set.add(p.estado_obra); });
    return set;
  }, [proyectos, cascadeCtx, filterEstadosObra]);

  const availableEmpresasSet = useMemo(() => {
    const set = new Set(filterEmpresas);
    (proyectos || []).forEach(p => {
      if (matchAllExcept(p, "empresa", cascadeCtx)) {
        (p.proyecto_empresas || []).forEach((pe: any) => set.add(pe.empresa_id));
      }
    });
    return set;
  }, [proyectos, cascadeCtx, filterEmpresas]);

  const availableClasificacionesSet = useMemo(() => {
    const set = new Set(filterClasificaciones);
    (proyectos || []).forEach(p => { if (matchAllExcept(p, "clasificacion", cascadeCtx) && p.clasificacion_id) set.add(p.clasificacion_id); });
    return set;
  }, [proyectos, cascadeCtx, filterClasificaciones]);

  const availableBotonSet = useMemo(() => {
    const set = new Set(filterBotones);
    (proyectos || []).forEach(p => {
      if (matchAllExcept(p, "boton", cascadeCtx)) {
        (p.proyecto_empresas || []).forEach((pe: any) => set.add(pe.estado_amc || "Vigente"));
      }
    });
    return set;
  }, [proyectos, cascadeCtx, filterBotones]);

  const availableCategoriasSet = useMemo(() => {
    const set = new Set(filterCategorias);
    (proyectos || []).forEach(p => {
      if (matchAllExcept(p, "categoria", cascadeCtx)) {
        (p.proyecto_empresas || []).forEach((pe: any) => {
          const eff = statusByPe.get(pe.id);
          const catId = eff?.categoria?.id || pe.categoria_id;
          const subId = eff?.subcategoria?.id || pe.subcategoria_id;
          if (catId) set.add(catId);
          if (subId) set.add(subId);
        });
      }
    });
    return set;
  }, [proyectos, cascadeCtx, filterCategorias, statusByPe]);

  // Full (unfiltered) group sizes — used to keep parent-line rendering even when filter reduces items to 1
  const fullGroupSizes = useMemo(() => {
    const sizes: Record<string, number> = {};
    (proyectos || []).forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      sizes[key] = (sizes[key] || 0) + 1;
    });
    return sizes;
  }, [proyectos]);

  const allGroupsByKey = useMemo(() => {
    const groups = new Map<string, ProyectoWithEmpresas[]>();
    (proyectos || []).forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      groups.set(key, [...(groups.get(key) || []), p]);
    });
    return groups;
  }, [proyectos]);

  // captadorEmpresaIds kept as null (no longer used for project filtering)
  // Captador visibility is now handled via filterCaptadores pre-set to their own captadorId
  const captadorEmpresaIds = null;

  const groupedRows = useMemo(() => {
    const groups: Record<string, ProyectoWithEmpresas[]> = {};
    filtered.forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    const seen = new Set<string>();
    const result: { key: string; items: ProyectoWithEmpresas[] }[] = [];
    filtered.forEach((p) => {
      const key = p.nombre.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const items = groups[key];
        // Apply empresa filter for captadores / restricted users
        if (captadorEmpresaIds === "none") return; // no permissions record → hide all
        if (captadorEmpresaIds instanceof Set) {
          const hasVisibleEmpresa = items.some(row =>
            (row.proyecto_empresas || []).some(pe => (captadorEmpresaIds as Set<string>).has(pe.empresa_id))
          );
          if (!hasVisibleEmpresa) return;
        }
        result.push({ key, items });
      }
    });
    return result;
  }, [filtered, captadorEmpresaIds]);

  // Gran Total per proyecto_empresa — fuente única alineada al formulario:
  //   ganado_presupuesto (monto adjudicado vigente) + Σ ventas_proyecto_empresa (adicionales)
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
    let vigentes = 0;
    let ganados = 0;
    let obrasEjecucion = 0;
    const OBRAS_LABEL = "Obra/Ejecución";
    Object.values(groupsAll).forEach(g => {
      if (g.some(p => p.adjudicado)) adjudicados++;
      // Vigentes: estado_amc a nivel proyecto = "Vigente"
      if (g.some(p => p.estado_amc === "Vigente")) vigentes++;
      if (g.some(p => p.proyecto_empresas?.some(pe => {
        const eff = statusByPe.get(pe.id);
        return (eff?.subcategoria?.id || pe.subcategoria_id) === GANADO_SUBCATEGORIA_ID;
      }))) ganados++;
      if (g.some(p => p.proyecto_empresas?.some(pe => {
        return ((pe as any).estado_amc || "Vigente") === OBRAS_LABEL;
      }))) obrasEjecucion++;
    });
    const filteredGroups = groupedRows.length;
    const hasActiveFilters = !!(search || filterEstados.length || filterEmpresas.length || filterCategorias.length || filterEstadosObra.length || filterClasificaciones.length || filterBotones.length);
    return { totalProyectos, adjudicados, vigentes, ganados, obrasEjecucion, filteredGroups, hasActiveFilters };
  }, [proyectos, categorias, groupedRows, search, filterEstados, filterEmpresas, filterCategorias, filterEstadosObra, filterClasificaciones, filterBotones, statusByPe]);

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
    // Batch parent-group save: perform all DB writes directly so we only
    // show ONE success toast and trigger ONE cache invalidation at the end.
    // Avoids the "loop"/multi-toast effect and the race condition where
    // concurrent invalidations during a sequential mutation chain leave
    // the projects list cache stale.
    const existingMap = new Map<string, ProyectoWithEmpresas>();
    for (const p of group) {
      for (const pe of (p.proyecto_empresas || [])) {
        existingMap.set(pe.empresa_id, p);
      }
    }

    try {
      // 1) Build all parallel operations for existing rows
      const ops: PromiseLike<any>[] = [];
      const peUpserts: any[] = [];
      const idsToDelete: string[] = [];

      for (const p of group) {
        const pe = p.proyecto_empresas?.[0];
        if (!pe) {
          ops.push(
            supabase
              .from("proyectos")
              .update({
                ...sharedFields,
                notas: p.notas || "",
                monto_estimado: null,
                adjudicado: !!p.adjudicado,
              } as any)
              .eq("id", p.id)
              .then(({ error }) => { if (error) throw error; })
          );
        } else if (selectedEmpresaIds.has(pe.empresa_id)) {
          const link = data.empresa_links.find((l: any) => l.empresa_id === pe.empresa_id);
          if (!link) continue;
          ops.push(
            supabase
              .from("proyectos")
              .update({
                ...sharedFields,
                notas: p.notas || "",
                monto_estimado: null,
                adjudicado: !!link.adjudicado,
              } as any)
              .eq("id", p.id)
              .then(({ error }) => { if (error) throw error; })
          );
          peUpserts.push({
            proyecto_id: p.id,
            empresa_id: link.empresa_id,
            monto_cotizacion: link.monto_cotizacion || 0,
            adjudicado: !!link.adjudicado,
            categoria_id: link.categoria_id || null,
            subcategoria_id: link.subcategoria_id || null,
            fecha_categoria: link.fecha_categoria || null,
            ganado_presupuesto: link.ganado_presupuesto || null,
            ganado_op: link.ganado_op || null,
            ganado_fecha: link.ganado_fecha || null,
          });
        } else if (toDelete.some((d) => d.id === p.id)) {
          idsToDelete.push(p.id);
        }
      }

      if (peUpserts.length > 0) {
        ops.push(
          supabase
            .from("proyecto_empresas")
            .upsert(peUpserts, { onConflict: "proyecto_id,empresa_id" })
            .then(({ error }) => { if (error) throw error; })
        );
      }
      if (idsToDelete.length > 0) {
        ops.push(
          supabase.from("proyectos").delete().in("id", idsToDelete)
            .then(({ error }) => { if (error) throw error; })
        );
      }

      // 2) Create new rows for newly added empresas (must wait for insert id, so chain after)
      const newLinks = data.empresa_links.filter((l: any) => !existingMap.has(l.empresa_id));
      const newRowsPromise = (async () => {
        if (newLinks.length === 0) return;
        const projectsToInsert = newLinks.map((link: any) => ({
          ...sharedFields,
          notas: "",
          monto_estimado: null,
          adjudicado: !!link.adjudicado,
        }));
        const { data: created, error: insErr } = await supabase
          .from("proyectos")
          .insert(projectsToInsert as any[])
          .select();
        if (insErr) throw insErr;
        const peRows = (created || []).map((p: any, i: number) => ({
          proyecto_id: p.id,
          empresa_id: newLinks[i].empresa_id,
          monto_cotizacion: newLinks[i].monto_cotizacion || 0,
          adjudicado: !!newLinks[i].adjudicado,
          categoria_id: newLinks[i].categoria_id || null,
          subcategoria_id: newLinks[i].subcategoria_id || null,
          fecha_categoria: newLinks[i].fecha_categoria || null,
          ganado_presupuesto: newLinks[i].ganado_presupuesto || null,
          ganado_op: newLinks[i].ganado_op || null,
          ganado_fecha: newLinks[i].ganado_fecha || null,
        }));
        if (peRows.length > 0) {
          const { error: peInsErr } = await supabase.from("proyecto_empresas").insert(peRows);
          if (peInsErr) throw peInsErr;
        }
      })();

      await Promise.all([...ops, newRowsPromise]);

      toast.success("Proyecto actualizado");

      // Optimistically patch the list cache so the UI updates instantly,
      // then revalidate in the background.
      const groupIds = new Set(group.map((p) => p.id));
      const sharedPatch: any = { ...sharedFields };
      qcMain.setQueriesData({ queryKey: ["proyectos"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => {
          if (!groupIds.has(p.id)) return p;
          const pe = p.proyecto_empresas?.[0];
          const link = pe ? data.empresa_links.find((l: any) => l.empresa_id === pe.empresa_id) : null;
          const newPe = pe && link ? [{
            ...pe,
            monto_cotizacion: link.monto_cotizacion || 0,
            adjudicado: !!link.adjudicado,
            categoria_id: link.categoria_id || null,
            subcategoria_id: link.subcategoria_id || null,
            fecha_categoria: link.fecha_categoria || null,
            ganado_presupuesto: link.ganado_presupuesto || null,
            ganado_op: link.ganado_op || null,
            ganado_fecha: link.ganado_fecha || null,
          }] : p.proyecto_empresas;
          return {
            ...p,
            ...sharedPatch,
            adjudicado: link ? !!link.adjudicado : p.adjudicado,
            proyecto_empresas: newPe,
          };
        });
      });
      qcMain.invalidateQueries({ queryKey: ["proyectos"] });
    } catch (e: any) {
      toast.error("Error al actualizar: " + (e?.message || "desconocido"));
      throw e;
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
    {showBackToClientes && (
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="fixed top-4 right-4 z-[9999] flex items-center gap-1 bg-card border border-border shadow-xl rounded-full pl-1 pr-2 py-1"
      >
        <button
          onClick={() => navigate("/clientes", {
            state: { openClienteId: backToClientesRef.current?.clienteId },
          })}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors rounded-full hover:bg-accent"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Clientes{backToClientesRef.current?.clienteNombre ? ` · ${backToClientesRef.current.clienteNombre}` : ""}
        </button>
        <button
          onClick={() => setShowBackToClientes(false)}
          className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    )}
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
        {/* Búsqueda + config de campos */}
        <div className="flex flex-1 max-w-sm gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <DebouncedInput value={search} onChange={setSearch} placeholder="Buscar..." className="pl-9" />
          </div>
          {/* Configuración de campos de búsqueda — solo para admins */}
          {isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline" size="icon" className="h-9 w-9 shrink-0"
                  title={`Campos de búsqueda activos: ${searchFieldKeys.length} de ${SEARCH_FIELD_DEFS.length}`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Campos de búsqueda</p>
                <p className="text-[11px] text-muted-foreground mb-3">La búsqueda se ejecuta sobre todos los campos activos simultáneamente.</p>
                {/* Agrupar por grupo */}
                {Array.from(new Set(SEARCH_FIELD_DEFS.map(f => f.group))).map(group => (
                  <div key={group} className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 px-2 mb-1">{group}</p>
                    {SEARCH_FIELD_DEFS.filter(f => f.group === group).map(def => (
                      <label key={def.key} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer text-sm">
                        <Checkbox
                          checked={searchFieldKeys.includes(def.key)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...searchFieldKeys, def.key]
                              : searchFieldKeys.filter(k => k !== def.key);
                            updateSearchFields(next.length > 0 ? next : [def.key]); // al menos 1 campo activo
                          }}
                        />
                        {def.label}
                        {def.defaultOn && <span className="ml-auto text-[10px] text-muted-foreground/60">predeterminado</span>}
                      </label>
                    ))}
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={() => updateSearchFields(DEFAULT_SEARCH_FIELD_KEYS)}>
                  Restaurar predeterminados
                </Button>
              </PopoverContent>
            </Popover>
          )}
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
                {(estadosProyecto || []).filter(ep => availableEstadosSet.has(ep.nombre)).map((ep) => (
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
                {clasificaciones?.filter(c => availableClasificacionesSet.has(c.id)).map((c) => (
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
                {ESTADOS_OBRA.filter(e => e !== "Todos" && availableEstadosObraSet.has(e)).map((estado) => (
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
                {empresas?.filter(e => availableEmpresasSet.has(e.id)).map((e) => (
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

          {/* 4b. Captador — interactivo para admin/asistente, badge bloqueado para captador */}
          {(isAdmin || isUsuarioTipo1) && (
            <CaptadorFilterPopover value={filterCaptadores} onToggle={(id) => toggleFilter(setFilterCaptadores, id)} onClear={() => setFilterCaptadores([])} />
          )}
          {isCaptador && captadorId && (
            <CaptadorFilterBadge captadorId={captadorId} />
          )}

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
                  {estadosAmc.filter(ea => availableBotonSet.has(ea.nombre)).map((ea) => (
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
                {categorias?.map((cat) => {
                  const catAvail = availableCategoriasSet.has(cat.id);
                  const subItems = (cat.subcategorias_proyecto || []).filter(sub => availableCategoriasSet.has(sub.id));
                  if (!catAvail && subItems.length === 0) return null;
                  return (
                    <Fragment key={cat.id}>
                      {catAvail && (
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                          <Checkbox checked={filterCategorias.includes(cat.id)} onCheckedChange={() => toggleFilter(setFilterCategorias, cat.id)} />
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.nombre}
                        </label>
                      )}
                      {subItems.map((sub) => (
                        <label key={sub.id} className="flex items-center gap-2 px-2 py-1.5 pl-6 rounded hover:bg-accent cursor-pointer text-sm">
                          <Checkbox checked={filterCategorias.includes(sub.id)} onCheckedChange={() => toggleFilter(setFilterCategorias, sub.id)} />
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                          {sub.nombre}
                        </label>
                      ))}
                    </Fragment>
                  );
                })}
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
                // Don't clear captador filter for captadores (it's locked to their own id)
                if (!isCaptador) setFilterCaptadores([]);
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
        {/* Card Vigentes — actúa como filtro rápido via Estado (x Proyecto) */}
        <KpiCard
          title="Vigentes"
          value={String(kpiStats.vigentes)}
          subtitle="Estado: Vigente"
          icon={Check}
          variant="success"
          delay={0.10}
          active={filterEstados.includes("Vigente")}
          onClick={() => {
            const isActive = filterEstados.includes("Vigente");
            if (isActive) {
              // Desactivar: quitar "Vigente" del filtro
              setFilterEstados(prev => prev.filter(e => e !== "Vigente"));
            } else {
              // Activar: establecer solo "Vigente" y limpiar otros filtros para coherencia
              setFilterEstados(["Vigente"]);
              setFilterEmpresas([]);
              setFilterCategorias([]);
              setFilterEstadosObra([]);
              setFilterClasificaciones([]);
              setFilterBotones([]);
              setSearch("");
            }
          }}
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
                  // Captadores can't edit/delete rows
                  if (isCaptador) {
                    // Captadores see all empresas of the project row (no empresa filter)
                    return <ProjectRow key={p.id} p={p} displayNum={String(parentNum)} isEven={isEven} onView={setViewTarget} onEdit={() => {}} onDelete={() => {}} onTemplate={() => {}} onOpenChat={openProjectChat} updateNotas={() => {}} filterBotones={filterBotones} filterEmpresas={[]} ventasMap={ventasMap} statusByPe={statusByPe} estadosAmc={estadosAmc} onUpdateEstadoAmcPE={() => {}} />;
                  }
                  return <ProjectRow key={p.id} p={p} displayNum={String(parentNum)} isEven={isEven} onView={setViewTarget} onEdit={setEditTarget} onDelete={setDeleteTarget} onTemplate={setTemplateSource} onOpenChat={openProjectChat} updateNotas={updateNotas.mutate} filterBotones={filterBotones} filterEmpresas={filterEmpresas} ventasMap={ventasMap} statusByPe={statusByPe} estadosAmc={estadosAmc} onUpdateEstadoAmcPE={handleUpdateEstadoAmcPE} />;
                }

                // Grouped header
                const first = items[0];
                const actionItems = allGroupsByKey.get(key) || items;
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
                        <GroupEmpresasCell items={items} filterEmpresas={filterEmpresas} ventasMap={ventasMap} statusByPe={statusByPe} />
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
                          {isAdmin && (
                            <span onClick={(e) => e.stopPropagation()}>
                              <CaptadorProjectCell
                                items={items}
                                captadoresConUsuarios={captadoresConUsuarios || []}
                              />
                            </span>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar línea madre" onClick={(e) => { e.stopPropagation(); setEditParentGroup(actionItems); }}>
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" title="Eliminar grupo" onClick={(e) => { e.stopPropagation(); setDeleteGroupTarget(actionItems); }}>
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
                              // Captadores: only show the specific empresas assigned to them
                              if (isCaptador && captadorId) {
                                const inNew = (p.proyecto_captadores || []).some((pc: any) => pc.captador_id === captadorId);
                                const inLegacy = Array.isArray(permissions?.empresas_visibles) && (permissions!.empresas_visibles as string[]).includes(pe.empresa_id);
                                if (!inNew && !inLegacy) continue;
                              }
                              // Non-captadores: apply empresa filter if active
                              if (!isCaptador && filterEmpresas.length > 0 && !filterEmpresas.includes(pe.empresa_id)) continue;
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
                                <td className="px-5 py-2 align-top">
                                  <EmpresasCell proyectoEmpresas={[pe]} ventasMap={ventasMap} statusByPe={statusByPe} />
                                </td>
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
                                        className="inline-flex items-center justify-center gap-1 px-4 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors min-w-[96px]"
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
                                    {!isCaptador && <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="w-3.5 h-3.5" /></Button>}
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
        onSubmit={async (data) => {
          createProyecto.mutate(data, {
            onSuccess: async (created: any) => {
              // Auto-link captador creator to every newly created project row,
              // and merge empresas into their empresas_visibles permission.
              if (isCaptador && captadorId && user?.id && data.empresa_links.length > 0) {
                const createdProjects = Array.isArray(created) ? created : (created ? [created] : []);
                if (createdProjects.length > 0) {
                  await supabase.from("proyecto_captadores").insert(
                    createdProjects.map((p: any) => ({ proyecto_id: p.id, captador_id: captadorId }))
                  );
                }
                const newEmpresaIds = data.empresa_links.map(l => l.empresa_id);
                const { data: perms } = await supabase
                  .from("user_permissions")
                  .select("empresas_visibles")
                  .eq("user_id", user.id)
                  .maybeSingle();
                const current: string[] = Array.isArray((perms as any)?.empresas_visibles) ? (perms as any).empresas_visibles : [];
                const merged = Array.from(new Set([...current, ...newEmpresaIds]));
                await supabase.from("user_permissions").upsert(
                  { user_id: user.id, empresas_visibles: merged },
                  { onConflict: "user_id" }
                );
              }
              await qcMain.invalidateQueries({ queryKey: ["proyectos"] });
              setShowCreate(false);
            },
          });
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
          isLoading={isSavingParent}
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

            if (isSavingParent) return;
            setIsSavingParent(true);
            try {
              await executeParentSubmit(data, sharedFields, editParentGroup, [], selectedEmpresaIds);
              setEditParentGroup(null);
            } finally {
              setIsSavingParent(false);
            }
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
                  if (isSavingParent) return;
                  setIsSavingParent(true);
                  try {
                    await executeParentSubmit(data, data.sharedFields, editParentGroup, toDelete, selectedEmpresaIds);
                    setPendingParentSubmit(null);
                    setEditParentGroup(null);
                  } finally {
                    setIsSavingParent(false);
                  }
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
          // Sync historial so the badge reflects the change (historial is the source of truth)
          const { data: peRow } = await supabase
            .from("proyecto_empresas")
            .select("id, ganado_presupuesto")
            .eq("proyecto_id", pId)
            .eq("empresa_id", eId)
            .maybeSingle();
          if (peRow?.id) {
            try {
              await createHistorialMain.mutateAsync({
                proyecto_empresa_id: peRow.id,
                categoria_id: catId,
                subcategoria_id: subId,
                monto_uf: Number(peRow.ganado_presupuesto || 0),
                fecha: new Date().toISOString().slice(0, 10),
              });
            } catch { /* historial creation is best-effort */ }
          }
          qc.invalidateQueries({ queryKey: ["proyectos"] });
          qc.invalidateQueries({ queryKey: ["historial_estatus_empresa"] });
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
      <HitosEjecucionDialog target={hitosTarget} onClose={() => setHitosTarget(null)} />
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
const ProjectRow = memo(function ProjectRow({ p, displayNum, isEven, onView, onEdit, onDelete, onTemplate, onOpenChat, updateNotas, filterBotones, filterEmpresas = [], ventasMap, statusByPe, estadosAmc, onUpdateEstadoAmcPE }: {
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
  statusByPe?: Map<string, any>;
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
        <td className="px-5 py-3"><EmpresasCell proyectoEmpresas={p.proyecto_empresas} filterEmpresas={filterEmpresas} ventasMap={ventasMap} statusByPe={statusByPe} /></td>
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
const EmpresasCell = memo(function EmpresasCell({ proyectoEmpresas, filterEmpresas = [], ventasMap, statusByPe }: { proyectoEmpresas: ProyectoWithEmpresas["proyecto_empresas"]; filterEmpresas?: string[]; ventasMap?: Map<string, number>; statusByPe?: Map<string, any> }) {
  if (!proyectoEmpresas || proyectoEmpresas.length === 0) {
    return <span className="text-muted-foreground text-xs">Sin empresas</span>;
  }

  return (
    <div className="space-y-1">
      {proyectoEmpresas.filter((pe, i, arr) => pe.empresas && arr.findIndex(x => x.empresa_id === pe.empresa_id) === i && (filterEmpresas.length === 0 || filterEmpresas.includes(pe.empresa_id))).map((pe) => {
        const totalVentas = ventasMap?.get(pe.id) || 0;
        const eff = statusByPe?.get(pe.id);
        const sub = eff?.subcategoria || (pe as any).subcategorias_proyecto;
        const cat = eff?.categoria || (pe as any).categorias_proyecto;
        const statusColor = sub?.color || cat?.color || null;
        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
        const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;
        const fechaCat = eff ? eff.fecha : ((pe as any).fecha_categoria || null);

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
const GroupEmpresasCell = memo(function GroupEmpresasCell({ items, filterEmpresas = [], ventasMap, statusByPe }: { items: ProyectoWithEmpresas[]; filterEmpresas?: string[]; ventasMap?: Map<string, number>; statusByPe?: Map<string, any> }) {
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
        const eff = statusByPe?.get(pe.id);
        const sub = eff?.subcategoria || (pe as any).subcategorias_proyecto;
        const cat = eff?.categoria || (pe as any).categorias_proyecto;
        const statusColor = sub?.color || cat?.color || null;
        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
        const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;
        const fechaCat = eff ? eff.fecha : ((pe as any).fecha_categoria || null);
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

/* ── Hitos Ejecución Dialog with draft save / discard confirmation ── */
function HitosEjecucionDialog({
  target,
  onClose,
}: {
  target: { proyectoEmpresaId: string; empresaName?: string | null; proyectoNombre: string } | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HitosEjecucionPanelHandle | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAttemptClose = (open: boolean) => {
    if (open) return;
    if (panelRef.current?.isDirty()) {
      setConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!panelRef.current) { onClose(); return; }
    try {
      setSaving(true);
      await panelRef.current.save();
      toast.success("Cambios guardados");
      onClose();
    } catch (e: any) {
      toast.error("Error al guardar: " + (e?.message ?? "desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    panelRef.current?.discard();
    setConfirmOpen(false);
    onClose();
  };

  const handleSaveFromConfirm = async () => {
    setConfirmOpen(false);
    await handleSave();
  };

  return (
    <>
      <Dialog open={!!target} onOpenChange={handleAttemptClose}>
        <DialogContent className="w-[95vw] sm:!max-w-[93rem] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Hitos Ejecución — {target?.proyectoNombre}
              {target?.empresaName ? ` · ${target.empresaName}` : ""}
            </DialogTitle>
          </DialogHeader>
          {target && (
            <HitosEjecucionPanel
              ref={panelRef}
              proyectoEmpresaId={target.proyectoEmpresaId}
              empresaName={target.empresaName}
              defaultOpen
              draftMode
              onDirtyChange={setDirty}
            />
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
            <Button variant="outline" onClick={() => handleAttemptClose(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quieres guardar los cambios antes de cerrar? Si descartas, se perderán las modificaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscard}>Descartar</Button>
            <AlertDialogAction onClick={handleSaveFromConfirm}>Guardar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ── Hook: captadores with their linked user permissions ── */
function useCaptadoresConUsuarios(enabled: boolean = true) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["captadores_con_usuarios"],
    enabled,
    queryFn: async () => {
      const { data: caps } = await supabase
        .from("captadores" as any)
        .select("id, nombre, user_id")
        .not("user_id", "is", null);
      if (!caps?.length) return [];
      const userIds = (caps as any[]).map((c: any) => c.user_id);
      const { data: perms } = await supabase
        .from("user_permissions")
        .select("user_id, empresas_visibles")
        .in("user_id", userIds);
      return (caps as any[]).map((c: any) => {
        const perm = perms?.find((p: any) => p.user_id === c.user_id) as any;
        const ev = perm?.empresas_visibles;
        return {
          captadorId: c.id as string,
          nombre: c.nombre as string,
          userId: c.user_id as string,
          empresasVisibles: Array.isArray(ev) ? (ev as string[]) : null,
        };
      });
    },
  });
}

/* Badge read-only mostrado al captador indicando que ve sus proyectos */
function CaptadorFilterBadge({ captadorId }: { captadorId: string }) {
  const { data: captadores } = useCaptadoresConUsuarios();
  const nombre = captadores?.find(c => c.captadorId === captadorId)?.nombre || "Mis proyectos";
  return (
    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 cursor-default opacity-80" disabled>
      <UserCircle2 className="w-3 h-3" />
      {nombre}
    </Button>
  );
}

function CaptadorFilterPopover({ value, onToggle, onClear }: { value: string[]; onToggle: (id: string) => void; onClear: () => void }) {
  const { data: captadores } = useCaptadoresConUsuarios();
  const sorted = (captadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
          Captador {value.length > 0 && <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{value.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">Sin captadores con usuario vinculado.</p>
          )}
          {sorted.map((c) => (
            <label key={c.captadorId} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
              <Checkbox checked={value.includes(c.captadorId)} onCheckedChange={() => onToggle(c.captadorId)} />
              {c.nombre}
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-1 h-7 text-xs" onClick={onClear}>Limpiar</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── CaptadorProjectCell: assign one captador per empresa within a project ── */
function CaptadorProjectCell({
  items,
  captadoresConUsuarios,
}: {
  items: ProyectoWithEmpresas[];
  captadoresConUsuarios: { captadorId: string; nombre: string; userId: string; empresasVisibles: string[] | null }[];
}) {
  const [open, setOpen] = useState(false);
  // Optimistic overrides: proyectoId → captadorId (null = unassigned)
  const [overrides, setOverrides] = useState<Map<string, string | null>>(new Map());
  const qc = useQueryClient();

  // Reset overrides when external data updates (after invalidation resolves)
  useEffect(() => { setOverrides(new Map()); }, [items]);

  // One entry per unique empresa in this project group
  const empresaItems = useMemo(() => {
    const seen = new Set<string>();
    const result: { proyectoId: string; empresaId: string; empresaNombre: string }[] = [];
    for (const p of items) {
      const pe = p.proyecto_empresas?.[0];
      if (pe && !seen.has(pe.empresa_id)) {
        seen.add(pe.empresa_id);
        result.push({ proyectoId: p.id, empresaId: pe.empresa_id, empresaNombre: pe.empresas?.nombre || "Empresa" });
      }
    }
    return result;
  }, [items]);

  // Current captador for a proyecto_id — local override first, then DB, then legacy
  const getAssigned = useCallback((proyectoId: string): string | null => {
    if (overrides.has(proyectoId)) return overrides.get(proyectoId) ?? null;
    const p = items.find(i => i.id === proyectoId);
    if (!p) return null;
    const pc = (p.proyecto_captadores || [])[0] as any;
    if (pc) return pc.captador_id as string;
    // Legacy: check empresas_visibles
    const empresaId = p.proyecto_empresas?.[0]?.empresa_id;
    if (empresaId) {
      for (const cap of captadoresConUsuarios) {
        if (Array.isArray(cap.empresasVisibles) && cap.empresasVisibles.includes(empresaId)) return cap.captadorId;
      }
    }
    return null;
  }, [items, captadoresConUsuarios, overrides]);

  // Unique captadores assigned to at least one empresa (for trigger button)
  const asignados = useMemo(() => {
    const ids = new Set(empresaItems.map(e => getAssigned(e.proyectoId)).filter(Boolean) as string[]);
    return captadoresConUsuarios.filter(c => ids.has(c.captadorId));
  }, [empresaItems, getAssigned, captadoresConUsuarios]);

  const handleSelect = async (proyectoId: string, empresaId: string, newCaptadorId: string | null) => {
    const oldCaptadorId = getAssigned(proyectoId);
    if (oldCaptadorId === newCaptadorId) return; // clicking active → unassign

    // ── Optimistic update (instant) ──
    setOverrides(prev => new Map(prev).set(proyectoId, newCaptadorId));

    try {
      // 1. Remove old assignment from proyecto_captadores
      if (oldCaptadorId) {
        const { error } = await supabase
          .from("proyecto_captadores")
          .delete()
          .eq("proyecto_id", proyectoId)
          .eq("captador_id", oldCaptadorId);
        if (error) throw error;
      }
      // 2. Clean up old captador's legacy empresas_visibles for this empresa
      const oldCap = captadoresConUsuarios.find(c => c.captadorId === oldCaptadorId);
      if (oldCap?.userId && Array.isArray(oldCap.empresasVisibles) && oldCap.empresasVisibles.includes(empresaId)) {
        await supabase.from("user_permissions").upsert(
          { user_id: oldCap.userId, empresas_visibles: oldCap.empresasVisibles.filter(id => id !== empresaId) },
          { onConflict: "user_id" }
        );
      }
      // 3. Add new assignment
      if (newCaptadorId) {
        const { error } = await supabase
          .from("proyecto_captadores")
          .insert({ proyecto_id: proyectoId, captador_id: newCaptadorId });
        if (error) throw error;
      }

      // Revalidate in background — overrides stay until items prop updates
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      qc.invalidateQueries({ queryKey: ["captadores_con_usuarios"] });
    } catch (e: any) {
      // Revert optimistic update on failure
      setOverrides(prev => { const m = new Map(prev); m.delete(proyectoId); return m; });
      toast.error("Error al actualizar: " + (e?.message || ""));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 transition-colors",
            asignados.length > 0
              ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title="Asignar captadores a este proyecto"
        >
          <UserCircle2 className="w-3 h-3" />
          {asignados.length > 0 ? asignados.map(c => c.nombre).join(", ") : "Captador"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Captador por empresa</p>
        {captadoresConUsuarios.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin captadores con cuenta de usuario.</p>
        ) : (
          <div className="space-y-3">
            {empresaItems.map(({ proyectoId, empresaId, empresaNombre }) => {
              const currentId = getAssigned(proyectoId);
              return (
                <div key={proyectoId}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1 truncate">{empresaNombre}</p>
                  <div className="flex flex-wrap gap-1">
                    {captadoresConUsuarios.map(cap => {
                      const isActive = currentId === cap.captadorId;
                      return (
                        <button
                          key={cap.captadorId}
                          type="button"
                          onClick={() => handleSelect(proyectoId, empresaId, isActive ? null : cap.captadorId)}
                          className={cn(
                            "text-[11px] px-2 py-0.5 rounded-full border transition-all",
                            isActive
                              ? "bg-emerald-600 text-white border-emerald-600 font-medium"
                              : "border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-700"
                          )}
                        >
                          {cap.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── CaptadorEmpresaCell: assign/unassign captador to an empresa ── */
function CaptadorEmpresaCell({ empresaId, canAssign }: { empresaId: string; canAssign: boolean }) {
  const { data: captadores, refetch } = useCaptadoresConUsuarios();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  // Captadores assigned to this empresa (empresa in their empresas_visibles)
  const asignados = (captadores || []).filter(c =>
    Array.isArray(c.empresasVisibles) && c.empresasVisibles.includes(empresaId)
  );

  const handleToggle = async (cap: { captadorId: string; userId: string; empresasVisibles: string[] | null }) => {
    setSaving(true);
    try {
      const current = cap.empresasVisibles || [];
      const isAssigned = current.includes(empresaId);
      const updated = isAssigned
        ? current.filter(id => id !== empresaId)
        : [...current, empresaId];
      await supabase.from("user_permissions").upsert(
        { user_id: cap.userId, empresas_visibles: updated },
        { onConflict: "user_id" }
      );
      await refetch();
      qc.invalidateQueries({ queryKey: ["captadores_con_usuarios"] });
      toast.success(isAssigned ? "Empresa removida del captador" : "Empresa asignada al captador");
    } catch {
      toast.error("Error al actualizar asignación");
    } finally {
      setSaving(false);
    }
  };

  // If only viewing (not assigning), just show a static chip
  if (!canAssign) {
    if (asignados.length === 0) return null;
    return (
      <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 mt-0.5">
        <UserCircle2 className="w-3 h-3" />
        {asignados.map(c => c.nombre).join(", ")}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`flex items-center gap-1 text-[11px] font-medium transition-colors rounded px-1.5 py-0.5 ${
            asignados.length > 0
              ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Asignar captador a esta empresa"
        >
          <UserCircle2 className="w-3 h-3" />
          {asignados.length > 0 ? asignados.map(c => c.nombre).join(", ") : "Captador"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Asignar captador</p>
        {!captadores?.length ? (
          <p className="text-xs text-muted-foreground">No hay captadores con cuenta de usuario</p>
        ) : (
          <div className="space-y-1">
            {captadores.map(cap => {
              const isAssigned = (cap.empresasVisibles || []).includes(empresaId);
              return (
                <button
                  key={cap.captadorId}
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggle(cap)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left ${
                    isAssigned
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <Check className={`w-3 h-3 shrink-0 ${isAssigned ? "opacity-100" : "opacity-0"}`} />
                  {cap.nombre}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
