import { useState, useMemo } from "react";
import { useActivityLog, useRetentionSetting, useUpdateRetention, useCleanupActivityLog } from "@/hooks/useActivityLog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Trash2, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const actionLabels: Record<string, string> = {
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
  completar: "Completar",
  restaurar: "Restaurar",
};

const entityLabels: Record<string, string> = {
  proyecto: "Proyecto",
  empresa: "Empresa",
  alerta: "Alerta",
  condicion: "Condición Comercial",
  cliente: "Cliente",
};

export default function Reporteria() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [retentionInput, setRetentionInput] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, display_name, email");
      if (error) throw error;
      return data;
    },
  });

  const { data: logs, isLoading } = useActivityLog({
    date: selectedDate,
    userId: selectedUser || undefined,
  });

  const { data: retentionDays } = useRetentionSetting();
  const updateRetention = useUpdateRetention();
  const cleanup = useCleanupActivityLog();

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles?.forEach((p) => { map[p.user_id] = p.display_name || p.email; });
    return map;
  }, [profiles]);

  const handleSaveRetention = () => {
    const days = parseInt(retentionInput);
    if (!days || days < 1) {
      toast.error("Ingrese un número válido de días");
      return;
    }
    updateRetention.mutate(days, {
      onSuccess: () => toast.success(`Retención actualizada a ${days} días`),
      onError: (e) => toast.error("Error: " + e.message),
    });
  };

  const handleCleanup = () => {
    cleanup.mutate(undefined, {
      onSuccess: (data: any) => toast.success(`Limpieza completada. ${data?.deleted || 0} registros eliminados.`),
      onError: (e) => toast.error("Error: " + e.message),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reportería de Actividad</h1>
          <p className="text-muted-foreground text-sm">Historial de acciones realizadas por los usuarios</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
          <Settings2 className="w-4 h-4 mr-2" /> Configuración
        </Button>
      </div>

      {showSettings && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Configuración de retención</h3>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Días de retención (actual: {retentionDays ?? "..."})</Label>
              <Input
                type="number"
                min={1}
                placeholder={String(retentionDays ?? 90)}
                value={retentionInput}
                onChange={(e) => setRetentionInput(e.target.value)}
                className="w-32"
              />
            </div>
            <Button size="sm" onClick={handleSaveRetention} disabled={updateRetention.isPending}>
              Guardar
            </Button>
            <Button size="sm" variant="destructive" onClick={handleCleanup} disabled={cleanup.isPending}>
              <Trash2 className="w-4 h-4 mr-1" />
              Limpiar historial antiguo
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Usuario</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Todos los usuarios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {profiles?.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.display_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !logs?.length ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No hay actividad registrada para esta fecha.</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Hora</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead className="w-24">Acción</TableHead>
                <TableHead className="w-36">Tipo</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Detalles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(log.created_at), "HH:mm:ss", { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm">{profileMap[log.user_id] || log.user_id}</TableCell>
                  <TableCell>
                    <span className="text-xs font-medium capitalize">{actionLabels[log.action] || log.action}</span>
                  </TableCell>
                  <TableCell className="text-sm">{entityLabels[log.entity_type] || log.entity_type}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{log.entity_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.details}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
