import { useState, useMemo } from "react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Building2, Search, ChevronDown, ChevronsUpDown, Plus, X, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import EmpresaChecklistPanel from "@/components/empresas/EmpresaChecklistPanel";
import { useEmpresaChecklistItems } from "@/hooks/useEmpresaChecklist";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AtencionEmpresasPage() {
  const navigate = useNavigate();
  const { data: empresas = [] } = useEmpresas();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");

  const selectedEmpresas = useMemo(() =>
    empresas.filter(e => selectedIds.includes(e.id)),
    [empresas, selectedIds]
  );

  const filtered = useMemo(() => {
    if (!search) return selectedEmpresas;
    const s = search.toLowerCase();
    return selectedEmpresas.filter(e => e.nombre.toLowerCase().includes(s));
  }, [selectedEmpresas, search]);

  const toggleAll = () => {
    const allExpanded = filtered.every(e => expandedIds[e.id]);
    const newExpanded = { ...expandedIds };
    filtered.forEach(e => { newExpanded[e.id] = !allExpanded; });
    setExpandedIds(newExpanded);
  };

  const handleAdd = (id: string) => {
    if (id && !selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
      setExpandedIds(prev => ({ ...prev, [id]: true }));
    }
    setAddValue("");
  };

  const handleRemove = () => {
    if (removeTarget) {
      setSelectedIds(prev => prev.filter(id => id !== removeTarget));
      setRemoveTarget(null);
    }
  };

  const availableToAdd = empresas.filter(e => !selectedIds.includes(e.id));

  return (
    <div className="h-full flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b pb-3 mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Atención Especial Empresas</h1>
        </div>

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 w-60"
          />
        </div>

        <Button variant="outline" size="sm" onClick={toggleAll}>
          <ChevronsUpDown className="w-4 h-4 mr-1" />
          Expandir/Contraer
        </Button>

        <Select value={addValue} onValueChange={handleAdd}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Agregar empresa..." />
          </SelectTrigger>
          <SelectContent>
            {availableToAdd.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-auto">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {selectedIds.length === 0 ? "Selecciona una empresa para comenzar" : "Sin resultados"}
          </p>
        )}
        {filtered.map(empresa => (
          <EmpresaCard
            key={empresa.id}
            empresa={empresa}
            expanded={expandedIds[empresa.id] ?? false}
            onToggle={() => setExpandedIds(prev => ({ ...prev, [empresa.id]: !prev[empresa.id] }))}
            onRemove={() => setRemoveTarget(empresa.id)}
          />
        ))}
      </div>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={open => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar empresa de la lista</AlertDialogTitle>
            <AlertDialogDescription>
              Solo se quitará de esta vista. No se eliminará de la base de datos y el historial del checklist se preservará.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Quitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmpresaCard({ empresa, expanded, onToggle, onRemove }: {
  empresa: { id: string; nombre: string; estado: string };
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-3">
            <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left">
              <ChevronDown className={cn("w-4 h-4 transition-transform shrink-0", !expanded && "-rotate-90")} />
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <CardTitle className="text-sm font-semibold">{empresa.nombre}</CardTitle>
              <span className="text-xs text-muted-foreground ml-2">{empresa.estado}</span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <EmpresaChecklistPanel
              empresaId={empresa.id}
              notasAtencion={(empresa as any).notas_atencion_especial || ""}
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
