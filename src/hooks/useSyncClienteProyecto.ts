import { useState } from "react";
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

  let updatedCount = 0;

  // Only propagate the NAME change to projects.
  // Contact/email/telefono fields are project-specific (each project can have
  // a different contact person from the same firm) and must NOT be overwritten
  // by client-level updates — doing so mixes contacts across projects.
  for (const p of proyectos) {
    const nombres = ((p as any)[`${prefix}_nombre`] as string || "").split(" / ");

    const idx = nombres.findIndex(
      (n) => n.trim().toLowerCase() === oldNombre.trim().toLowerCase()
    );
    if (idx === -1) continue;

    // Only update if the name actually changed
    if (nombres[idx].trim() === newNombre.trim()) continue;

    nombres[idx] = newNombre;

    const updates: Record<string, string> = {
      [`${prefix}_nombre`]: nombres.join(" / "),
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
    // Update client name
    const { error: nameErr } = await supabase
      .from("clientes")
      .update({ nombre: update.nombre } as any)
      .eq("id", update.clienteId);
    if (nameErr) continue;

    if (update.contactos.length === 0) { updatedCount++; continue; }

    // Fetch existing contacts — we NEVER delete them, only add/update
    const { data: existing } = await supabase
      .from("contactos_cliente")
      .select("id, contacto, email, telefono, orden")
      .eq("cliente_id", update.clienteId)
      .order("orden", { ascending: true });

    const existingList = existing || [];
    let nextOrden = existingList.length > 0
      ? Math.max(...existingList.map(e => e.orden)) + 1
      : 0;

    for (const c of update.contactos) {
      if (!c.contacto && !c.email && !c.telefono) continue;

      // Try to find existing contact by name (case-insensitive exact match)
      const match = c.contacto
        ? existingList.find(
            e => e.contacto.trim().toLowerCase() === c.contacto.trim().toLowerCase()
          )
        : null;

      if (match) {
        // Only fill EMPTY fields — never overwrite data the user set in Clientes
        const patches: Record<string, string> = {};
        if (!match.email && c.email) patches.email = c.email;
        if (!match.telefono && c.telefono) patches.telefono = c.telefono;
        if (Object.keys(patches).length > 0) {
          await supabase.from("contactos_cliente").update(patches).eq("id", match.id);
        }
      } else if (c.contacto) {
        // New person not yet in client's contact list → add them
        await supabase.from("contactos_cliente").insert({
          cliente_id: update.clienteId,
          contacto: c.contacto,
          email: c.email || "",
          telefono: c.telefono || "",
          orden: nextOrden++,
        });
      }
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
 * One-time bulk recovery: scan ALL clients, find empty contact fields, fill
 * them from linked projects, and persist to DB.  Safe to run more than once —
 * it never overwrites data that already exists.
 *
 * Returns { recovered, skipped, errors } where:
 *   recovered = number of clients that got at least one field filled
 *   skipped   = clients that already had complete data (nothing to do)
 *   errors    = list of client names where something went wrong
 */
export async function recoverAllClienteContacts(): Promise<{
  recovered: number;
  skipped: number;
  errors: string[];
}> {
  // Fetch all clients with their contacts and categories in one query
  const { data: clientes, error: fetchErr } = await supabase
    .from("clientes")
    .select("id, nombre, categoria_id, categorias_cliente(nombre), contactos_cliente(id, contacto, email, telefono, orden)")
    .order("nombre");

  if (fetchErr || !clientes) {
    return { recovered: 0, skipped: 0, errors: [fetchErr?.message || "Error al obtener clientes"] };
  }

  let recovered = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const raw of clientes as any[]) {
    const catNombre: string = raw.categorias_cliente?.nombre || "";
    if (!catNombre) { skipped++; continue; }

    const currentContactos: { contacto: string; email: string; telefono: string }[] =
      (raw.contactos_cliente || [])
        .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
        .map((c: any) => ({
          contacto: c.contacto || "",
          email: c.email || "",
          telefono: c.telefono || "",
        }));

    try {
      const merged = await complementClienteFromProyectos(
        raw.id,
        raw.nombre,
        catNombre,
        currentContactos
      );

      if (!merged) { skipped++; continue; }  // Nothing to recover for this client

      // Write changes to DB — same logic as ClienteDetailDialog complement persist
      let dbChanged = false;
      const existingRows: any[] = (raw.contactos_cliente || []).sort(
        (a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0)
      );

      for (let i = 0; i < merged.length; i++) {
        const c = merged[i];
        const existing = existingRows[i];

        if (existing) {
          const patches: Record<string, string> = {};
          if (!existing.contacto && c.contacto) patches.contacto = c.contacto;
          if (!existing.email && c.email) patches.email = c.email;
          if (!existing.telefono && c.telefono) patches.telefono = c.telefono;
          if (Object.keys(patches).length > 0) {
            const { error } = await supabase
              .from("contactos_cliente")
              .update(patches)
              .eq("id", existing.id);
            if (error) errors.push(`${raw.nombre}: ${error.message}`);
            else dbChanged = true;
          }
        } else if (c.contacto || c.email || c.telefono) {
          const { error } = await supabase.from("contactos_cliente").insert({
            cliente_id: raw.id,
            contacto: c.contacto || "",
            email: c.email || "",
            telefono: c.telefono || "",
            orden: i,
          });
          if (error) errors.push(`${raw.nombre}: ${error.message}`);
          else dbChanged = true;
        }
      }

      if (dbChanged) recovered++;
      else skipped++;
    } catch (e: any) {
      errors.push(`${raw.nombre}: ${e?.message || "Error desconocido"}`);
    }
  }

  return { recovered, skipped, errors };
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

  /**
   * Bulk-recover all clients from project data (admin-only, one-time action).
   * Shows toast on completion and invalidates the clientes cache.
   */
  const [recovering, setRecovering] = useState(false);
  const runRecoverAllContacts = async () => {
    if (recovering) return;
    setRecovering(true);
    try {
      const { recovered, skipped, errors } = await recoverAllClienteContacts();
      if (errors.length > 0) {
        toast.error(`Recuperación parcial: ${recovered} recuperado(s), ${errors.length} error(es)`);
        console.error("Errores en recuperación:", errors);
      } else if (recovered === 0) {
        toast.info("No se encontraron campos vacíos que recuperar.");
      } else {
        toast.success(`✅ ${recovered} cliente(s) recuperado(s) con datos de proyectos vinculados`);
      }
      if (recovered > 0) qc.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e: any) {
      toast.error("Error en recuperación: " + (e?.message || ""));
    } finally {
      setRecovering(false);
    }
  };

  return {
    syncClienteToLinkedProyectos,
    syncProyectoToLinkedClientes,
    complementClienteFromLinkedProyectos,
    complementClienteFromProject,
    runRecoverAllContacts,
    recovering,
  };
}
