import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  Vigente: "bg-success/10 text-success border-success/20",
  Descartado: "bg-destructive/10 text-destructive border-destructive/20",
  "Todo Ofrecido": "bg-warning/10 text-warning border-warning/20",
  "Sin Respuesta": "bg-muted text-muted-foreground border-border",
  Activa: "bg-success/10 text-success border-success/20",
  Inactiva: "bg-muted text-muted-foreground border-border",
};

export default function StatusBadge({ status, color }: { status: string; color?: string }) {
  if (color) {
    return (
      <span
        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
        style={{
          backgroundColor: `${color}18`,
          color: color,
          borderColor: `${color}33`,
        }}
      >
        {status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        statusColors[status] || "bg-secondary text-secondary-foreground border-border"
      )}
    >
      {status}
    </span>
  );
}
