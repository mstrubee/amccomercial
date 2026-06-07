import { useState } from "react";
import { motion } from "framer-motion";
import JSZip from "jszip";
import { Plus, Pencil, Trash2, RotateCcw, X, StickyNote, MapPin, Crosshair, AlertTriangle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  AdminNota, Prioridad, EstadoNota,
  PRIORIDAD_CONFIG, ESTADO_CONFIG,
  useAdminNotas, useAdminNotasPapelera,
  useEliminarNota, useRestaurarNota, usePurgarNota,
} from "@/hooks/useAdminNotas";
import { useNotasModo } from "@/contexts/NotasModoContext";
import NotaDialog from "@/components/notas/NotaDialog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", bg, color)}>
      {label}
    </span>
  );
}

function NotaCard({ nota, onEdit, onDelete }: { nota: AdminNota; onEdit: () => void; onDelete: () => void }) {
  const p = PRIORIDAD_CONFIG[nota.prioridad];
  const e = ESTADO_CONFIG[nota.estado];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm leading-snug">{nota.titulo}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {nota.contenido && (
        <p className="text-sm text-muted-foreground line-clamp-3">{nota.contenido}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Badge label={p.label} color={p.color} bg={p.bg} />
        <Badge label={e.label} color={e.color} bg={e.bg} />
      </div>

      {nota.elemento_ruta && (
        <div className="flex items-start gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-2.5 py-1.5">
          <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="truncate font-medium">{nota.elemento_ruta}</p>
            <p className="font-mono truncate text-orange-400">{nota.elemento_selector}</p>
            {nota.elemento_info?.texto && (
              <p className="italic truncate text-orange-500">"{nota.elemento_info.texto}"</p>
            )}
          </div>
        </div>
      )}

      {nota.imagenes && nota.imagenes.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {nota.imagenes.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="rounded-lg overflow-hidden border aspect-video bg-muted block hover:opacity-90 transition-opacity">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        {formatDistanceToNow(new Date(nota.created_at), { addSuffix: true, locale: es })}
      </p>
    </motion.div>
  );
}

async function exportarNotas(notas: AdminNota[]) {
  const zip = new JSZip();
  const imgFolder = zip.folder("imagenes")!;

  const notasExport = await Promise.all(
    notas.map(async (nota, idx) => {
      const imagenesLocales: string[] = [];
      for (const url of nota.imagenes ?? []) {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          const ext = url.split(".").pop()?.split("?")[0] ?? "png";
          const nombre = `nota_${idx + 1}_img_${imagenesLocales.length + 1}.${ext}`;
          imgFolder.file(nombre, blob);
          imagenesLocales.push(`imagenes/${nombre}`);
        } catch {
          imagenesLocales.push(url);
        }
      }
      return {
        id: nota.id,
        titulo: nota.titulo,
        contenido: nota.contenido,
        prioridad: nota.prioridad,
        estado: nota.estado,
        elemento: nota.elemento_ruta
          ? {
              ruta: nota.elemento_ruta,
              selector: nota.elemento_selector,
              info: nota.elemento_info,
            }
          : null,
        imagenes: imagenesLocales,
        creada: nota.created_at,
        actualizada: nota.updated_at,
      };
    })
  );

  zip.file("notas.json", JSON.stringify(notasExport, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `notas-amc-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminNotas() {
  const { data: notas = [], isLoading } = useAdminNotas();
  const [exportando, setExportando] = useState(false);
  const { data: papelera = [] } = useAdminNotasPapelera();
  const eliminar = useEliminarNota();
  const restaurar = useRestaurarNota();
  const purgar = usePurgarNota();

  const { modoActivo, activarModo, desactivarModo } = useNotasModo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editNota, setEditNota] = useState<AdminNota | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminNota | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<AdminNota | null>(null);

  const [filtroPrioridad, setFiltroPrioridad] = useState<Prioridad | "todas">("todas");
  const [filtroEstado, setFiltroEstado] = useState<EstadoNota | "todos">("todos");

  const notasFiltradas = notas.filter((n) => {
    if (filtroPrioridad !== "todas" && n.prioridad !== filtroPrioridad) return false;
    if (filtroEstado !== "todos" && n.estado !== filtroEstado) return false;
    return true;
  });

  const openEdit = (nota: AdminNota) => {
    setEditNota(nota);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditNota(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas del sistema</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registra mejoras, errores y ajustes pendientes para el sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={exportando || notas.length === 0}
            onClick={async () => {
              setExportando(true);
              try { await exportarNotas(notas); } finally { setExportando(false); }
            }}
            className="gap-2"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportando ? "Exportando..." : "Exportar"}
          </Button>
          <Button
            variant={modoActivo ? "destructive" : "outline"}
            onClick={modoActivo ? desactivarModo : activarModo}
            className="gap-2"
          >
            <Crosshair className="w-4 h-4" />
            {modoActivo ? "Salir del modo notas" : "Modo notas"}
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva nota
          </Button>
        </div>
      </div>

      {modoActivo && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-800">
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
          <p>
            <strong>Modo notas activo.</strong> Navega con normalidad. Mantén <kbd className="px-1 py-0.5 rounded border border-orange-300 bg-orange-100 font-mono text-xs">Ctrl</kbd> presionado y haz clic sobre cualquier elemento para capturarlo.
          </p>
          <button onClick={desactivarModo} className="ml-auto shrink-0 text-orange-500 hover:text-orange-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Tabs defaultValue="activas">
        <TabsList>
          <TabsTrigger value="activas" className="gap-1.5">
            <StickyNote className="w-3.5 h-3.5" />
            Notas activas
            {notas.length > 0 && (
              <span className="ml-1 bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">{notas.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="papelera" className="gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Papelera
            {papelera.length > 0 && (
              <span className="ml-1 bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">{papelera.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activas" className="mt-4 space-y-4">
          {/* Filtros */}
          <div className="flex items-center gap-3">
            <Select value={filtroPrioridad} onValueChange={(v) => setFiltroPrioridad(v as Prioridad | "todas")}>
              <SelectTrigger className="w-40 text-sm">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las prioridades</SelectItem>
                {(Object.entries(PRIORIDAD_CONFIG) as [Prioridad, typeof PRIORIDAD_CONFIG[Prioridad]][]).map(([k, c]) => (
                  <SelectItem key={k} value={k}><span className={cn("font-medium", c.color)}>{c.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as EstadoNota | "todos")}>
              <SelectTrigger className="w-40 text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(Object.entries(ESTADO_CONFIG) as [EstadoNota, typeof ESTADO_CONFIG[EstadoNota]][]).map(([k, c]) => (
                  <SelectItem key={k} value={k}><span className={cn("font-medium", c.color)}>{c.label}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filtroPrioridad !== "todas" || filtroEstado !== "todos") && (
              <button onClick={() => { setFiltroPrioridad("todas"); setFiltroEstado("todos"); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Cargando notas...</div>
          ) : notasFiltradas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No hay notas{filtroPrioridad !== "todas" || filtroEstado !== "todos" ? " con estos filtros" : ". ¡Crea la primera!"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notasFiltradas.map((nota) => (
                <NotaCard
                  key={nota.id}
                  nota={nota}
                  onEdit={() => openEdit(nota)}
                  onDelete={() => setDeleteTarget(nota)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="papelera" className="mt-4">
          {papelera.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">La papelera está vacía</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Las notas en papelera se eliminan automáticamente a los 7 días.</p>
              {papelera.map((nota) => {
                const p = PRIORIDAD_CONFIG[nota.prioridad];
                const deletedAgo = nota.deleted_at
                  ? formatDistanceToNow(new Date(nota.deleted_at), { addSuffix: true, locale: es })
                  : "";
                return (
                  <div key={nota.id} className="flex items-center justify-between gap-3 bg-muted/50 border border-border rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{nota.titulo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge label={p.label} color={p.color} bg={p.bg} />
                        <span className="text-[10px] text-muted-foreground">Eliminada {deletedAgo}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => restaurar.mutate(nota.id)} className="h-8 gap-1.5 text-xs">
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPurgeTarget(nota)} className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive">
                        <X className="w-3.5 h-3.5" /> Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Diálogo crear/editar */}
      <NotaDialog
        key={editNota?.id ?? "nueva"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nota={editNota}
      />

      {/* Confirmar mover a papelera */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Mover a papelera?</AlertDialogTitle>
            <AlertDialogDescription>
              La nota "<strong>{deleteTarget?.titulo}</strong>" se moverá a la papelera y se eliminará automáticamente en 7 días.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { eliminar.mutate(deleteTarget!.id); setDeleteTarget(null); }}>
              Mover a papelera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar purgar */}
      <AlertDialog open={!!purgeTarget} onOpenChange={(v) => !v && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Eliminar permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La nota "<strong>{purgeTarget?.titulo}</strong>" se eliminará definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { purgar.mutate(purgeTarget!.id); setPurgeTarget(null); }}
            >
              Eliminar para siempre
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
