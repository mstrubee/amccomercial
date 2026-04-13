import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Maps client category names to project contact field prefixes.
 */
const CAT_TO_PREFIX: Record<string, string> = {
  Arquitectura: "arq",
  Constructora: "const",
  ITO: "ito",
  Dueños: "duenos",
};

/**
 * Sync a client's updated data into all linked projects' denormalized contact fields.
 * Finds the client by matching `oldNombre` in the appropriate `{prefix}_nombre` field,
 * then replaces the matching row's data with the new values.
 */
export async function syncClienteToProyectos(
  clienteId: string,
  oldNombre: string,
  newNombre: string,
  categoriaNombre: string,
  contactos: { contacto: string; email: string; telefono: string }[]
) {
  const prefix = CAT_TO_PREFIX[categoriaNombre];
  if (!prefix) return 0;

  // Find linked projects
  const { data: links } = await supabase
    .from("proyecto_clientes")
    .select("proyecto_id")
    .eq("cliente_id", clienteId);

  if (!links || links.length === 0) return 0;

  const proyectoIds = links.map((l) => l.proyecto_id);
  const { data: proyectos } = await supabase
    .from("proyectos")
    .select("id, arq_nombre, arq_contacto, arq_mail, arq_telefono, const_nombre, const_contacto, const_mail, const_telefono, ito_nombre, ito_contacto, ito_mail, ito_telefono, duenos_nombre, duenos_contacto, duenos_mail, duenos_telefono")
    .in("id", proyectoIds);

  if (!proyectos || proyectos.length === 0) return 0;

  const contactoStr = contactos.map((c) => c.contacto).filter(Boolean).join(" / ");
  const emailStr = contactos.map((c) => c.email).filter(Boolean).join(" / ");
  const telefonoStr = contactos.map((c) => c.telefono).filter(Boolean).join(" / ");

  let updatedCount = 0;

  for (const p of proyectos) {
    const nombres = ((p as any)[`${prefix}_nombre`] as string || "").split(" / ");
    const contactosArr = ((p as any)[`${prefix}_contacto`] as string || "").split(" / ");
    const mails = ((p as any)[`${prefix}_mail`] as string || "").split(" / ");
    const telefonos = ((p as any)[`${prefix}_telefono`] as string || "").split(" / ");

    // Find the index where old name matches
    const idx = nombres.findIndex(
      (n) => n.trim().toLowerCase() === oldNombre.trim().toLowerCase()
    );
    if (idx === -1) continue;

    // Replace that index with new data
    nombres[idx] = newNombre;
    contactosArr[idx] = contactoStr;
    mails[idx] = emailStr;
    telefonos[idx] = telefonoStr;

    const updates: Record<string, string> = {
      [`${prefix}_nombre`]: nombres.join(" / "),
      [`${prefix}_contacto`]: contactosArr.join(" / "),
      [`${prefix}_mail`]: mails.join(" / "),
      [`${prefix}_telefono`]: telefonos.join(" / "),
    };

    const { error } = await supabase
      .from("proyectos")
      .update(updates as any)
      .eq("id", p.id);

    if (!error) updatedCount++;
  }

  return updatedCount;
}

/**
 * Sync project contact data back to the linked clients.
 * Called when saving a project form, for each contact row that has a clienteId.
 */
export async function syncProyectoToClientes(
  clienteUpdates: {
    clienteId: string;
    nombre: string;
    contactos: { contacto: string; email: string; telefono: string }[];
  }[]
) {
  let updatedCount = 0;

  for (const update of clienteUpdates) {
    // Update the client's name
    const { error: nameErr } = await supabase
      .from("clientes")
      .update({ nombre: update.nombre } as any)
      .eq("id", update.clienteId);
    if (nameErr) continue;

    // Delete old contactos and re-insert
    await supabase.from("contactos_cliente").delete().eq("cliente_id", update.clienteId);

    if (update.contactos.length > 0) {
      const rows = update.contactos.map((c, i) => ({
        cliente_id: update.clienteId,
        contacto: c.contacto,
        email: c.email,
        telefono: c.telefono,
        orden: i,
      }));
      await supabase.from("contactos_cliente").insert(rows);
    }

    updatedCount++;
  }

  return updatedCount;
}

/**
 * Hook that provides sync functions with query invalidation.
 */
export function useSyncClienteProyecto() {
  const qc = useQueryClient();

  const syncClienteToLinkedProyectos = async (
    clienteId: string,
    oldNombre: string,
    newNombre: string,
    categoriaNombre: string,
    contactos: { contacto: string; email: string; telefono: string }[]
  ) => {
    const count = await syncClienteToProyectos(
      clienteId,
      oldNombre,
      newNombre,
      categoriaNombre,
      contactos
    );
    if (count > 0) {
      qc.invalidateQueries({ queryKey: ["proyectos"] });
      toast.success(`${count} proyecto(s) actualizado(s) con datos del cliente`);
    }
  };

  const syncProyectoToLinkedClientes = async (
    clienteUpdates: {
      clienteId: string;
      nombre: string;
      contactos: { contacto: string; email: string; telefono: string }[];
    }[]
  ) => {
    if (clienteUpdates.length === 0) return;
    const count = await syncProyectoToClientes(clienteUpdates);
    if (count > 0) {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(`${count} cliente(s) actualizado(s) desde el proyecto`);
    }
  };

  return { syncClienteToLinkedProyectos, syncProyectoToLinkedClientes };
}
