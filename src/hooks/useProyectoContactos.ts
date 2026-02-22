import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLinkProyectoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyecto_id, cliente_id }: { proyecto_id: string; cliente_id: string }) => {
      const { error } = await supabase.from("proyecto_clientes" as any).insert({ proyecto_id, cliente_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proyectos"] }); },
    onError: (e) => toast.error("Error al vincular cliente: " + e.message),
  });
}

export function useUnlinkProyectoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyecto_id, cliente_id }: { proyecto_id: string; cliente_id: string }) => {
      const { error } = await supabase.from("proyecto_clientes" as any).delete().eq("proyecto_id", proyecto_id).eq("cliente_id", cliente_id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proyectos"] }); },
    onError: (e) => toast.error("Error al desvincular cliente: " + e.message),
  });
}

export function useLinkProyectoCaptador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyecto_id, captador_id }: { proyecto_id: string; captador_id: string }) => {
      const { error } = await supabase.from("proyecto_captadores" as any).insert({ proyecto_id, captador_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proyectos"] }); },
    onError: (e) => toast.error("Error al vincular captador: " + e.message),
  });
}

export function useUnlinkProyectoCaptador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyecto_id, captador_id }: { proyecto_id: string; captador_id: string }) => {
      const { error } = await supabase.from("proyecto_captadores" as any).delete().eq("proyecto_id", proyecto_id).eq("captador_id", captador_id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proyectos"] }); },
    onError: (e) => toast.error("Error al desvincular captador: " + e.message),
  });
}
