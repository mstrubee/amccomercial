import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";

export const BACK_TO_MENCIONES_KEY = "amc:back-to-menciones";
export const BACK_TO_MENCIONES_EVENT = "amc:back-to-menciones-changed";

function readState() {
  try { return !!sessionStorage.getItem(BACK_TO_MENCIONES_KEY); } catch { return false; }
}

export default function BackToMencionesFloat() {
  const [show, setShow] = useState(readState);

  useEffect(() => {
    const update = () => setShow(readState());
    window.addEventListener("storage", update);
    window.addEventListener(BACK_TO_MENCIONES_EVENT, update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener(BACK_TO_MENCIONES_EVENT, update);
    };
  }, []);

  if (!show) return null;

  const close = () => {
    try { sessionStorage.removeItem(BACK_TO_MENCIONES_KEY); } catch {}
    window.dispatchEvent(new Event(BACK_TO_MENCIONES_EVENT));
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex items-center gap-1 rounded-full border border-border bg-card shadow-lg pl-1 pr-1 py-1">
      <Link
        to="/menciones"
        onClick={close}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Menciones
      </Link>
      <button
        onClick={close}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        title="Cerrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}