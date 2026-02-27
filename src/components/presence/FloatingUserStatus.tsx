import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Profile {
  user_id: string;
  display_name: string;
  email: string;
  last_seen_at: string | null;
  activity_status: string | null;
  current_section: string | null;
}

function getStatus(profile: Profile) {
  if (!profile.last_seen_at) {
    return { color: "bg-gray-400", text: "Sin actividad registrada", pulse: false };
  }
  const diff = Date.now() - new Date(profile.last_seen_at).getTime();
  const fiveMin = 5 * 60 * 1000;

  if (diff > fiveMin) {
    return {
      color: "bg-gray-400",
      text: `Visto: ${format(new Date(profile.last_seen_at), "dd/MM/yyyy HH:mm", { locale: es })}`,
      pulse: false,
    };
  }
  if (profile.activity_status === "idle") {
    return { color: "bg-amber-400", text: "Detenido", pulse: false };
  }
  return {
    color: "bg-green-500",
    text: `Trabajando en ${profile.current_section || "..."}`,
    pulse: true,
  };
}

export default function FloatingUserStatus() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: profiles } = useQuery<Profile[]>({
    queryKey: ["presence-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, last_seen_at, activity_status, current_section")
        .order("display_name");
      return (data as Profile[]) || [];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("presence-profiles-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => {
          qc.invalidateQueries({ queryKey: ["presence-profiles"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const onlineCount = (profiles || []).filter((p) => {
    if (!p.last_seen_at) return false;
    return Date.now() - new Date(p.last_seen_at).getTime() < 5 * 60 * 1000;
  }).length;

  return (
    <div className="fixed bottom-[52px] left-4 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="mb-2 w-72 bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">
                Usuarios ({onlineCount} en línea)
              </h3>
            </div>
            <ScrollArea className="max-h-72">
              <div className="py-1">
                {(profiles || []).map((p) => {
                  const s = getStatus(p);
                  return (
                    <div
                      key={p.user_id}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/30 transition-colors"
                    >
                      <span
                        className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0",
                          s.color,
                          s.pulse && "animate-pulse"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {p.display_name || p.email}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {s.text}
                        </p>
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
        className={cn(
          "w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors relative"
        )}
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
