import { useState } from "react";
import { X as XIcon, UserPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { useClientes, useCreateCliente, useCategoriasCliente } from "@/hooks/useClientes";
import { useCaptadores, useCreateCaptador } from "@/hooks/useCaptadores";
import { useLinkProyectoCliente, useUnlinkProyectoCliente, useLinkProyectoCaptador, useUnlinkProyectoCaptador } from "@/hooks/useProyectoContactos";

interface Props {
  /** The "first" project of the group (all grupo items share same proyecto_clientes/captadores) */
  proyecto: ProyectoWithEmpresas;
  /** All items in the group (to gather all linked ids) */
  groupItems?: ProyectoWithEmpresas[];
}

export default function ContactosColumn({ proyecto, groupItems }: Props) {
  const items = groupItems || [proyecto];
  const { data: categoriasCliente } = useCategoriasCliente();

  const catLabelMap = new Map<string, string>();
  for (const cat of (categoriasCliente || [])) {
    catLabelMap.set(cat.id, cat.nombre);
  }

  // All project row IDs in this group — needed to link/unlink across all rows
  const allProyectoIds = items.map(p => p.id);

  // Gather unique linked clientes and captadores across ALL group rows
  const linkedClientes = new Map<string, string>();
  const linkedCaptadores = new Map<string, string>();
  for (const p of items) {
    for (const pc of (p.proyecto_clientes || [])) {
      if (pc.clientes) {
        const catLabel = catLabelMap.get(pc.clientes.categoria_id) || "";
        const display = catLabel ? `${pc.clientes.nombre} (${catLabel})` : pc.clientes.nombre;
        linkedClientes.set(pc.clientes.id, display);
      } else if (pc.cliente_id) {
        linkedClientes.set(pc.cliente_id, "(cliente sin datos)");
      }
    }
    for (const pc of (p.proyecto_captadores || [])) {
      if (pc.captadores) linkedCaptadores.set(pc.captadores.id, pc.captadores.nombre);
    }
  }

  return (
    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
      <ContactoPopover
        type="cliente"
        proyectoIds={allProyectoIds}
        linkedItems={linkedClientes}
        hasItems={linkedClientes.size > 0}
      />
      <ContactoPopover
        type="captador"
        proyectoIds={allProyectoIds}
        linkedItems={linkedCaptadores}
        hasItems={linkedCaptadores.size > 0}
      />
    </div>
  );
}

// ── Popover shell ────────────────────────────────────────────────────────────

function ContactoPopover({ type, proyectoIds, linkedItems, hasItems }: {
  type: "cliente" | "captador";
  proyectoIds: string[];
  linkedItems: Map<string, string>;
  hasItems: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = type === "cliente" ? "Clientes" : "Captadores";
  const colorClass = type === "cliente" ? "text-blue-600" : "text-red-600";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1 text-[11px] font-medium ${colorClass} hover:underline`}>
          {!hasItems && <XIcon className="w-3 h-3 text-destructive" />}
          {label}
        </button>
      </PopoverTrigger>
      {/* stopPropagation prevents row-click from firing while interacting inside */}
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()} // ← prevents erratic focus behavior
      >
        <ContactoPopoverContent
          key={open ? "open" : "closed"} // reset internal state when popover reopens
          type={type}
          proyectoIds={proyectoIds}
          linkedItems={linkedItems}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Popover body ─────────────────────────────────────────────────────────────

type Mode = "view" | "add";

function ContactoPopoverContent({ type, proyectoIds, linkedItems, onClose }: {
  type: "cliente" | "captador";
  proyectoIds: string[];
  linkedItems: Map<string, string>;
  onClose: () => void;
}) {
  const { data: clientes } = useClientes();
  const { data: captadores } = useCaptadores();
  const { data: categoriasCliente } = useCategoriasCliente();
  const createCliente  = useCreateCliente();
  const createCaptador = useCreateCaptador();
  const linkCliente    = useLinkProyectoCliente();
  const unlinkCliente  = useUnlinkProyectoCliente();
  const linkCaptador   = useLinkProyectoCaptador();
  const unlinkCaptador = useUnlinkProyectoCaptador();

  // Default: "view" — only shows linked list + button.
  // "add" — shows search + scrollable list (activated by pressing the button).
  const [mode, setMode] = useState<Mode>("view");
  const [search, setSearch] = useState("");

  const label    = type === "cliente" ? "Cliente" : "Captador";
  const allItems = (type === "cliente" ? (clientes || []) : (captadores || [])) as any[];

  // Set of already-linked display-names (lowercased) so duplicates are hidden
  const linkedNames = new Set(
    Array.from(linkedItems.values()).map(v => v.toLowerCase().split(" (")[0].trim())
  );

  const searchLower = search.trim().toLowerCase();

  const available = allItems.filter((c: any) => {
    if (linkedItems.has(c.id)) return false;
    if (linkedNames.has(c.nombre.toLowerCase().trim())) return false;
    if (searchLower && !c.nombre.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  // Show "Crear" button only when typed name doesn't match any available item exactly
  const showCreateBtn =
    searchLower.length > 0 &&
    !available.some((c: any) => c.nombre.toLowerCase().trim() === searchLower);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleLink = (id: string) => {
    const pid = proyectoIds[0];
    if (!pid) return;
    if (type === "cliente") linkCliente.mutate({ proyecto_id: pid, cliente_id: id });
    else                    linkCaptador.mutate({ proyecto_id: pid, captador_id: id });
    // Return to view after linking
    setMode("view");
    setSearch("");
  };

  const handleUnlink = (id: string) => {
    proyectoIds.forEach((pid) => {
      if (type === "cliente") unlinkCliente.mutate({ proyecto_id: pid, cliente_id: id });
      else                    unlinkCaptador.mutate({ proyecto_id: pid, captador_id: id });
    });
  };

  const handleCreate = () => {
    const name = search.trim();
    if (!name) return;

    // If already exists by name, just link it
    const existing = allItems.find(
      (c: any) => c.nombre.trim().toLowerCase() === name.toLowerCase()
    );
    if (existing) { handleLink(existing.id); return; }

    const catId = categoriasCliente?.[0]?.id || "";
    if (!catId) return;

    const mutate = type === "cliente" ? createCliente : createCaptador;
    mutate.mutate(
      { categoria_id: catId, nombre: name, contactos: [] } as any,
      {
        onSuccess: (data: any) => {
          handleLink(data.id);
        },
      }
    );
  };

  const linked = Array.from(linkedItems.entries());

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Linked clients — always visible ───────────────────────────────── */}
      <div className="p-2 border-b border-border">
        <p className="text-xs font-semibold text-foreground mb-1">{label}s vinculados</p>
        {linked.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguno</p>
        ) : (
          <div className="space-y-1">
            {linked.map(([id, nombre]) => (
              <div key={id} className="flex items-center justify-between text-xs">
                <span className="text-card-foreground">{nombre}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:text-destructive"
                  onClick={() => handleUnlink(id)}
                >
                  <XIcon className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── VIEW mode: just the "Crear nuevo" button ──────────────────────── */}
      {mode === "view" && (
        <div className="p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs gap-1"
            onClick={() => setMode("add")}
          >
            <UserPlus className="w-3 h-3" />
            Crear nuevo {label.toLowerCase()}
          </Button>
        </div>
      )}

      {/* ── ADD mode: search + scrollable list + optional create ──────────── */}
      {mode === "add" && (
        <>
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <Input
              placeholder={`Buscar ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs"
            />
          </div>

          {/* Scrollable list of available clients */}
          <div className="max-h-[160px] overflow-y-auto">
            {available.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {searchLower ? "Sin resultados" : "Escribe para buscar…"}
              </div>
            ) : (
              available.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  onClick={() => handleLink(c.id)}
                >
                  <div className="font-medium text-popover-foreground">{c.nombre}</div>
                </button>
              ))
            )}
          </div>

          {/* Footer: Cancel + optional Create */}
          <div className="border-t border-border p-2 flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setMode("view"); setSearch(""); }}
            >
              Cancelar
            </Button>
            {showCreateBtn && (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs flex-1 gap-1"
                onClick={handleCreate}
                disabled={createCliente.isPending || createCaptador.isPending}
              >
                <Plus className="w-3 h-3" />
                Crear "{search.trim()}"
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
