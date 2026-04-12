import { useState } from "react";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVentasByProyectoEmpresa, useCreateVenta, useDeleteVenta, VentaRow } from "@/hooks/useVentasProyectoEmpresa";
import { formatUF, formatCLP, ufToCLP } from "@/data/mock-data";

interface Props {
  proyectoEmpresaId: string | null;
}

export default function VentasEmpresaSection({ proyectoEmpresaId }: Props) {
  const { data: ventas } = useVentasByProyectoEmpresa(proyectoEmpresaId);
  const createVenta = useCreateVenta();
  const deleteVenta = useDeleteVenta();

  const [showForm, setShowForm] = useState(false);
  const [montoUf, setMontoUf] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [op, setOp] = useState("");

  if (!proyectoEmpresaId) return null;

  const total = (ventas || []).reduce((sum, v) => sum + Number(v.monto_uf), 0);

  const handleAdd = () => {
    const monto = parseFloat(montoUf);
    if (isNaN(monto)) return;
    createVenta.mutate(
      { proyecto_empresa_id: proyectoEmpresaId, monto_uf: monto, descripcion: descripcion.trim(), op: op.trim() },
      {
        onSuccess: () => {
          setMontoUf("");
          setDescripcion("");
          setOp("");
          setShowForm(false);
        },
      }
    );
  };

  return (
    <div className="mt-2 pl-6">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ventas
        </span>
        {(ventas && ventas.length > 0) && (
          <span className="text-[11px] font-semibold text-card-foreground">
            Total: {formatUF(total)} <span className="text-muted-foreground font-normal">≈ {formatCLP(ufToCLP(total))}</span>
          </span>
        )}
      </div>

      {ventas && ventas.length > 0 && (
        <div className="space-y-0.5 mb-1">
          {ventas.map((v) => (
            <div key={v.id} className="flex items-center gap-2 text-[11px] group">
              <span className={`font-medium ${Number(v.monto_uf) < 0 ? "text-destructive" : "text-card-foreground"}`}>
                {formatUF(Number(v.monto_uf))}
              </span>
              {v.op && (
                <span className="text-muted-foreground">OP: {v.op}</span>
              )}
              {v.descripcion && (
                <span className="text-muted-foreground truncate max-w-[200px]">— {v.descripcion}</span>
              )}
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                onClick={() => deleteVenta.mutate(v.id)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Input
            type="number"
            step={0.01}
            className="h-7 w-28 text-xs"
            placeholder="Monto UF"
            value={montoUf}
            onChange={(e) => setMontoUf(e.target.value)}
            autoFocus
          />
          <Input
            className="h-7 w-36 text-xs"
            placeholder="Descripción (opc.)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={handleAdd} disabled={createVenta.isPending || !montoUf}>
            Guardar
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => { setShowForm(false); setMontoUf(""); setDescripcion(""); }}>
            Cancelar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-3 h-3" />
          Nueva Venta
        </button>
      )}
    </div>
  );
}
