import { useState, useMemo } from "react";
import { useEmpresas } from "@/hooks/useEmpresas";
import { useProyectos } from "@/hooks/useProyectos";
import { useAllChecklistItems, ChecklistItem } from "@/hooks/useEmpresaChecklist";
import { useCategorias } from "@/hooks/useCategorias";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Building2, Search, ChevronDown, ChevronsUpDown, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import EmpresaChecklistPanel from "@/components/empresas/EmpresaChecklistPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function ReunionesPage() {
  const navigate = useNavigate();
  const { data: empresas = [] } = useEmpresas();
  const { data: proyectos = [] } = useProyectos();
  const { data: allItems = [] } = useAllChecklistItems();
  const { data: categorias = [] } = useCategorias();
  const [search, setSearch] = useState("");
  const [filterEmpresaIds, setFilterEmpresaIds] = useState<string[]>([]);
  const [filterProyectoIds, setFilterProyectoIds] = useState<string[]>([]);
  // Filter values: "cat:<id>" for category, "sub:<id>" for subcategory
  const [filterEstatusKeys, setFilterEstatusKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  // Build groups: proyecto -> empresa -> items
  const groups = useMemo(() => {
    const result: { proyectoId: string; proyectoName: string; empresaId: string; empresaName: string; items: ChecklistItem[]; categoriaId: string | null; subcategoriaId: string | null }[] = [];

    // Get unique proyecto+empresa combos from items
    const combos = new Map<string, { proyectoId: string; empresaId: string; items: ChecklistItem[] }>();
    allItems.forEach(item => {
      if (!item.proyecto_id || !item.empresa_id) return;
      const key = `${item.proyecto_id}|${item.empresa_id}`;
      if (!combos.has(key)) combos.set(key, { proyectoId: item.proyecto_id, empresaId: item.empresa_id, items: [] });
      combos.get(key)!.items.push(item);
    });

    combos.forEach(({ proyectoId, empresaId, items }) => {
      const proy = proyectos.find(p => p.id === proyectoId);
      const emp = empresas.find(e => e.id === empresaId);
      if (!proy || !emp) return;
      const pe = (proy as any).proyecto_empresas?.find((x: any) => x.empresa_id === empresaId);
      result.push({
        proyectoId,
        proyectoName: proy.nombre,
        empresaId,
        empresaName: emp.nombre,
        items,
        categoriaId: pe?.categoria_id ?? null,
        subcategoriaId: pe?.subcategoria_id ?? null,
      });
    });

    return result.sort((a, b) => a.proyectoName.localeCompare(b.proyectoName));
  }, [allItems, proyectos, empresas]);

  // Apply filters
  const filtered = useMemo(() => {
    let g = groups;
    if (filterProyectoIds.length > 0) g = g.filter(x => filterProyectoIds.includes(x.proyectoId));
    if (filterEmpresaIds.length > 0) g = g.filter(x => filterEmpresaIds.includes(x.empresaId));
    if (filterEstatusKeys.length > 0) {
      g = g.filter(x => {
        const catKey = x.categoriaId ? `cat:${x.categoriaId}` : null;
        const subKey = x.subcategoriaId ? `sub:${x.subcategoriaId}` : null;
        return (catKey && filterEstatusKeys.includes(catKey)) || (subKey && filterEstatusKeys.includes(subKey));
      });
    }
    if (search) {
      const s = search.toLowerCase();
      g = g.filter(x => {
        // Search in project name, empresa name
        if (x.proyectoName.toLowerCase().includes(s)) return true;
        if (x.empresaName.toLowerCase().includes(s)) return true;
        // Search in checklist item texts
        if (x.items.some(i => i.text.toLowerCase().includes(s))) return true;
        // Search in empresa notas_atencion_especial
        const emp = empresas.find(e => e.id === x.empresaId);
        if (emp && (emp as any).notas_atencion_especial?.toLowerCase().includes(s)) return true;
        return false;
      });
    }
    return g;
  }, [groups, filterProyectoIds, filterEmpresaIds, filterEstatusKeys, search, empresas]);

  // Unique empresas/proyectos that have checklist items
  const uniqueEmpresas = useMemo(() => {
    const ids = new Set(groups.map(g => g.empresaId));
    return empresas.filter(e => ids.has(e.id));
  }, [groups, empresas]);

  const uniqueProyectos = useMemo(() => {
    const ids = new Set(groups.map(g => g.proyectoId));
    return proyectos.filter(p => ids.has(p.id));
  }, [groups, proyectos]);

  const toggleAll = () => {
    const allExpanded = filtered.every(g => expandedKeys[`${g.proyectoId}|${g.empresaId}`]);
    const newKeys = { ...expandedKeys };
    filtered.forEach(g => { newKeys[`${g.proyectoId}|${g.empresaId}`] = !allExpanded; });
    setExpandedKeys(newKeys);
  };

  // Stats
  const totalItems = filtered.reduce((acc, g) => acc + g.items.length, 0);
  const completedItems = filtered.reduce((acc, g) => acc + g.items.filter(i => i.is_completed).length, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b pb-3 mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Reuniones</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {completedItems}/{totalItems} completados · {filtered.length} registros
        </span>

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-48" />
        </div>

        {/* Proyecto filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Proyecto {filterProyectoIds.length > 0 && `(${filterProyectoIds.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 max-h-60 overflow-y-auto p-2">
            {uniqueProyectos.map(p => (
              <label key={p.id} className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-muted rounded cursor-pointer">
                <Checkbox
                  checked={filterProyectoIds.includes(p.id)}
                  onCheckedChange={c => setFilterProyectoIds(prev => c ? [...prev, p.id] : prev.filter(x => x !== p.id))}
                />
                {p.nombre}
              </label>
            ))}
            {filterProyectoIds.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setFilterProyectoIds([])}>Limpiar</Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Empresa filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Empresa {filterEmpresaIds.length > 0 && `(${filterEmpresaIds.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 max-h-60 overflow-y-auto p-2">
            {uniqueEmpresas.map(e => (
              <label key={e.id} className="flex items-center gap-2 py-1 px-2 text-sm hover:bg-muted rounded cursor-pointer">
                <Checkbox
                  checked={filterEmpresaIds.includes(e.id)}
                  onCheckedChange={c => setFilterEmpresaIds(prev => c ? [...prev, e.id] : prev.filter(x => x !== e.id))}
                />
                {e.nombre}
              </label>
            ))}
            {filterEmpresaIds.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setFilterEmpresaIds([])}>Limpiar</Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Estatus (x Empresa) filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              Estatus (x Empresa) {filterEstatusKeys.length > 0 && `(${filterEstatusKeys.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 max-h-72 overflow-y-auto p-2">
            {categorias.map(cat => {
              const catKey = `cat:${cat.id}`;
              return (
                <div key={cat.id} className="mb-1">
                  <label className="flex items-center gap-2 py-1 px-2 text-sm font-medium hover:bg-muted rounded cursor-pointer">
                    <Checkbox
                      checked={filterEstatusKeys.includes(catKey)}
                      onCheckedChange={c => setFilterEstatusKeys(prev => c ? [...prev, catKey] : prev.filter(x => x !== catKey))}
                    />
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: cat.color }} />
                    {cat.nombre}
                  </label>
                  {cat.subcategorias_proyecto.map(sub => {
                    const subKey = `sub:${sub.id}`;
                    return (
                      <label key={sub.id} className="flex items-center gap-2 py-1 pl-7 pr-2 text-xs hover:bg-muted rounded cursor-pointer">
                        <Checkbox
                          checked={filterEstatusKeys.includes(subKey)}
                          onCheckedChange={c => setFilterEstatusKeys(prev => c ? [...prev, subKey] : prev.filter(x => x !== subKey))}
                        />
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: sub.color }} />
                        {sub.nombre}
                      </label>
                    );
                  })}
                </div>
              );
            })}
            {filterEstatusKeys.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setFilterEstatusKeys([])}>Limpiar</Button>
            )}
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" onClick={toggleAll}>
          <ChevronsUpDown className="w-4 h-4 mr-1" /> Expandir/Contraer
        </Button>
      </div>

      {/* List */}
      <div className="flex-1 space-y-3 overflow-auto">
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {allItems.length === 0 ? "No hay ítems de checklist aún. Crea uno desde las notas de un proyecto." : "Sin resultados para los filtros aplicados."}
          </p>
        )}
        {filtered.map(group => {
          const key = `${group.proyectoId}|${group.empresaId}`;
          const isExpanded = expandedKeys[key] ?? false;
          const completed = group.items.filter(i => i.is_completed).length;
          return (
            <Card key={key}>
              <Collapsible open={isExpanded} onOpenChange={() => setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }))}>
                <CardHeader className="py-3 px-4">
                  <CollapsibleTrigger className="flex items-center gap-3 w-full text-left">
                    <ChevronDown className={cn("w-4 h-4 transition-transform shrink-0", !isExpanded && "-rotate-90")} />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold">{group.proyectoName}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{group.empresaName}</span>
                        <span className="text-xs text-muted-foreground">· {completed}/{group.items.length} completados</span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0 px-4 pb-4">
                    <EmpresaChecklistPanel empresaId={group.empresaId} proyectoId={group.proyectoId} />
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
