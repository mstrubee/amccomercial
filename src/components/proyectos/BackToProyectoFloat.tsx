import { ArrowLeft, X, FolderKanban } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const RESUME_PROYECTO_KEY = "amc:resume-proyecto-edit";
export const RESUME_PROYECTO_EVENT = "amc:resume-proyecto-changed";

function readSnapshot(): boolean {
  try {
    return !!sessionStorage.getItem(RESUME_PROYECTO_KEY);
  } catch {
    return false;
  }
}

export default function BackToProyectoFloat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasSnapshot, setHasSnapshot] = useState<boolean>(() => readSnapshot());

  useEffect(() => {
    const update = () => setHasSnapshot(readSnapshot());
    update();
    window.addEventListener("storage", update);
    window.addEventListener(RESUME_PROYECTO_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(RESUME_PROYECTO_EVENT, update);
    };
  }, [location.pathname]);

  if (!hasSnapshot) return null;
  if (location.pathname === "/proyectos") return null;

  const dismiss = () => {
    try { sessionStorage.removeItem(RESUME_PROYECTO_KEY); } catch {}
    window.dispatchEvent(new Event(RESUME_PROYECTO_EVENT));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-[100]"
      >
        <div className="flex items-center gap-1 bg-primary text-primary-foreground rounded-lg shadow-lg px-3 py-2">
          <button
            onClick={() => navigate("/proyectos")}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            <FolderKanban className="w-4 h-4" />
            Volver a Editar Proyecto
          </button>
          <button
            onClick={dismiss}
            className="ml-1 hover:opacity-80 transition-opacity"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}