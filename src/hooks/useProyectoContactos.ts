import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useLinkProyectoCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ proyecto_id, cliente_id, contacto_id }: { proyecto_id: string; cliente_id: string; contacto_id?: string | null }) => {
      // upsert: si el vínculo ya existe, actualiza el contacto elegido (nota #24 b)
      const { error } = await supabase
        .from("proyecto_clientes" as any)
        .upsert({ proyecto_id, cliente_id, contacto_id: contacto_id ?? null }, { onConflict: "proyecto_id,cliente_id", ignoreDuplicates: false });
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
      const { error } = await supabase
        .from("proyecto_captadores" as any)
        .upsert({ proyecto_id, captador_id }, { onConflict: "proyecto_id,captador_id", ignoreDuplicates: true });
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
