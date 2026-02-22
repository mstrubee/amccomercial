import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ContactoCaptador {
  id: string;
  captador_id: string;
  contacto: string;
  email: string;
  telefono: string;
  orden: number;
  created_at: string;
}

export interface Captador {
  id: string;
  categoria_id: string;
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  created_at: string;
  updated_at: string;
}

export interface CaptadorWithCategoria extends Captador {
  categorias_cliente: { id: string; nombre: string; orden: number; created_at: string };
  contactos_captador: ContactoCaptador[];
}

export function useCaptadores() {
  return useQuery({
    queryKey: ["captadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("captadores" as any)
        .select("*, categorias_cliente(*), contactos_captador(*)")
        .order("nombre", { ascending: true });
      if (error) throw error;
      return (data as any as CaptadorWithCategoria[]).map(c => ({
        ...c,
        contactos_captador: (c.contactos_captador || []).sort((a: any, b: any) => a.orden - b.orden),
      }));
    },
  });
}

export function useCreateCaptador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoria_id: string;
      nombre: string;
      contactos: { contacto: string; email: string; telefono: string }[];
    }) => {
      const { data, error } = await supabase
        .from("captadores" as any)
        .insert({ categoria_id: input.categoria_id, nombre: input.nombre })
        .select()
        .single();
      if (error) throw error;

      if (input.contactos.length > 0) {
        const rows = input.contactos.map((c, i) => ({
          captador_id: (data as any).id,
          contacto: c.contacto,
          email: c.email,
          telefono: c.telefono,
          orden: i,
        }));
        const { error: cErr } = await supabase.from("contactos_captador" as any).insert(rows);
        if (cErr) throw cErr;
      }
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["captadores"] }); toast.success("Captador creado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateCaptador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      categoria_id: string;
      nombre: string;
      contactos: { id?: string; contacto: string; email: string; telefono: string }[];
    }) => {
      const { id, categoria_id, nombre, contactos } = input;
      const { error } = await supabase.from("captadores" as any).update({ categoria_id, nombre }).eq("id", id);
      if (error) throw error;

      await supabase.from("contactos_captador" as any).delete().eq("captador_id", id);
      if (contactos.length > 0) {
        const rows = contactos.map((c, i) => ({
          captador_id: id,
          contacto: c.contacto,
          email: c.email,
          telefono: c.telefono,
          orden: i,
        }));
        const { error: cErr } = await supabase.from("contactos_captador" as any).insert(rows);
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["captadores"] }); toast.success("Captador actualizado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteCaptador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("captadores" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["captadores"] }); toast.success("Captador eliminado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
