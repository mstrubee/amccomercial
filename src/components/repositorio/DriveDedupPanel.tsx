import { useRef } from "react";
import { motion, useDragControls } from "framer-motion";
import { GripVertical, X, CheckCircle2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export interface DuplicateItem {
  type: "folder" | "file";
  drive_id: string;
  keeper_id: string;
  name: string;
}

export interface DedupProgressState {
  status: "analyzing" | "running" | "stopped" | "done";
  total: number;
  processed: number;
  currentName?: string;
  needsReview: number;
  /** Only set when status is "stopped" — untouched items, used by "Reanudar". */
  remainingItems?: DuplicateItem[];
}

interface Props {
  state: DedupProgressState;
  onClose: () => void;
  onStop: () => void;
  onCancel: () => void;
  onResume: () => void;
  onReanalyze: () => void;
}

/**
 * Floating, draggable "always on top" panel showing live progress of the
 * Drive duplicate cleanup. Drag only from the header (GripVertical handle),
 * not the whole panel, so the progress text/buttons stay clickable.
 */
export default function DriveDedupPanel({ state, onClose, onStop, onCancel, onResume, onReanalyze }: Props) {
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  const percent = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;

  return (
    <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-[9999]">
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragConstraints={constraintsRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pointer-events-auto absolute top-20 right-6 w-72 rounded-lg border border-border bg-card shadow-xl overflow-hidden"
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex items-center gap-2 px-3 py-2 bg-muted/70 cursor-grab active:cursor-grabbing select-none"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex-1">
            Limpieza de duplicados
          </span>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3 space-y-2">
          {state.status === "analyzing" ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analizando Google Drive...
              </div>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1" onClick={onCancel}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-card-foreground">
                  {state.total} duplicado{state.total !== 1 ? "s" : ""} encontrado{state.total !== 1 ? "s" : ""}
                </span>
                {state.status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </div>

              {state.total > 0 && (
                <>
                  <Progress value={percent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {state.status === "done"
                      ? `Completado — ${state.processed} de ${state.total} eliminados`
                      : state.status === "stopped"
                        ? `Detenido — ${state.processed} de ${state.total} eliminados`
                        : `Eliminando ${state.processed} de ${state.total}${state.currentName ? `: "${state.currentName}"` : ""}`}
                  </p>
                </>
              )}

              {state.needsReview > 0 && (
                <p className="text-[11px] text-amber-600">
                  {state.needsReview} carpeta{state.needsReview !== 1 ? "s" : ""} con contenido — requiere{state.needsReview !== 1 ? "n" : ""} revisión manual
                </p>
              )}

              {state.status === "running" && (
                <div className="flex gap-1.5 mt-1">
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onStop}>
                    Detener
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onCancel}>
                    Cancelar
                  </Button>
                </div>
              )}

              {state.status === "stopped" && (
                <div className="flex gap-1.5 mt-1">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={onResume}>
                    Reanudar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={onReanalyze}>
                    Analizar de nuevo
                  </Button>
                </div>
              )}

              {state.status === "done" && (
                <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1" onClick={onClose}>
                  Cerrar
                </Button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
