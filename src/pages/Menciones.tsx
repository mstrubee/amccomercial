import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AtSign, ChevronRight, Eye, EyeOff, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMyMentions, useToggleMentionRead, type ChecklistMentionRow } from "@/hooks/useChecklistMentions";
import { useMentionableUsers } from "@/hooks/useMentionableUsers";
import { splitTextWithMentions } from "@/lib/mention-utils";
import { BACK_TO_MENCIONES_KEY, BACK_TO_MENCIONES_EVENT } from "@/components/menciones/BackToMencionesFloat";

type Tab = "todas" | "no_leidas" | "leidas";

function MentionText({ text }: { text: string }) {
  const { data: users = [] } = useMentionableUsers();
  const handles = useMemo(() => new Set(users.map((u) => u.handle)), [users]);
  const parts = splitTextWithMentions(text, handles);
  if (parts.length === 0) return <span>{text}</span>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === "mention" ? (
          <span key={i} className="rounded bg-primary/15 text-primary px-1 font-medium">{p.value}</span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

export default function Menciones() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: mentions = [], isLoading } = useMyMentions(user?.id, isAdmin ? "all" : "mine");
  const toggleRead = useToggleMentionRead();
  const [tab, setTab] = useState<Tab>("no_leidas");
  const [filterProyecto, setFilterProyecto] = useState<string>("__all");
  const [filterUsuario, setFilterUsuario] = useState<string>("__all");

  const proyectoOptions = useMemo(() => {
    const map = new Map<string, string>();
    mentions.forEach((m) => {
      const key = m.proyecto_id || `__empresa_${m.empresa_id}`;
      const title = m.proyecto?.nombre || m.empresa?.nombre || "Sin proyecto";
      if (!map.has(key)) map.set(key, title);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [mentions]);

  const usuarioOptions = useMemo(() => {
    const map = new Map<string, string>();
    mentions.forEach((m) => {
      const name = m.mentioned?.display_name || "Sin nombre";
      if (!map.has(m.mentioned_user_id)) map.set(m.mentioned_user_id, name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [mentions]);

  const filtered = mentions.filter((m) => {
    if (tab === "leidas" && !m.is_read) return false;
    if (tab === "no_leidas" && m.is_read) return false;
    if (filterProyecto !== "__all") {
      const key = m.proyecto_id || `__empresa_${m.empresa_id}`;
      if (key !== filterProyecto) return false;
    }
    if (filterUsuario !== "__all" && m.mentioned_user_id !== filterUsuario) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; title: string; proyectoId: string | null; rows: ChecklistMentionRow[] }>();
    filtered.forEach((m) => {
      const key = m.proyecto_id || `__empresa_${m.empresa_id}`;
      const title = m.proyecto?.nombre || m.empresa?.nombre || "Sin proyecto";
      if (!map.has(key)) map.set(key, { key, title, proyectoId: m.proyecto_id, rows: [] });
      map.get(key)!.rows.push(m);
    });
    return Array.from(map.values());
  }, [filtered]);

  const counts = useMemo(() => ({
    total: mentions.length,
    no_leidas: mentions.filter((m) => !m.is_read).length,
    leidas: mentions.filter((m) => m.is_read).length,
  }), [mentions]);

  const goToProyecto = (proyectoId: string | null) => {
    if (!proyectoId) return;
    try { sessionStorage.setItem(BACK_TO_MENCIONES_KEY, "1"); } catch {}
    window.dispatchEvent(new Event(BACK_TO_MENCIONES_EVENT));
    navigate(`/proyectos?highlight=${proyectoId}`);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "no_leidas", label: "No leídas", count: counts.no_leidas },
    { key: "leidas", label: "Leídas", count: counts.leidas },
    { key: "todas", label: "Todas", count: counts.total },
  ];

  const filtersActive = filterProyecto !== "__all" || filterUsuario !== "__all";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AtSign className="w-7 h-7 text-primary" /> Menciones
          </h1>
          <p className="text-muted-foreground mt-1">Notas de checklist donde te mencionaron, agrupadas por proyecto.</p>
        </div>
      </motion.div>

      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label} <Badge variant="secondary" className="ml-1">{t.count}</Badge>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterProyecto} onValueChange={setFilterProyecto}>
          <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Filtrar por proyecto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todos los proyectos</SelectItem>
            {proyectoOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={filterUsuario} onValueChange={setFilterUsuario}>
            <SelectTrigger className="h-9 w-[220px]"><SelectValue placeholder="Filtrar por usuario mencionado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos los usuarios</SelectItem>
              {usuarioOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterProyecto("__all"); setFilterUsuario("__all"); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar filtros
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">No hay menciones en esta vista.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.key} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/40">
                <div className="font-semibold text-sm">{g.title}</div>
                {g.proyectoId && (
                  <Button size="sm" variant="ghost" onClick={() => goToProyecto(g.proyectoId)}>
                    Ir al proyecto <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-border">
                {g.rows.map((m) => {
                  const canToggle = !!user && (isAdmin || m.mentioned_user_id === user.id);
                  return (
                  <li key={m.id} className={cn("flex items-start gap-3 px-4 py-2", !m.is_read && "bg-primary/5")}>
                    <button
                      disabled={!canToggle}
                      onClick={() => canToggle && user && toggleRead.mutate({ mentionId: m.id, userId: user.id, read: !m.is_read })}
                      className={cn(
                        "mt-0.5 p-1 rounded",
                        canToggle ? "hover:bg-muted cursor-pointer" : "cursor-not-allowed opacity-40",
                        m.is_read ? "text-muted-foreground" : "text-primary",
                      )}
                      title={!canToggle ? "Solo el usuario mencionado o un admin pueden marcar" : m.is_read ? "Marcar como no leída" : "Marcar como leída"}
                    >
                      {m.is_read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.checklist_item?.created_at || m.created_at).toLocaleDateString("es-CL")}
                        {m.author?.display_name && <> · <span className="font-medium">{m.author.display_name}</span></>}
                        {isAdmin && m.mentioned?.display_name && (
                          <> · <span className="text-primary">para @{m.mentioned.display_name}</span></>
                        )}
                      </div>
                      <div className="text-sm mt-0.5 break-words">
                        <MentionText text={m.checklist_item?.text || ""} />
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}