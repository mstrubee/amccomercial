import { useState, useEffect, useMemo, Fragment, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, Loader2, MapPin, Building2, Copy, ChevronRight, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { useProyectos, useCreateProyecto, useUpdateProyecto, useDeleteProyecto, useUpdateNotas, useUpdateNotaGrupo, ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useCategorias } from "@/hooks/useCategorias";
import { useAlertas, useCreateAlerta, useUpdateAlerta, useDeleteAlerta, useToggleAlertaCompletada, AlertaWithRelations } from "@/hooks/useAlertas";
import { useClasificaciones } from "@/hooks/useClasificaciones";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCLP, formatUF, ufToCLP } from "@/data/mock-data";
import ProyectoFormDialog from "@/components/proyectos/ProyectoFormDialog";
import AlertaFormDialog from "@/components/alertas/AlertaFormDialog";
import { AlertasCollapsible, ParentAlertasDisplay, AlertasFullView } from "@/components/proyectos/AlertasInline";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CompleteAlertaDialog from "@/components/alertas/CompleteAlertaDialog";
import AlertaTreeDialog from "@/components/alertas/AlertaTreeDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ESTADOS_AMC = ["Todos", "Vigente", "Todo Ofrecido", "Sin Respuesta", "Descartado"];
const ESTADOS_OBRA = ["Todos", "Anteproyecto", "Proyecto", "Licitación", "Constructora Adjudicada", "Obra Gruesa Inicial", "Obra Gruesa Intermedia", "Terminaciones", "Detenida", "Sin Información"];

