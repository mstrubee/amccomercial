import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ChevronDown, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { mockEmpresas, formatCLP } from "@/data/mock-data";
import { Empresa } from "@/types/amc";

export default function Empresas() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Empresas Representadas</h1>
          <p className="text-muted-foreground mt-1">Gestiona las empresas y sus condiciones comerciales</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Empresa
        </Button>
      </motion.div>

      <div className="space-y-3">
        {mockEmpresas.map((empresa, i) => (
          <EmpresaCard
            key={empresa.id}
            empresa={empresa}
            expanded={expanded === empresa.id}
            onToggle={() => setExpanded(expanded === empresa.id ? null : empresa.id)}
            delay={i * 0.05}
          />
        ))}
      </div>
    </div>
  );
}

function EmpresaCard({
  empresa,
  expanded,
  onToggle,
  delay,
}: {
  empresa: Empresa;
  expanded: boolean;
  onToggle: () => void;
  delay: number;
}) {
  const condicionActual = empresa.condicionesComerciales[empresa.condicionesComerciales.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-primary font-bold text-sm">{empresa.nombre.charAt(0)}</span>
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">{empresa.nombre}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Desde {new Date(empresa.fechaInicioRelacion).toLocaleDateString("es-CL")} · Fee: {formatCLP(condicionActual.feeFijoMensual)} · Comisión: {condicionActual.esquemaComision}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={empresa.estado} />
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-border pt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                Historial de Condiciones Comerciales
              </h4>
              <div className="space-y-2">
                {empresa.condicionesComerciales.map((cc, i) => {
                  const isCurrent = i === empresa.condicionesComerciales.length - 1;
                  return (
                    <div
                      key={cc.id}
                      className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                        isCurrent ? "bg-success/5 border border-success/20" : "bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isCurrent ? "bg-success" : "bg-muted-foreground/30"}`} />
                        <div>
                          <span className="text-card-foreground font-medium">
                            Fee: {formatCLP(cc.feeFijoMensual)} · Comisión: {cc.esquemaComision}%
                          </span>
                          {cc.descripcion && (
                            <span className="text-muted-foreground ml-2 text-xs">— {cc.descripcion}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Desde {new Date(cc.fechaVigencia).toLocaleDateString("es-CL")}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
                            Vigente
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
