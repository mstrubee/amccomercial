import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function BackToAlertasFloat() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 right-4 z-[60]"
      >
        <div className="flex items-center gap-1 bg-destructive text-destructive-foreground rounded-lg shadow-lg px-3 py-2">
          <button
            onClick={() => navigate("/alertas?restore=1")}
            className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Alertas
          </button>
          <button onClick={() => setDismissed(true)} className="ml-1 hover:opacity-80 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
