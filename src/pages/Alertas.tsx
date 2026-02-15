import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Bell, Plus, Pencil, Trash2, CheckCircle2, Circle, Loader2, AlertTriangle, Clock, CalendarDays, GitBranch, RotateCcw, ArrowUpDown, Sparkles, X, Search as SearchIcon, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import KpiCard from "@/components/dashboard/KpiCard";
import {
  useAlertas,
  useCreateAlerta,
  useUpdateAlerta,
  useDeleteAlerta,
  useToggleAlertaCompletada,
  AlertaWithRelations,
  AlertaInput,
} from "@/hooks/useAlertas";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProyectos } from "@/hooks/useProyectos";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import AlertaFormDialog from "@/components/alertas/AlertaFormDialog";
import CompleteAlertaDialog from "@/components/alertas/CompleteAlertaDialog";
import AlertaTreeDialog from "@/components/alertas/AlertaTreeDialog";
import DeletedAlertasDialog from "@/components/alertas/DeletedAlertasDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, isToday, isBefore, startOfDay, addDays } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

type FilterTab = "todas" | "activas" | "7dias" | "30dias" | "vencidas";
type SortDir = "asc" | "desc";

export default function Alertas() {
  const { data: alertas, isLoading } = useAlertas();
  const { data: empresas } = useEmpresas();
  const { data: proyectosRaw } = useProyectos();
  const { user } = useAuth();
  const createAlerta = useCreateAlerta();
  const updateAlerta = useUpdateAlerta();
  const deleteAlerta = useDeleteAlerta();
  const toggleCompletada = useToggleAlertaCompletada();
  const queryClient = useQueryClient();
  const [generatingTitles, setGeneratingTitles] = useState(false);
  const [detectingDuplicates, setDetectingDuplicates] = useState(false);
  const [duplicatesResult, setDuplicatesResult] = useState<{ duplicates: any[]; total_alertas: number } | null>(null);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, email");
      return data || [];
    },
  });

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("activas");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AlertaWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [completeTarget, setCompleteTarget] = useState<AlertaWithRelations | null>(null);
  const [completeMode, setCompleteMode] = useState<"complete" | "uncomplete">("complete");
  const [createDefaults, setCreateDefaults] = useState<{ proyectoId?: string; empresaId?: string; parentAlertaId?: string }>({});
  const [showTree, setShowTree] = useState(false);
  const [treeRootId, setTreeRootId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [filterProyecto, setFilterProyecto] = useState<string>("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);

  const today = startOfDay(new Date());
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);

  const proyectosList = useMemo(() => {
    if (!proyectosRaw) return [];
    const seen = new Map<string, { id: string; nombre: string; numero: number }>();
    proyectosRaw.forEach((p) => {
      if (!seen.has(p.nombre)) {
        seen.set(p.nombre, { id: p.id, nombre: p.nombre, numero: p.numero });
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.numero - b.numero);
  }, [proyectosRaw]);

  const stats = useMemo(() => {
    if (!alertas) return { total: 0, activas: 0, prox7: 0, prox30: 0, vencidas: 0 };
    // Overdue alerts count as "vencidas" but are treated as completed visually
    const activas = alertas.filter((a) => !a.completada && !isBefore(parseLocalDate(a.fecha_seguimiento), today));
    const vencidas = alertas.filter((a) => !a.completada && isBefore(parseLocalDate(a.fecha_seguimiento), today));
    const prox7 = activas.filter((a) => {
      const d = parseLocalDate(a.fecha_seguimiento);
      return d >= today && d <= in7;
    });
    const prox30 = activas.filter((a) => {
      const d = parseLocalDate(a.fecha_seguimiento);
      return d >= today && d <= in30;
    });
    return { total: alertas.length, activas: activas.length, prox7: prox7.length, prox30: prox30.length, vencidas: vencidas.length };
  }, [alertas, today, in7, in30]);

  const filtered = useMemo(() => {
    if (!alertas) return [];
    let list = alertas;

    const isOverdue = (a: AlertaWithRelations) => !a.completada && isBefore(parseLocalDate(a.fecha_seguimiento), today);

    if (activeTab === "activas") list = list.filter((a) => !a.completada && !isOverdue(a));
    else if (activeTab === "vencidas") list = list.filter((a) => isOverdue(a));
    else if (activeTab === "7dias") list = list.filter((a) => !a.completada && !isOverdue(a) && parseLocalDate(a.fecha_seguimiento) <= in7);
    else if (activeTab === "30dias") list = list.filter((a) => !a.completada && !isOverdue(a) && parseLocalDate(a.fecha_seguimiento) <= in30);

    if (filterProyecto !== "all") {
      list = list.filter((a) => a.proyecto_id === filterProyecto);
    }

    if (fechaDesde) {
      const desde = startOfDay(fechaDesde);
      list = list.filter((a) => parseLocalDate(a.fecha_seguimiento) >= desde);
    }
    if (fechaHasta) {
      const hasta = startOfDay(fechaHasta);
      list = list.filter((a) => parseLocalDate(a.fecha_seguimiento) <= hasta);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((a) =>
        a.texto.toLowerCase().includes(s) ||
        ((a as any).titulo || "").toLowerCase().includes(s) ||
        a.proyectos?.nombre?.toLowerCase().includes(s) ||
        a.empresas?.nombre?.toLowerCase().includes(s)
      );
    }

    list = [...list].sort((a, b) => {
      const diff = parseLocalDate(a.fecha_seguimiento).getTime() - parseLocalDate(b.fecha_seguimiento).getTime();
      return sortDir === "asc" ? diff : -diff;
    });

    return list;
  }, [alertas, activeTab, search, today, in7, in30, filterProyecto, sortDir, fechaDesde, fechaHasta]);

  const handleGenerateTitles = async () => {
    setGeneratingTitles(true);
    let totalUpdated = 0;
    try {
      let remaining = 1;
      while (remaining > 0) {
        const { data, error } = await supabase.functions.invoke("generate-titulos", {
          body: { batchSize: 30 },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        totalUpdated += data.updated || 0;
        remaining = data.remaining || 0;
        if (remaining > 0) {
          toast.info(`Procesando títulos... ${totalUpdated} actualizados, ${remaining} restantes`);
        }
      }
      toast.success(`${totalUpdated} títulos generados con IA`);
      queryClient.invalidateQueries({ queryKey: ["alertas"] });
    } catch (e: any) {
      toast.error(e.message || "Error generando títulos");
    } finally {
      setGeneratingTitles(false);
    }
  };

  const handleDetectDuplicates = async (dryRun: boolean) => {
    setDetectingDuplicates(true);
    try {
      const { data, error } = await supabase.functions.invoke("detect-duplicates", {
        body: { dryRun },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (dryRun) {
        setDuplicatesResult(data);
        setShowDuplicatesDialog(true);
      } else {
        toast.success(`${data.duplicates_found} alertas duplicadas eliminadas`);
        setShowDuplicatesDialog(false);
        setDuplicatesResult(null);
        queryClient.invalidateQueries({ queryKey: ["alertas"] });
        queryClient.invalidateQueries({ queryKey: ["alertas-all"] });
      }
    } catch (e: any) {
      toast.error(e.message || "Error detectando duplicados");
    } finally {
      setDetectingDuplicates(false);
    }
  };

  const handleSubmit = (data: AlertaInput & { id?: string }) => {
    if (data.empresa_id === "none") data.empresa_id = null;
    if (data.id) {
      updateAlerta.mutate(data as AlertaInput & { id: string });
    } else {
      createAlerta.mutate(data);
    }
  };

  const isVencida = (a: AlertaWithRelations) => !a.completada && isBefore(parseLocalDate(a.fecha_seguimiento), today);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "todas", label: "Todas", count: stats.total },
    { key: "activas", label: "Activas", count: stats.activas },
    { key: "7dias", label: "Próx. 7 días", count: stats.prox7 },
    { key: "30dias", label: "Próx. 30 días", count: stats.prox30 },
    { key: "vencidas", label: "Vencidas", count: stats.vencidas },
  ];

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
          <h1 className="text-3xl font-bold text-foreground">Central de Alertas</h1>
          <p className="text-muted-foreground mt-1">Gestión y seguimiento de alertas por proyecto</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerateTitles} disabled={generatingTitles}>
            {generatingTitles ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {generatingTitles ? "Generando..." : "Generar títulos IA"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDetectDuplicates(true)} disabled={detectingDuplicates}>
            {detectingDuplicates ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Copy className="w-4 h-4 mr-1" />}
            {detectingDuplicates ? "Analizando..." : "Detectar duplicados IA"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDeleted(true)}>
            <RotateCcw className="w-4 h-4 mr-1" /> Eliminadas
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setTreeRootId(null); setShowTree(true); }}>
            <GitBranch className="w-4 h-4 mr-1" /> Árbol
          </Button>
          <Button onClick={() => { setEditTarget(null); setCreateDefaults({}); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Alerta
          </Button>
        </div>
      </motion.div>

      {/* KPIs — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Alertas" value={String(stats.total)} icon={Bell} variant="default" delay={0} onClick={() => setActiveTab("todas")} active={activeTab === "todas"} />
        <KpiCard title="Activas" value={String(stats.activas)} icon={Circle} variant="info" delay={0.05} onClick={() => setActiveTab("activas")} active={activeTab === "activas"} />
        <KpiCard title="Próx. 7 días" value={String(stats.prox7)} icon={Clock} variant="warning" delay={0.1} onClick={() => setActiveTab("7dias")} active={activeTab === "7dias"} />
        <KpiCard title="Próx. 30 días" value={String(stats.prox30)} icon={CalendarDays} variant="success" delay={0.15} onClick={() => setActiveTab("30dias")} active={activeTab === "30dias"} />
        <KpiCard title="Vencidas" value={String(stats.vencidas)} icon={AlertTriangle} variant="warning" delay={0.2} onClick={() => setActiveTab("vencidas")} active={activeTab === "vencidas"} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-start">
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filterProyecto} onValueChange={setFilterProyecto}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos los proyectos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proyectos</SelectItem>
              {proyectosList.map((p) => (
                <SelectItem key={p.id} value={p.id}>#{p.numero} {p.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <CalendarDays className="w-4 h-4" />
                {fechaDesde ? format(fechaDesde, "dd/MM/yy", { locale: es }) : "Desde"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fechaDesde} onSelect={setFechaDesde} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <CalendarDays className="w-4 h-4" />
                {fechaHasta ? format(fechaHasta, "dd/MM/yy", { locale: es }) : "Hasta"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={fechaHasta} onSelect={setFechaHasta} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(fechaDesde || fechaHasta) && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setFechaDesde(undefined); setFechaHasta(undefined); }} title="Limpiar fechas">
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} title="Ordenar por fecha">
            <ArrowUpDown className="w-4 h-4 mr-1" />
            {sortDir === "asc" ? "Más antigua" : "Más reciente"}
          </Button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar alertas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">Estado</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Alerta</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsable</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Seguimiento</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No hay alertas</td></tr>
              )}
              {filtered.map((a) => {
                const vencida = isVencida(a);
                const looksCompleted = a.completada || vencida;
                return (
                <tr key={a.id} className={cn("hover:bg-secondary/20 transition-colors", vencida && "bg-secondary/10")}>
                  <td className="px-5 py-3">
                    <button onClick={() => {
                      if (a.completada || vencida) {
                        setCompleteTarget(a);
                        setCompleteMode("uncomplete");
                      } else {
                        setCompleteTarget(a);
                        setCompleteMode("complete");
                      }
                    }}>
                      {(a.completada || vencida)
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        : <Circle className="w-5 h-5 text-muted-foreground" />
                      }
                    </button>
                  </td>
                  <td className={cn("px-5 py-3 font-medium max-w-[200px]", looksCompleted ? "line-through text-muted-foreground" : "text-card-foreground")}>
                    {(a as any).titulo && <div className="text-[11px] font-semibold text-amber-700">{(a as any).titulo}</div>}
                    {a.texto}
                    {vencida && !a.completada && <span className="ml-1 text-[10px] text-muted-foreground">(vencida)</span>}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {a.proyectos ? `#${a.proyectos.numero} ${a.proyectos.nombre}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{a.empresas?.nombre || "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {a.responsable_profile?.display_name || a.responsable_profile?.email || "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {format(parseLocalDate(a.fecha_seguimiento), "dd MMM yyyy", { locale: es })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {a.parent_alerta_id && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver árbol" onClick={() => { setTreeRootId(a.id); setShowTree(true); }}>
                          <GitBranch className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Crear dependiente" onClick={() => {
                        setEditTarget(null);
                        setCreateDefaults({ proyectoId: a.proyecto_id, empresaId: a.empresa_id || undefined, parentAlertaId: a.id });
                        setDialogOpen(true);
                      }}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditTarget(a); setDialogOpen(true); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(a.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Dialog */}
      <AlertaFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); setCreateDefaults({}); }}
        onSubmit={handleSubmit}
        editTarget={editTarget}
        proyectos={proyectosList}
        empresas={empresas || []}
        profiles={profiles || []}
        currentUserId={user?.id || ""}
        defaultProyectoId={createDefaults.proyectoId}
        defaultEmpresaId={createDefaults.empresaId}
        parentAlertaId={createDefaults.parentAlertaId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar alerta?</AlertDialogTitle>
            <AlertDialogDescription>La alerta será movida a la papelera y podrá ser restaurada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) deleteAlerta.mutate(deleteTarget); setDeleteTarget(null); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete alert dialog */}
      <CompleteAlertaDialog
        alerta={completeTarget}
        open={!!completeTarget}
        onClose={() => { setCompleteTarget(null); setCompleteMode("complete"); }}
        mode={completeMode}
        onComplete={(id) => toggleCompletada.mutate({ id, completada: true })}
        onCompleteAndCreate={(a) => {
          toggleCompletada.mutate({ id: a.id, completada: true });
          setCreateDefaults({ proyectoId: a.proyecto_id, empresaId: a.empresa_id || undefined, parentAlertaId: a.id });
          setEditTarget(null);
          setDialogOpen(true);
        }}
        onUncomplete={(id, newDate) => {
          toggleCompletada.mutate({ id, completada: false });
          if (newDate) {
            updateAlerta.mutate({ id, fecha_seguimiento: newDate, proyecto_id: completeTarget!.proyecto_id, empresa_id: completeTarget!.empresa_id, titulo: (completeTarget as any)?.titulo || "", texto: completeTarget!.texto, usuario_responsable_id: completeTarget!.usuario_responsable_id });
          }
        }}
      />

      {/* Tree dialog */}
      <AlertaTreeDialog open={showTree} onClose={() => setShowTree(false)} rootAlertaId={treeRootId} />

      {/* Deleted alerts dialog */}
      <DeletedAlertasDialog open={showDeleted} onClose={() => setShowDeleted(false)} />

      {/* Duplicates detection dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={(v) => { if (!v) { setShowDuplicatesDialog(false); setDuplicatesResult(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicados detectados por IA</DialogTitle>
            <DialogDescription>
              {duplicatesResult ? `Se analizaron ${duplicatesResult.total_alertas} alertas. Se encontraron ${duplicatesResult.duplicates.length} posibles duplicados.` : "Analizando..."}
            </DialogDescription>
          </DialogHeader>
          {duplicatesResult && duplicatesResult.duplicates.length > 0 ? (
            <div className="space-y-3">
              {duplicatesResult.duplicates.map((d, i) => (
                <div key={i} className="border border-border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-start gap-2">
                    <Trash2 className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-destructive">Eliminar:</span>{" "}
                      <span className="text-muted-foreground">{d.texto}...</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-emerald-600">Conservar:</span>{" "}
                      <span className="text-muted-foreground">{d.keepTexto}...</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground italic pl-6">Razón: {d.reason}</p>
                </div>
              ))}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowDuplicatesDialog(false); setDuplicatesResult(null); }}>Cancelar</Button>
                <Button variant="destructive" onClick={() => handleDetectDuplicates(false)} disabled={detectingDuplicates}>
                  {detectingDuplicates ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Eliminar {duplicatesResult.duplicates.length} duplicados
                </Button>
              </DialogFooter>
            </div>
          ) : duplicatesResult ? (
            <p className="text-muted-foreground text-center py-6">No se encontraron alertas duplicadas. ✅</p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
