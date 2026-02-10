import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CategoriaCliente {
  id: string;
  nombre: string;
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
        .select("*, categorias_cliente(*)")
        .order("nombre", { ascending: true });
      if (error) throw error;
      return data as ClienteWithCategoria[];
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { categoria_id: string; nombre: string; contacto: string; email: string; telefono: string }) => {
      const { data, error } = await supabase.from("clientes").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente creado"); },
    onError: (e) => toast.error("Error: " + e.message),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; categoria_id: string; nombre: string; contacto: string; email: string; telefono: string }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("clientes").update(rest).eq("id", id);
      if (error) throw error;
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
