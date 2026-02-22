import { useState } from "react";
import { X as XIcon, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProyectoWithEmpresas } from "@/hooks/useProyectos";
import { useClientes, useCreateCliente, ClienteWithCategoria, useCategoriasCliente } from "@/hooks/useClientes";
import { useCaptadores, useCreateCaptador, CaptadorWithCategoria } from "@/hooks/useCaptadores";
import { useLinkProyectoCliente, useUnlinkProyectoCliente, useLinkProyectoCaptador, useUnlinkProyectoCaptador } from "@/hooks/useProyectoContactos";

interface Props {
  /** The "first" project of the group (all grupo items share same proyecto_clientes/captadores) */
  proyecto: ProyectoWithEmpresas;
  /** All items in the group (to gather all linked ids) */
  groupItems?: ProyectoWithEmpresas[];
}

export default function ContactosColumn({ proyecto, groupItems }: Props) {
  const items = groupItems || [proyecto];
  
  // Gather unique linked clientes and captadores across all group items
  const linkedClientes = new Map<string, string>();
  const linkedCaptadores = new Map<string, string>();
  for (const p of items) {
    for (const pc of (p.proyecto_clientes || [])) {
      if (pc.clientes) linkedClientes.set(pc.clientes.id, pc.clientes.nombre);
    }
    for (const pc of (p.proyecto_captadores || [])) {
      if (pc.captadores) linkedCaptadores.set(pc.captadores.id, pc.captadores.nombre);
    }
  }

  const hasClientes = linkedClientes.size > 0;
  const hasCaptadores = linkedCaptadores.size > 0;

  return (
    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
      <ContactoPopover
        type="cliente"
        proyectoId={proyecto.id}
        linkedItems={linkedClientes}
        hasItems={hasClientes}
      />
      <ContactoPopover
        type="captador"
        proyectoId={proyecto.id}
        linkedItems={linkedCaptadores}
        hasItems={hasCaptadores}
      />
    </div>
  );
}

function ContactoPopover({ type, proyectoId, linkedItems, hasItems }: {
  type: "cliente" | "captador";
  proyectoId: string;
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
      <PopoverContent className="w-72 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <ContactoPopoverContent type={type} proyectoId={proyectoId} linkedItems={linkedItems} onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

function ContactoPopoverContent({ type, proyectoId, linkedItems, onClose }: {
  type: "cliente" | "captador";
  proyectoId: string;
  linkedItems: Map<string, string>;
  onClose: () => void;
}) {
  const { data: clientes } = useClientes();
  const { data: captadores } = useCaptadores();
  const { data: categoriasCliente } = useCategoriasCliente();
  const createCliente = useCreateCliente();
  const createCaptador = useCreateCaptador();
  const linkCliente = useLinkProyectoCliente();
  const unlinkCliente = useUnlinkProyectoCliente();
  const linkCaptador = useLinkProyectoCaptador();
  const unlinkCaptador = useUnlinkProyectoCaptador();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newNombre, setNewNombre] = useState("");

  const label = type === "cliente" ? "Cliente" : "Captador";
  const allItems = type === "cliente" ? (clientes || []) : (captadores || []) as any[];
  const available = allItems.filter((c: any) => !linkedItems.has(c.id) && c.nombre.toLowerCase().includes(search.toLowerCase()));

  const handleLink = (id: string) => {
    if (type === "cliente") {
      linkCliente.mutate({ proyecto_id: proyectoId, cliente_id: id });
    } else {
      linkCaptador.mutate({ proyecto_id: proyectoId, captador_id: id });
    }
  };

  const handleUnlink = (id: string) => {
    if (type === "cliente") {
      unlinkCliente.mutate({ proyecto_id: proyectoId, cliente_id: id });
    } else {
      unlinkCaptador.mutate({ proyecto_id: proyectoId, captador_id: id });
    }
  };

  const handleCreate = () => {
    if (!newNombre.trim()) return;
    const catId = categoriasCliente?.[0]?.id || "";
    if (!catId) return;
    const mutate = type === "cliente" ? createCliente : createCaptador;
    mutate.mutate(
      { categoria_id: catId, nombre: newNombre.trim(), contactos: [] } as any,
      {
        onSuccess: (data: any) => {
          handleLink(data.id);
          setNewNombre("");
          setShowCreate(false);
        },
      }
    );
  };

  return (
    <div>
      <div className="p-2 border-b border-border">
        <p className="text-xs font-semibold text-foreground mb-1">{label}s vinculados</p>
        {linkedItems.size === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguno</p>
        ) : (
          <div className="space-y-1">
            {Array.from(linkedItems.entries()).map(([id, nombre]) => (
              <div key={id} className="flex items-center justify-between text-xs">
                <span className="text-card-foreground">{nombre}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-destructive" onClick={() => handleUnlink(id)}>
                  <XIcon className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {!showCreate ? (
        <>
          <div className="p-2">
            <Input placeholder={`Buscar ${label.toLowerCase()}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs" autoFocus />
          </div>
          <div className="max-h-[150px] overflow-y-auto">
            {available.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Sin resultados</div>
            ) : (
              available.map((c: any) => (
                <button key={c.id} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors" onClick={() => handleLink(c.id)}>
                  <div className="font-medium text-popover-foreground">{c.nombre}</div>
                </button>
              ))
            )}
          </div>
          <div className="border-t p-2">
            <Button type="button" variant="ghost" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => setShowCreate(true)}>
              <UserPlus className="w-3 h-3" /> Crear nuevo {label.toLowerCase()}
            </Button>
          </div>
        </>
      ) : (
        <div className="p-2 space-y-2">
          <Input placeholder="Nombre *" value={newNombre} onChange={(e) => setNewNombre(e.target.value)} className="h-7 text-xs" autoFocus />
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="button" size="sm" className="h-7 text-xs flex-1" onClick={handleCreate} disabled={!newNombre.trim()}>Crear</Button>
          </div>
        </div>
      )}
    </div>
  );
}
