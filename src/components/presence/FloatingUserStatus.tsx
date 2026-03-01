import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActivityThresholds, getActivityStatus, type ProfilePresence } from "@/hooks/useActivityThresholds";
import { useThemeSettings } from "@/hooks/useThemeSettings";

export default function FloatingUserStatus() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: thresholds } = useActivityThresholds();
  const { data: theme } = useThemeSettings();
  const pos = theme?.theme_floating_position || "bottom-left";
  const isBottom = pos.startsWith("bottom");
  const isLeft = pos.endsWith("left");

  const { data: profiles } = useQuery<ProfilePresence[]>({
    queryKey: ["presence-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, last_seen_at, activity_status, current_section")
        .order("display_name");
      return (data as ProfilePresence[]) || [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("presence-profiles-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["presence-profiles"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const onlineCount = (profiles || []).filter((p) => {
    if (!p.last_seen_at) return false;
    const t = thresholds?.find((th) => th.user_id === p.user_id);
    const offlineMs = (t?.offline_minutes ?? 15) * 60 * 1000;
    return Date.now() - new Date(p.last_seen_at).getTime() < offlineMs;
  }).length;

  return (
    <div className="relative">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute w-72 bg-card border border-border rounded-xl shadow-lg overflow-hidden",
              isBottom ? "bottom-full mb-2" : "top-full mt-2",
              isLeft ? "left-0" : "right-0",
            )}
          >
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">
                Usuarios ({onlineCount} en línea)
              </h3>
            </div>
            <ScrollArea className="max-h-72">
              <div className="py-1">
                {(profiles || []).map((p) => {
                  const s = getActivityStatus(p, thresholds);
                  return (
                    <div key={p.user_id} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/30 transition-colors">
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", s.color, s.pulse && "animate-pulse")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground truncate">{p.display_name || p.email}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{s.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        className={cn("w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors relative")}
      >
        <Users className="w-4 h-4" />
        {onlineCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 text-[10px] text-white flex items-center justify-center font-bold">
            {onlineCount}
          </span>
        )}
      </button>
    </div>
  );
}
