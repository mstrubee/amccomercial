import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL = 30_000; // 30s
const IDLE_TIMEOUT = 120_000; // 2min

const ROUTE_SECTION_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/proyectos": "Proyectos",
  "/finanzas": "Finanzas",
  "/alertas": "Tareas y Alertas",
  "/clientes": "Clientes y Captadores",
  "/categorias": "Estatus (x Empresa)",
  "/estados-proyecto": "Estado (x Proyecto)",
  "/reporteria": "Reportería",
  "/usuarios": "Usuarios",
  "/empresas": "Empresas",
  "/carga-masiva": "Carga Masiva",
};

export function usePresenceHeartbeat(userId: string | undefined) {
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  const statusRef = useRef<"active" | "idle">("active");

  const currentSection =
    ROUTE_SECTION_MAP[location.pathname] || location.pathname;

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (statusRef.current !== "active") {
      statusRef.current = "active";
    }
  }, []);

  // Listen for user interactions
  useEffect(() => {
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
    };
  }, [markActive]);

  // Heartbeat interval
  useEffect(() => {
    if (!userId) return;

    const sendHeartbeat = async () => {
      const now = Date.now();
      const isIdle = now - lastActivityRef.current > IDLE_TIMEOUT;
      statusRef.current = isIdle ? "idle" : "active";

      await supabase
        .from("profiles")
        .update({
          last_seen_at: new Date().toISOString(),
          activity_status: statusRef.current,
          current_section: currentSection,
        })
        .eq("user_id", userId);
    };

    // Send immediately on mount / route change
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [userId, currentSection]);
}
