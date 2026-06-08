import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CategoriaCliente {
  id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

export interface ContactoCliente {
  id: string;
  cliente_id: string;
  contacto: string;
  email: string;
  telefono: string;
  orden: number;
  created_at: string;
}

export interface Cliente {
  id: string;
  categoria_id: string;
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  created_at: string;
  updated_at: string;
}

export interface ClienteWithCategoria extends Cliente {
  categorias_cliente: CategoriaCliente;
  contactos_cliente: ContactoCliente[];
}

export function useCategoriasCliente() {
  return useQuery({
    queryKey: ["categorias_cliente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_cliente")
        .select("*")
        .order("orden", { ascending: true });
      if (error) throw error;
      return data as CategoriaCliente[];
    },
  });
}

export function useCreateCategoriaCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { nombre: string; orden: number }) => {
      const { data, error } = await supabase.from("categorias_cliente").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias_cliente"] }); toast.success("Categoría creada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateCategoriaCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nombre: string }) => {
      const { error } = await supabase.from("categorias_cliente").update({ nombre: input.nombre }).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias_cliente"] }); toast.success("Categoría actualizada"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteCategoriaCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias_cliente").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categorias_cliente"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Categoría eliminada");
    },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useClientes() {
  return useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*, categorias_cliente(*), contactos_cliente(*)")
        .order("nombre", { ascending: true });
      if (error) throw error;
      // Sort contactos by orden
      return (data as ClienteWithCategoria[]).map(c => ({
        ...c,
        contactos_cliente: (c.contactos_cliente || []).sort((a, b) => a.orden - b.orden),
      }));
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      categoria_id: string;
      nombre: string;
      contactos: { contacto: string; email: string; telefono: string }[];
    }) => {
      const { data, error } = await supabase
        .from("clientes")
        .insert({ categoria_id: input.categoria_id, nombre: input.nombre })
        .select()
        .single();
      if (error) throw error;

      if (input.contactos.length > 0) {
        const rows = input.contactos.map((c, i) => ({
          cliente_id: data.id,
          contacto: c.contacto,
          email: c.email,
          telefono: c.telefono,
          orden: i,
        }));
        const { error: cErr } = await supabase.from("contactos_cliente").insert(rows);
        if (cErr) throw cErr;
      }
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente creado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      categoria_id: string;
      nombre: string;
      contactos: { id?: string; contacto: string; email: string; telefono: string }[];
    }) => {
      const { id, categoria_id, nombre, contactos } = input;
      const { error } = await supabase.from("clientes").update({ categoria_id, nombre }).eq("id", id);
      if (error) throw error;

      // Delete old contactos and re-insert
      const { error: delErr } = await supabase.from("contactos_cliente").delete().eq("cliente_id", id);
      if (delErr) throw delErr;
      if (contactos.length > 0) {
        const rows = contactos.map((c, i) => ({
          cliente_id: id,
          contacto: c.contacto,
          email: c.email,
          telefono: c.telefono,
          orden: i,
        }));
        const { error: cErr } = await supabase.from("contactos_cliente").insert(rows);
        if (cErr) throw cErr;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente actualizado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente eliminado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}
