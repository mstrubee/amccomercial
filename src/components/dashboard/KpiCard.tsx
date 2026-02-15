import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "success" | "info" | "warning";
  delay?: number;
  onClick?: () => void;
  active?: boolean;
}

const variantStyles = {
  default: "bg-card border-border",
  success: "bg-card border-success/20",
  info: "bg-card border-info/20",
  warning: "bg-card border-warning/20",
};

const activeStyles = {
  default: "ring-2 ring-foreground/20 border-foreground/30",
  success: "ring-2 ring-success/40 border-success/50",
  info: "ring-2 ring-info/40 border-info/50",
  warning: "ring-2 ring-warning/40 border-warning/50",
};

const iconStyles = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

export default function KpiCard({ title, value, subtitle, icon: Icon, variant = "default", delay = 0, onClick, active }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-all",
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-md",
        active && activeStyles[variant],
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-card-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