export default function Proyectos() {
  const { data: proyectos, isLoading } = useProyectos();
  const { isAdmin } = useAuth();
  const { data: empresas } = useEmpresas();
  const { data: clasificaciones } = useClasificaciones();
  const createProyecto = useCreateProyecto();
  const updateProyecto = useUpdateProyecto();
  const deleteProyecto = useDeleteProyecto();
  const updateNotas = useUpdateNotas();
  const updateNotaGrupo = useUpdateNotaGrupo();

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("Todos");
  const [filterEmpresa, setFilterEmpresa] = useState("Todas");
  const [filterCategoria, setFilterCategoria] = useState("Todas");
  const [filterEstadoObra, setFilterEstadoObra] = useState("Todos");
  const [filterClasificacion, setFilterClasificacion] = useState("Todas");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<ProyectoWithEmpresas[] | null>(null);
  const [viewTarget, setViewTarget] = useState<ProyectoWithEmpresas | null>(null);
  const [templateSource, setTemplateSource] = useState<ProyectoWithEmpresas | null>(null);
  const [editParentGroup, setEditParentGroup] = useState<ProyectoWithEmpresas[] | null>(null);
  const [pendingParentSubmit, setPendingParentSubmit] = useState<{ data: any; toDelete: ProyectoWithEmpresas[] } | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [highlightProyectoId, setHighlightProyectoId] = useState<string | null>(null);
  const [alertaCreateContext, setAlertaCreateContext] = useState<{ proyecto_id: string; empresa_id: string | null; defaultTexto?: string; parentAlertaId?: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: alertas } = useAlertas();
  const { data: categorias } = useCategorias();
  const createAlerta = useCreateAlerta();
  const updateAlerta = useUpdateAlerta();
  const deleteAlertaMutation = useDeleteAlerta();
  const toggleCompletada = useToggleAlertaCompletada();

  const [alertaEditTarget, setAlertaEditTarget] = useState<AlertaWithRelations | null>(null);
  const [alertaDeleteTarget, setAlertaDeleteTarget] = useState<string | null>(null);
  const [alertaCompleteTarget, setAlertaCompleteTarget] = useState<AlertaWithRelations | null>(null);
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
    supabase.from("profiles").select("user_id, display_name, email").then(({ data }) => {
      if (data) setProfiles(data);
    });
  }, []);

  // Highlight project from widget navigation or URL param
  const highlightProject = useCallback((proyectoId: string) => {
    setHighlightProyectoId(proyectoId);
    if (proyectos) {
      const target = proyectos.find(p => p.id === proyectoId);
      if (target) {
        const key = target.nombre.trim().toLowerCase();
        setExpandedGroups(prev => ({ ...prev, [key]: true }));
      }
    }
    setTimeout(() => {
      const el = document.getElementById(`proyecto-row-${proyectoId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
    setTimeout(() => setHighlightProyectoId(null), 3000);
  }, [proyectos]);

  useEffect(() => {
    const id = searchParams.get("highlight");
    if (id && proyectos?.length) {
      highlightProject(id);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, proyectos, highlightProject, setSearchParams]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) highlightProject(detail);
    };
    window.addEventListener("highlight-proyecto", handler);
    return () => window.removeEventListener("highlight-proyecto", handler);
  }, [highlightProject]);

  const filtered = (proyectos || []).filter((p) => {
    const matchSearch =
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.comuna.toLowerCase().includes(search.toLowerCase());
    const matchEstado = filterEstado === "Todos" || p.estado_amc === filterEstado;
    const matchEstadoObra = filterEstadoObra === "Todos" || p.estado_obra === filterEstadoObra;
    const matchEmpresa =
      filterEmpresa === "Todas" ||
      p.proyecto_empresas?.some((pe) => pe.empresa_id === filterEmpresa);
    const matchCategoria =
      filterCategoria === "Todas" ||
      p.proyecto_empresas?.some((pe) => pe.categoria_id === filterCategoria || pe.subcategoria_id === filterCategoria);
    const matchClasificacion =
      filterClasificacion === "Todas" || p.clasificacion_id === filterClasificacion;
    return matchSearch && matchEstado && matchEstadoObra && matchEmpresa && matchCategoria && matchClasificacion;
  });

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

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    <div className="space-y-6">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o comuna..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue placeholder="Estado AMC" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_AMC.map((estado) => (
                <SelectItem key={estado} value={estado}>{estado === "Todos" ? "Todos los estados AMC" : estado}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEstadoObra} onValueChange={setFilterEstadoObra}>
            <SelectTrigger className="w-[190px] h-8 text-xs">
              <SelectValue placeholder="Estado Obra" />
            </SelectTrigger>
            <SelectContent>
              {ESTADOS_OBRA.map((estado) => (
                <SelectItem key={estado} value={estado}>{estado === "Todos" ? "Todos los estados obra" : estado}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEmpresa} onValueChange={setFilterEmpresa}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filtrar empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las empresas</SelectItem>
              {empresas?.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Filtrar categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las categorías</SelectItem>
              {categorias?.map((cat) => (
                <Fragment key={cat.id}>
                  <SelectItem value={cat.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.nombre}
                    </span>
                  </SelectItem>
                  {cat.subcategorias_proyecto?.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      <span className="flex items-center gap-1.5 pl-3">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                        {sub.nombre}
                      </span>
                    </SelectItem>
                  ))}
                </Fragment>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterClasificacion} onValueChange={setFilterClasificacion}>
            <SelectTrigger className="w-[170px] h-8 text-xs">
              <SelectValue placeholder="Clasificación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas las clasificaciones</SelectItem>
              {clasificaciones?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">N°</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ingreso</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comuna</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado Obra</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado AMC</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresas / Cotización</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map(({ key, items }, groupIdx) => {
                const isGroup = items.length > 1;
                const expanded = expandedGroups[key] ?? false;
                const parentNum = groupIdx + 1;
                const isEven = groupIdx % 2 === 1;
                const evenBg = isEven ? "bg-muted/40" : "";

                if (!isGroup) {
                  const p = items[0];
                  return <ProjectRow key={p.id} p={p} displayNum={String(parentNum)} isEven={isEven} onView={setViewTarget} onEdit={setEditTarget} onDelete={setDeleteTarget} onTemplate={setTemplateSource} updateNotas={updateNotas.mutate} />;
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
                      <td className="px-5 py-3 text-muted-foreground text-xs">{(first as any).fecha_ingreso ? new Date((first as any).fecha_ingreso).toLocaleDateString("es-CL") : "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{first.comuna}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div>{first.estado_obra}</div>
                        {first.fecha_estado_obra && (
                          <div className="text-[10px] text-muted-foreground/70">{new Date(first.fecha_estado_obra).toLocaleDateString("es-CL")}</div>
                        )}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={first.estado_amc} /></td>
                      <td className="px-5 py-3">
                        <GroupEmpresasCell items={items} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(() => {
                            const groupIds = new Set(items.map(i => i.id));
                            const parentAlertas = (alertas || []).filter(a => groupIds.has(a.proyecto_id) && !a.empresa_id);
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
                      <td className="px-5 pb-2 pt-0" colSpan={8}>
                        <NotaGrupoCell proyecto={first} onSave={updateNotaGrupo.mutate} onCreateAlerta={(texto) => setAlertaCreateContext({ proyecto_id: first.id, empresa_id: null, defaultTexto: texto })} />
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expanded && items.map((p, childIdx) => {
                        const empresaId = p.proyecto_empresas?.[0]?.empresa_id || null;
                        const childAlertas = (alertas || []).filter(a => a.proyecto_id === p.id && a.empresa_id === empresaId);
                        const childBg = isEven ? "bg-muted/30" : "bg-secondary/10";
                        return (
                          <Fragment key={p.id}>
                            <motion.tr
                              id={`proyecto-row-${p.id}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className={`hover:bg-secondary/30 transition-colors ${childBg} ${highlightProyectoId === p.id ? "ring-2 ring-primary ring-inset" : ""}`}
                            >
                              <td className="px-5 py-2 text-muted-foreground pl-10 align-top">{parentNum}.{childIdx + 1}</td>
                              <td colSpan={3} className="px-5 py-2 align-top">
                                <NotasCell proyecto={p} onSave={updateNotas.mutate} onCreateAlerta={(texto) => setAlertaCreateContext({ proyecto_id: p.id, empresa_id: p.proyecto_empresas?.[0]?.empresa_id || null, defaultTexto: texto })} />
                              </td>
                              <td colSpan={2} className="px-5 py-2 align-top">
                                <AlertasCollapsible alertas={childAlertas} allAlertas={alertas} onEdit={(a) => setAlertaEditTarget(a)} onDelete={(id) => setAlertaDeleteTarget(id)} onComplete={(a) => setAlertaCompleteTarget(a)} onShowTree={handleShowTree} onCreateDependent={(a) => setAlertaCreateContext({ proyecto_id: a.proyecto_id, empresa_id: a.empresa_id || null, parentAlertaId: a.id })} />
                              </td>
                              <td className="px-5 py-2 align-top"><EmpresasCell proyectoEmpresas={p.proyecto_empresas} /></td>
                              <td className="px-5 py-2 text-right align-top">
                                <div className="flex justify-end gap-1">
                                  {(() => {
                                    const empresaId = p.proyecto_empresas?.[0]?.empresa_id || null;
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
                                          <div className="text-xs font-semibold text-foreground mb-2">Alertas — {p.proyecto_empresas?.[0]?.empresas?.nombre || "Empresa"}</div>
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
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Usar como plantilla" onClick={() => setTemplateSource(p)}><Copy className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(p)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                              </td>
                            </motion.tr>
                          </Fragment>
                        );
                      })}
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
          onClose={() => setAlertaCreateContext(null)}
          onSubmit={(data) => {
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
        onComplete={(id) => toggleCompletada.mutate({ id, completada: true })}
        onCompleteAndCreate={(a) => {
          toggleCompletada.mutate({ id: a.id, completada: true });
          setAlertaCreateContext({ proyecto_id: a.proyecto_id, empresa_id: a.empresa_id || null, parentAlertaId: a.id });
        }}
      />

      {/* View detail dialog */}
      <ProyectoDetailDialog viewTarget={viewTarget} onClose={() => setViewTarget(null)} />

      {/* Tree dialog */}
      <AlertaTreeDialog open={showTree} onClose={() => setShowTree(false)} rootAlertaId={treeRootId} />
    </div>
  );
}

/* ── Single project row ── */
function ProjectRow({ p, displayNum, isEven, onView, onEdit, onDelete, onTemplate, updateNotas }: {
  p: ProyectoWithEmpresas;
  displayNum: string;
  isEven: boolean;
  onView: (p: ProyectoWithEmpresas) => void;
  onEdit: (p: ProyectoWithEmpresas) => void;
  onDelete: (p: ProyectoWithEmpresas) => void;
  onTemplate: (p: ProyectoWithEmpresas) => void;
  updateNotas: (data: { id: string; notas: string }) => void;
}) {
  const evenBg = isEven ? "bg-muted/40" : "";
  return (
    <>
      <tr className={`hover:bg-secondary/30 transition-colors border-t-[3px] border-muted-foreground/30 ${evenBg}`}>
        <td className="px-5 py-3 text-muted-foreground">{displayNum}</td>
        <td className="px-5 py-3 font-medium text-card-foreground cursor-pointer hover:underline" onClick={() => onView(p)}>{p.nombre}</td>
        <td className="px-5 py-3 text-muted-foreground text-xs">{(p as any).fecha_ingreso ? new Date((p as any).fecha_ingreso).toLocaleDateString("es-CL") : "—"}</td>
        <td className="px-5 py-3 text-muted-foreground">{p.comuna}</td>
        <td className="px-5 py-3 text-muted-foreground">{p.estado_obra}</td>
        <td className="px-5 py-3"><StatusBadge status={p.estado_amc} /></td>
        <td className="px-5 py-3"><EmpresasCell proyectoEmpresas={p.proyecto_empresas} /></td>
        <td className="px-5 py-3 text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Usar como plantilla" onClick={() => onTemplate(p)}><Copy className="w-3.5 h-3.5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(p)}><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => onDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </td>
      </tr>
      <tr className={evenBg}>
        <td className="px-5 pb-2 pt-0" colSpan={8}>
          <NotasCell proyecto={p} onSave={updateNotas} />
        </td>
      </tr>
    </>
  );
}

/* ── Empresas cell component ── */
function EmpresasCell({ proyectoEmpresas }: { proyectoEmpresas: ProyectoWithEmpresas["proyecto_empresas"] }) {
  if (!proyectoEmpresas || proyectoEmpresas.length === 0) {
    return <span className="text-muted-foreground text-xs">Sin empresas</span>;
  }

  return (
    <div className="space-y-1">
      {proyectoEmpresas.map((pe) => {
        if (!pe.empresas) return null;
        const monto = (pe as any).monto_cotizacion || 0;
        const sub = (pe as any).subcategorias_proyecto;
        const cat = (pe as any).categorias_proyecto;
        const statusColor = sub?.color || cat?.color || null;
        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
        const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;

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
            </span>
            {statusName && (
              <span className="ml-1 text-[10px] text-muted-foreground">{statusName}</span>
            )}
            {monto > 0 && (
              <>
                <br />
                <span className="ml-0.5 text-[11px] font-medium text-card-foreground">{formatUF(monto)}</span>
                <br />
                <span className="ml-0.5 text-[10px] text-muted-foreground">{formatCLP(ufToCLP(monto))}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Group header empresas cell (name + category, no monto) ── */
function GroupEmpresasCell({ items }: { items: ProyectoWithEmpresas[] }) {
  const allEmpresasRaw = items.flatMap((p) => p.proyecto_empresas || []);
  const seen = new Set<string>();
  const allEmpresas = allEmpresasRaw.filter((pe) => {
    if (!pe.empresa_id || seen.has(pe.empresa_id)) return false;
    seen.add(pe.empresa_id);
    return true;
  });
  if (allEmpresas.length === 0) {
    return <span className="text-muted-foreground text-xs">Sin empresas</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {allEmpresas.map((pe) => {
        if (!pe.empresas) return null;
        const sub = (pe as any).subcategorias_proyecto;
        const cat = (pe as any).categorias_proyecto;
        const statusColor = sub?.color || cat?.color || null;
        const statusName = sub ? `${cat?.nombre ? cat.nombre + " › " : ""}${sub.nombre}` : cat?.nombre || null;
        const isAdj = sub?.es_adjudicado || cat?.es_adjudicado || false;
        return (
          <span
            key={pe.id}
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
          </span>
        );
      })}
    </div>
  );
}

/* ── Nota grupo cell (no char limit, only for parent row) ── */
function NotaGrupoCell({ proyecto, onSave, onCreateAlerta }: { proyecto: ProyectoWithEmpresas; onSave: (data: { id: string; nota_grupo: string }) => void; onCreateAlerta?: (texto: string) => void }) {
  const [value, setValue] = useState((proyecto as any).nota_grupo || "");
  const [saved, setSaved] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue((proyecto as any).nota_grupo || "");
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
  if (!viewTarget) return null;

  return (
    <Dialog open={!!viewTarget} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{viewTarget.nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          <div className="flex gap-3 flex-wrap">
            <StatusBadge status={viewTarget.estado_amc} />
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
                const monto = (pe as any).monto_cotizacion || 0;
                return (
                  <div key={pe.id} className={`px-3 py-2 rounded-lg text-sm border ${isAdj ? "bg-success/10 border-success/30" : "bg-secondary/30 border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {statusColor && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColor }} />}
                        <span className={`font-medium ${isAdj ? "text-success" : "text-card-foreground"}`}>{pe.empresas.nombre}</span>
                      </div>
                      {statusName && <span className="text-[10px] font-semibold uppercase" style={{ color: statusColor || undefined }}>{statusName}</span>}
                    </div>
                    {monto > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cotización: {formatUF(monto)} <span className="ml-1">≈ {formatCLP(ufToCLP(monto))}</span>
                      </p>
                    )}
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
function NotasCell({ proyecto, onSave, onCreateAlerta }: { proyecto: ProyectoWithEmpresas; onSave: (data: { id: string; notas: string }) => void; onCreateAlerta?: (texto: string) => void }) {
  const [value, setValue] = useState((proyecto as any).notas || "");
  const [saved, setSaved] = useState(true);
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue((proyecto as any).notas || "");
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

  return (
    <div className="relative">
      <textarea
        className="w-full min-h-[36px] resize-y rounded-md border border-border bg-card/50 px-2 py-1 text-xs text-card-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Notas..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused && (
        <div className="flex items-center justify-between mt-0.5">
          {onCreateAlerta && value.trim() ? (
            <button
              className="text-[9px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCreateAlerta(value.trim().slice(0, 100)); }}
              title="Crear alerta a partir de esta nota"
            >
              <Bell className="w-2.5 h-2.5" /> Crear alerta
            </button>
          ) : <span />}
          <span className="text-[9px] text-muted-foreground">
            {value.length} chars{!saved && " · guardando..."}
          </span>
        </div>
      )}
    </div>
  );
}
