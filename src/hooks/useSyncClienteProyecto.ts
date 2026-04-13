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

const PREFIX_TO_CAT: Record<string, string> = {
  arq: "Arquitectura",
  const: "Constructora",
  ito: "ITO",
  duenos: "Dueños",
};

const ALL_PREFIXES = ["arq", "const", "ito", "duenos"];

/**
 * Sync a client's updated data into all linked projects' denormalized contact fields.
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

    const idx = nombres.findIndex(
      (n) => n.trim().toLowerCase() === oldNombre.trim().toLowerCase()
    );
    if (idx === -1) continue;

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
    const { error: nameErr } = await supabase
      .from("clientes")
      .update({ nombre: update.nombre } as any)
      .eq("id", update.clienteId);
    if (nameErr) continue;

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
 * Complement a client's empty contact fields from linked projects.
 * Returns the complemented contactos array if changes were made, null otherwise.
 */
export async function complementClienteFromProyectos(
  clienteId: string,
  clienteNombre: string,
  categoriaNombre: string,
  currentContactos: { contacto: string; email: string; telefono: string }[]
): Promise<{ contacto: string; email: string; telefono: string }[] | null> {
  const prefix = CAT_TO_PREFIX[categoriaNombre];
  if (!prefix) return null;

  const { data: links } = await supabase
    .from("proyecto_clientes")
    .select("proyecto_id")
    .eq("cliente_id", clienteId);

  if (!links || links.length === 0) return null;

  const proyectoIds = links.map((l) => l.proyecto_id);
  const { data: proyectos } = await supabase
    .from("proyectos")
    .select("id, arq_nombre, arq_contacto, arq_mail, arq_telefono, const_nombre, const_contacto, const_mail, const_telefono, ito_nombre, ito_contacto, ito_mail, ito_telefono, duenos_nombre, duenos_contacto, duenos_mail, duenos_telefono")
    .in("id", proyectoIds);

  if (!proyectos || proyectos.length === 0) return null;

  // Merge contacto, email, telefono from projects into client's empty fields
  let changed = false;
  const merged = currentContactos.map(c => ({ ...c }));

  // If client has no contactos at all, try to build from projects
  if (merged.length === 0) {
    for (const p of proyectos) {
      const nombres = ((p as any)[`${prefix}_nombre`] as string || "").split(" / ");
      const idx = nombres.findIndex(
        (n) => n.trim().toLowerCase() === clienteNombre.trim().toLowerCase()
      );
      if (idx === -1) continue;

      const contactoVal = ((p as any)[`${prefix}_contacto`] as string || "").split(" / ")[idx]?.trim() || "";
      const emailVal = ((p as any)[`${prefix}_mail`] as string || "").split(" / ")[idx]?.trim() || "";
      const telefonoVal = ((p as any)[`${prefix}_telefono`] as string || "").split(" / ")[idx]?.trim() || "";

      if (contactoVal || emailVal || telefonoVal) {
        merged.push({ contacto: contactoVal, email: emailVal, telefono: telefonoVal });
        changed = true;
        break; // Take from first project that has data
      }
    }
  } else {
    // Fill empty fields in existing contactos
    for (let ci = 0; ci < merged.length; ci++) {
      const c = merged[ci];
      if (c.contacto && c.email && c.telefono) continue; // All filled

      for (const p of proyectos) {
        const nombres = ((p as any)[`${prefix}_nombre`] as string || "").split(" / ");
        const idx = nombres.findIndex(
          (n) => n.trim().toLowerCase() === clienteNombre.trim().toLowerCase()
        );
        if (idx === -1) continue;

        const contactoVal = ((p as any)[`${prefix}_contacto`] as string || "").split(" / ")[idx]?.trim() || "";
        const emailVal = ((p as any)[`${prefix}_mail`] as string || "").split(" / ")[idx]?.trim() || "";
        const telefonoVal = ((p as any)[`${prefix}_telefono`] as string || "").split(" / ")[idx]?.trim() || "";

        if (!c.contacto && contactoVal) { c.contacto = contactoVal; changed = true; }
        if (!c.email && emailVal) { c.email = emailVal; changed = true; }
        if (!c.telefono && telefonoVal) { c.telefono = telefonoVal; changed = true; }
        break;
      }
    }
  }

  return changed ? merged : null;
}

/**
 * Complement project's empty contact fields back to the client record.
 * Only fills empty client fields, never overwrites.
 */
export async function complementClienteFromProyectoData(
  clienteId: string,
  clienteNombre: string,
  categoriaNombre: string,
  projectContacto: string,
  projectEmail: string,
  projectTelefono: string
) {
  // Get current client contactos
  const { data: currentContactos } = await supabase
    .from("contactos_cliente")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("orden", { ascending: true });

  if (!currentContactos) return false;

  let changed = false;

  if (currentContactos.length === 0) {
    // No contactos at all - create from project data if any exists
    if (projectContacto || projectEmail || projectTelefono) {
      await supabase.from("contactos_cliente").insert({
        cliente_id: clienteId,
        contacto: projectContacto || "",
        email: projectEmail || "",
        telefono: projectTelefono || "",
        orden: 0,
      });
      changed = true;
    }
  } else {
    // Fill empty fields in first contacto
    const first = currentContactos[0];
    const updates: Record<string, string> = {};
    if (!first.contacto && projectContacto) { updates.contacto = projectContacto; changed = true; }
    if (!first.email && projectEmail) { updates.email = projectEmail; changed = true; }
    if (!first.telefono && projectTelefono) { updates.telefono = projectTelefono; changed = true; }

    if (changed) {
      await supabase.from("contactos_cliente").update(updates).eq("id", first.id);
    }
  }

  return changed;
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

  /**
   * Complement a client's empty fields from its linked projects.
   * Returns the merged contactos if changes found, null otherwise.
   */
  const complementClienteFromLinkedProyectos = async (
    clienteId: string,
    clienteNombre: string,
    categoriaNombre: string,
    currentContactos: { contacto: string; email: string; telefono: string }[]
  ) => {
    return complementClienteFromProyectos(clienteId, clienteNombre, categoriaNombre, currentContactos);
  };

  /**
   * Push project data to a client's empty fields.
   */
  const complementClienteFromProject = async (
    clienteId: string,
    clienteNombre: string,
    categoriaNombre: string,
    projectContacto: string,
    projectEmail: string,
    projectTelefono: string
  ) => {
    const changed = await complementClienteFromProyectoData(
      clienteId, clienteNombre, categoriaNombre, projectContacto, projectEmail, projectTelefono
    );
    if (changed) {
      qc.invalidateQueries({ queryKey: ["clientes"] });
    }
    return changed;
  };

  return {
    syncClienteToLinkedProyectos,
    syncProyectoToLinkedClientes,
    complementClienteFromLinkedProyectos,
    complementClienteFromProject,
  };
}
