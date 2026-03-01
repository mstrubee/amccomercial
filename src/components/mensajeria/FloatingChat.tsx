import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  X,
  ArrowLeft,
  Send,
  Plus,
  Loader2,
  Search,
  Trash2,
  Settings,
  Volume2,
  VolumeX,
  Upload,
  FolderKanban,
  Building2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages, Message } from "@/hooks/useMessages";
import { useChatPreferences, SoundOption, createBeepSound } from "@/hooks/useChatPreferences";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type View = "list" | "chat" | "new" | "settings";
type SubsectionScope = "all" | "general" | `empresa:${string}`;

const SOUND_OPTIONS: { value: SoundOption; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "icq", label: "Estilo ICQ" },
  { value: "bell", label: "Campana" },
  { value: "ding", label: "Ding" },
  { value: "mute", label: "Silenciar" },
  { value: "custom", label: "Personalizado" },
];

interface ProjectContext {
  id: string;
  name: string;
}

interface OpenProjectChatDetail {
  projectId: string;
  projectName: string;
  empresaId?: string | null;
  empresaName?: string | null;
}

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [messageText, setMessageText] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [searchMessages, setSearchMessages] = useState("");
  const [searchConversations, setSearchConversations] = useState("");
  const [searchProject, setSearchProject] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "message" | "conversation"; id: string } | null>(null);
  const [contextProject, setContextProject] = useState<ProjectContext | null>(null);
  const [subsectionScope, setSubsectionScope] = useState<SubsectionScope>("all");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [newEmpresaId, setNewEmpresaId] = useState<string>("general");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [chatSize, setChatSize] = useState<{ w: number; h: number }>({ w: 360, h: 540 });
  const isResizingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingContextOpenRef = useRef<OpenProjectChatDetail | null>(null);

  const { user, isAdmin } = useAuth();
  const { data: theme } = useThemeSettings();
  const pos = theme?.theme_floating_position || "left-14";
  const side = pos.split("-")[0];
  const isBottom = side === "left" || side === "right";
  const isLeft = side === "left" || side === "bottom";

  const { prefs, updatePrefs, uploadCustomSound, playNotificationSound } = useChatPreferences(user);
  const isSoundMuted = (prefs?.sound_option || "pop") === "mute";

  const toggleFabSound = () => {
    if (isSoundMuted) {
      updatePrefs.mutate({ sound_option: "pop", custom_sound_url: prefs?.custom_sound_url ?? null });
    } else {
      updatePrefs.mutate({ sound_option: "mute", custom_sound_url: prefs?.custom_sound_url ?? null });
    }
  };
  const {
    conversations,
    messages,
    loadingConversations,
    loadingMessages,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    createConversation,
    markAsRead,
    markMessageRead,
    deleteMessage,
    deleteConversation,
    totalUnread,
  } = useMessages({ projectId: contextProject?.id });

  const { data: projects = [] } = useQuery({
    queryKey: ["chat-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("proyectos").select("id, nombre").order("nombre");
      return data || [];
    },
    enabled: open,
  });

  const { data: projectCompanies = [] } = useQuery({
    queryKey: ["chat-project-companies"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("proyecto_empresas")
        .select("proyecto_id, empresa_id, empresas:empresa_id(nombre)");
      return data || [];
    },
    enabled: open,
  });

  const companiesByProject = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    for (const row of projectCompanies as any[]) {
      const projectId = row.proyecto_id as string;
      const empresaId = row.empresa_id as string;
      const name = row.empresas?.nombre || "Empresa";
      if (!map[projectId]) map[projectId] = [];
      if (!map[projectId].some((e) => e.id === empresaId)) map[projectId].push({ id: empresaId, name });
    }
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [projectCompanies]);

  const companyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(companiesByProject)
      .flat()
      .forEach((e) => {
        map[e.id] = e.name;
      });
    return map;
  }, [companiesByProject]);

  const projectNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) {
      map[p.id] = p.nombre;
    }
    return map;
  }, [projects]);

  // Fetch profiles for new conversation
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-chat", contextProject?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, email").order("display_name");
      return (data || []).filter((p) => p.user_id !== user?.id);
    },
    enabled: open && view === "new",
  });

  // Profile map for sender names
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles-all-chat"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, email");
      return data || [];
    },
    enabled: !!activeConversationId,
  });

  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.user_id, p]));

  // Context open from project/company rows
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenProjectChatDetail>).detail;
      if (!detail?.projectId) return;

      const projectCtx = { id: detail.projectId, name: detail.projectName || "Proyecto" };
      setContextProject(projectCtx);
      setSubsectionScope(detail.empresaId ? (`empresa:${detail.empresaId}` as const) : "all");
      setOpen(true);
      setView("list");
      setSearchConversations("");
      setActiveConversationId(null);
      pendingContextOpenRef.current = detail;
    };

    window.addEventListener("open-project-chat", handler as EventListener);
    return () => window.removeEventListener("open-project-chat", handler as EventListener);
  }, [setActiveConversationId]);

  // Auto-open existing conversation or show list for project-level clicks
  useEffect(() => {
    if (!pendingContextOpenRef.current || loadingConversations) return;
    const pending = pendingContextOpenRef.current;
    pendingContextOpenRef.current = null;

    // If opened from empresa-specific button, try to auto-open that exact chat
    if (pending.empresaId) {
      const match = conversations.find((c) => {
        return c.project_id === pending.projectId && c.empresa_id === pending.empresaId;
      });

      if (match) {
        setActiveConversationId(match.id);
        setView("chat");
      } else {
        setNewProjectId(pending.projectId);
        setNewEmpresaId(pending.empresaId);
        setView("new");
      }
    }
    // Project-level click: stay on list to show all existing chats (general + empresas)
    // User can pick an existing chat or create a new one from there
  }, [conversations, loadingConversations, setActiveConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read when opening a conversation
  useEffect(() => {
    if (activeConversationId && open) {
      markAsRead(activeConversationId);
    }
  }, [activeConversationId, open, markAsRead]);

  // Sound notification via realtime event
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ senderId: string }>).detail;
      if (!detail?.senderId || detail.senderId === user?.id) return;
      if (isSoundMuted) return;
      playNotificationSound();
    };

    window.addEventListener("chat:new-message", handler as EventListener);
    return () => window.removeEventListener("chat:new-message", handler as EventListener);
  }, [user?.id, playNotificationSound, isSoundMuted]);

  // IntersectionObserver for read receipts
  const observeMessage = useCallback(
    (node: HTMLDivElement | null, msg: Message) => {
      if (!node || msg.sender_id === user?.id || msg.is_read) return;

      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const msgId = entry.target.getAttribute("data-msg-id");
                if (msgId) {
                  markMessageRead(msgId);
                  observerRef.current?.unobserve(entry.target);
                }
              }
            });
          },
          { threshold: 0.6 }
        );
      }

      observerRef.current.observe(node);
    },
    [user?.id, markMessageRead]
  );

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, [activeConversationId]);

  const sectionChips = useMemo(() => {
    if (!contextProject) return [];

    const chips: { value: SubsectionScope; label: string; count: number }[] = [];
    chips.push({ value: "all", label: "Todas", count: conversations.length });

    const generalCount = conversations.filter((c) => !c.empresa_id).length;
    chips.push({ value: "general", label: "General", count: generalCount });

    const companyCounts = new Map<string, number>();
    for (const c of conversations) {
      if (c.empresa_id) companyCounts.set(c.empresa_id, (companyCounts.get(c.empresa_id) || 0) + 1);
    }

    for (const [empresaId, count] of companyCounts.entries()) {
      chips.push({
        value: `empresa:${empresaId}`,
        label: companyNameById[empresaId] || "Empresa",
        count,
      });
    }

    return chips;
  }, [contextProject, conversations, companyNameById]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) => {
      const subsectionMatch =
        subsectionScope === "all"
          ? true
          : subsectionScope === "general"
          ? !conv.empresa_id
          : conv.empresa_id === subsectionScope.replace("empresa:", "");

      if (!subsectionMatch) return false;

      const q = searchConversations.trim().toLowerCase();
      if (!q) return true;

      const names = conv.participants.map((p) => p.display_name).join(" ").toLowerCase();
      const lastMsg = conv.last_message?.content?.toLowerCase() || "";
      const sectionLabel = conv.empresa_id ? companyNameById[conv.empresa_id]?.toLowerCase() || "" : "general";
      const projName = conv.project_id ? (projectNameById[conv.project_id] || "").toLowerCase() : "";

      return names.includes(q) || lastMsg.includes(q) || sectionLabel.includes(q) || projName.includes(q);
    });
  }, [conversations, subsectionScope, searchConversations, companyNameById]);

  const openConversation = (convId: string) => {
    setActiveConversationId(convId);
    setView("chat");
    setShowSearch(false);
    setSearchMessages("");
  };

  const handleSend = () => {
    if (!activeConversationId || !messageText.trim()) return;

    sendMessage.mutate(
      { conversationId: activeConversationId, content: messageText.trim() },
      {
        onError: (err: any) => toast.error("Error al enviar: " + (err?.message || "Intenta nuevamente")),
      }
    );

    setMessageText("");
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleNewConversation = () => {
    if (selectedUserIds.length === 0) return;
    const projectIdForNew = newProjectId || contextProject?.id || null;
    const empresaIdForNew = newEmpresaId === "general" ? null : newEmpresaId || null;

    createConversation.mutate(
      { otherUserIds: selectedUserIds, projectId: projectIdForNew, empresaId: empresaIdForNew },
      {
        onSuccess: () => {
          if (projectIdForNew) {
            const projectName = projects.find((p) => p.id === projectIdForNew)?.nombre || "Proyecto";
            setContextProject({ id: projectIdForNew, name: projectName });
            if (empresaIdForNew) {
              setSubsectionScope(`empresa:${empresaIdForNew}` as SubsectionScope);
            } else {
              setSubsectionScope("general");
            }
          }
          setView("chat");
          setSearchUser("");
          setSelectedUserIds([]);
        },
        onError: (err: any) => toast.error("No se pudo crear/abrir la conversación: " + (err?.message || "")),
      }
    );
  };

  const handleBack = () => {
    setView("list");
    setActiveConversationId(null);
    setShowSearch(false);
    setSearchMessages("");
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "message") {
      deleteMessage.mutate(deleteTarget.id, {
        onSuccess: () => toast.success("Mensaje eliminado"),
        onError: (e: any) => toast.error("Error: " + e.message),
      });
    } else {
      deleteConversation.mutate(deleteTarget.id, {
        onSuccess: () => {
          toast.success("Chat eliminado");
          handleBack();
        },
        onError: (e: any) => toast.error("Error: " + e.message),
      });
    }

    setDeleteTarget(null);
  };

  const handleSoundFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast.error("Solo archivos de audio (mp3, wav)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Máximo 2MB");
      return;
    }

    try {
      const url = await uploadCustomSound(file);
      updatePrefs.mutate({ sound_option: "custom", custom_sound_url: url });
      toast.success("Sonido personalizado guardado");
    } catch (err: any) {
      toast.error("Error al subir: " + err.message);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const filteredProfiles = profiles.filter(
    (p) =>
      p.display_name.toLowerCase().includes(searchUser.toLowerCase()) ||
      p.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  const displayMessages = searchMessages.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchMessages.toLowerCase()))
    : messages;

  // Deduplicate projects by name – pick only one ID per unique nombre
  const projectOptionsForNew = useMemo(() => {
    const seen = new Map<string, { id: string; nombre: string }>();
    for (const p of projects) {
      const key = p.nombre.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, p);
    }
    return Array.from(seen.values());
  }, [projects]);

  // Map: project name -> all project IDs with that name
  const projectIdsByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of projects) {
      const key = p.nombre.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p.id);
    }
    return map;
  }, [projects]);

  const selectedProjectForNew = newProjectId || contextProject?.id || "";

  // Collect empresas from ALL project IDs that share the same name
  const selectedProjectCompanies = useMemo(() => {
    if (!selectedProjectForNew) return [];
    const selectedProject = projects.find((p) => p.id === selectedProjectForNew);
    if (!selectedProject) return [];
    const key = selectedProject.nombre.trim().toLowerCase();
    const allIds = projectIdsByName.get(key) || [selectedProjectForNew];
    const seen = new Map<string, { id: string; name: string }>();
    for (const pid of allIds) {
      for (const emp of companiesByProject[pid] || []) {
        if (!seen.has(emp.id)) seen.set(emp.id, emp);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedProjectForNew, projects, projectIdsByName, companiesByProject]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${safe})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300/80 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startW = chatSize.w;
    const startH = chatSize.h;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const clientY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dw = isLeft ? (clientX - startX) : -(clientX - startX);
      const dh = -(clientY - startY);
      setChatSize({
        w: Math.max(320, Math.min(800, startW + dw)),
        h: Math.max(400, Math.min(800, startH + dh)),
      });
    };
    const onEnd = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  }, [chatSize, isLeft]);

  const getSectionLabel = (empresaId: string | null) => {
    if (!contextProject) return "General";
    if (!empresaId) return "General";
    return companyNameById[empresaId] || "Empresa";
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all relative",
          "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {open ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
      {/* Mute toggle button */}
      <button
        onClick={toggleFabSound}
        className={cn(
          "absolute -bottom-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center transition-all shadow-md border border-border z-10",
          isSoundMuted
            ? "bg-destructive text-destructive-foreground"
            : "bg-chart-effective text-foreground"
        )}
        title={isSoundMuted ? "Activar sonido" : "Silenciar notificaciones"}
      >
        {isSoundMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ width: chatSize.w, height: chatSize.h }}
            className={cn(
              "absolute bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
              isBottom ? "bottom-full mb-2" : "top-full mt-2",
              isLeft ? "left-0" : "right-0"
            )}
          >
            {/* Resize handle top-right */}
            <div
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              className="absolute top-0 right-0 w-5 h-5 cursor-nwse-resize z-50 group"
              style={{ cursor: isLeft ? 'nesw-resize' : 'nwse-resize' }}
            >
              <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-muted-foreground/30 group-hover:border-muted-foreground/60 rounded-tr-sm transition-colors" />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
              {view === "list" && contextProject && (
                <button
                  onClick={() => {
                    setContextProject(null);
                    setSubsectionScope("all");
                    setSearchConversations("");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Volver a todos los chats"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {view !== "list" && (
                <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              <h3 className="text-sm font-semibold text-foreground flex-1 truncate">
                {view === "list" && (contextProject ? `Chat — ${contextProject.name}` : "Mensajes")}
                {view === "new" && "Nuevo chat"}
                {view === "settings" && "Configuración de sonido"}
                {view === "chat" && (activeConv?.participants.map((p) => p.display_name).join(", ") || "Chat")}
              </h3>

              <div className="flex items-center gap-1">
                

                {view === "chat" && isAdmin && (
                  <button
                    onClick={() => setDeleteTarget({ type: "conversation", id: activeConversationId! })}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Eliminar chat completo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {view === "list" && (
                  <>
                    <button onClick={() => setView("settings")} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setNewProjectId(contextProject?.id || "");
                        setNewEmpresaId("general");
                        setSelectedUserIds([]);
                        setView("new");
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {view === "chat" && (
              <div className="px-3 pt-2 pb-1 border-b border-border bg-muted/20">
                <Input
                  placeholder="Buscar en mensajes..."
                  value={searchMessages}
                  onChange={(e) => setSearchMessages(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
                {searchMessages && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {displayMessages.length} resultado{displayMessages.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {view === "list" && (
              <div className="px-3 py-2 border-b border-border bg-muted/20 space-y-2">
                <Input
                  placeholder="Buscar conversaciones..."
                  value={searchConversations}
                  onChange={(e) => setSearchConversations(e.target.value)}
                  className="h-7 text-xs"
                />
                {contextProject && (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {sectionChips.map((chip) => (
                      <button
                        key={chip.value}
                        onClick={() => setSubsectionScope(chip.value)}
                        className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-[11px] border transition-colors",
                          subsectionScope === chip.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        {chip.label} ({chip.count})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-hidden">
              {view === "list" && (
                <ScrollArea className="h-full">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">No hay conversaciones para este filtro</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setView("new")}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo chat
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-start gap-2 cursor-pointer"
                          onClick={() => openConversation(conv.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-sm font-medium text-foreground truncate">
                                {conv.project_id && (projectNameById[conv.project_id] || "Proyecto")}
                                {conv.project_id && conv.empresa_id && " · "}
                                {conv.empresa_id && (companyNameById[conv.empresa_id] || "Empresa")}
                                {(conv.project_id || conv.empresa_id) && " — "}
                                <span className="text-chart-effective font-semibold">
                                  {conv.participants.map((p) => p.display_name).join(", ")}
                                </span>
                              </span>
                              {conv.unread_count > 0 && (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 ml-2 shrink-0">
                                  {conv.unread_count}
                                </Badge>
                              )}
                            </div>

                            {conv.last_message && <p className="text-xs text-muted-foreground truncate">{conv.last_message.content}</p>}

                            {conv.last_message && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {format(new Date(conv.last_message.created_at), "d MMM, HH:mm", { locale: es })}
                              </p>
                            )}
                          </div>

                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: "conversation", id: conv.id });
                              }}
                              className="mt-1 shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                              title="Eliminar chat"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}

              {view === "new" && (
                <div className="flex flex-col h-full">
                  <div className="px-3 pt-3 pb-2 space-y-2 border-b border-border bg-muted/10">
                    <div className="grid gap-2 relative">
                      <label className="text-[11px] text-muted-foreground">Proyecto</label>
                      <Input
                        placeholder="Buscar proyecto..."
                        value={searchProject}
                        onChange={(e) => {
                          setSearchProject(e.target.value);
                          setShowProjectDropdown(true);
                        }}
                        onFocus={() => setShowProjectDropdown(true)}
                        className="h-8 text-sm"
                      />
                      {selectedProjectForNew && (
                        <div className="flex items-center gap-1 -mt-1">
                          <Badge variant="secondary" className="text-sm max-w-[260px] truncate px-3 py-1">
                            {projectOptionsForNew.find((p) => p.id === selectedProjectForNew)?.nombre || projects.find((p) => p.id === selectedProjectForNew)?.nombre || "Proyecto"}
                          </Badge>
                          <button
                            onClick={() => {
                              setNewProjectId("");
                              setNewEmpresaId("general");
                              setSearchProject("");
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {showProjectDropdown && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                          <button
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 text-muted-foreground"
                            onClick={() => {
                              setNewProjectId("");
                              setNewEmpresaId("general");
                              setSearchProject("");
                              setShowProjectDropdown(false);
                            }}
                          >
                            Sin proyecto
                          </button>
                          {projectOptionsForNew
                            .filter((p) => p.nombre.toLowerCase().includes(searchProject.toLowerCase()))
                            .map((p) => (
                              <button
                                key={p.id}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 text-foreground truncate"
                                onClick={() => {
                                  setNewProjectId(p.id);
                                  setNewEmpresaId("general");
                                  setSearchProject("");
                                  setShowProjectDropdown(false);
                                }}
                              >
                                {p.nombre}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {selectedProjectForNew && (
                      <div className="grid gap-2">
                        <label className="text-[11px] text-muted-foreground">Empresa</label>
                        <select
                          value={newEmpresaId}
                          onChange={(e) => setNewEmpresaId(e.target.value)}
                          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                        >
                          <option value="general">General (sin empresa)</option>
                          {selectedProjectCompanies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Input
                      placeholder="Buscar usuario..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>

                   <ScrollArea className="flex-1">
                     <div className="divide-y divide-border">
                       {filteredProfiles.map((p) => {
                         const isSelected = selectedUserIds.includes(p.user_id);
                         return (
                           <button
                             key={p.user_id}
                             onClick={() => toggleUserSelection(p.user_id)}
                             className={cn(
                               "w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-2",
                               isSelected && "bg-primary/10"
                             )}
                           >
                             <div className={cn(
                               "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                               isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                             )}>
                               {isSelected && <span className="text-primary-foreground text-[10px] font-bold">✓</span>}
                             </div>
                             <div className="min-w-0">
                               <p className="text-sm font-medium text-foreground">{p.display_name}</p>
                               <p className="text-xs text-muted-foreground">{p.email}</p>
                             </div>
                           </button>
                         );
                       })}
                       {filteredProfiles.length === 0 && (
                         <p className="text-sm text-muted-foreground text-center py-6">No se encontraron usuarios</p>
                       )}
                     </div>
                   </ScrollArea>

                   {selectedUserIds.length > 0 && (
                     <div className="px-3 py-2 border-t border-border">
                       <Button
                         size="sm"
                         className="w-full rounded-full"
                         onClick={handleNewConversation}
                         disabled={createConversation.isPending}
                       >
                         {createConversation.isPending ? (
                           <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                         ) : null}
                         Iniciar chat con {selectedUserIds.length} persona{selectedUserIds.length > 1 ? "s" : ""}
                       </Button>
                     </div>
                   )}
                 </div>
               )}

              {view === "settings" && (
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Volume2 className="w-4 h-4" /> Sonido de notificación
                    </p>
                    <div className="space-y-1.5">
                      {SOUND_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                            prefs?.sound_option === opt.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50 text-foreground"
                          )}
                        >
                          <input
                            type="radio"
                            name="sound"
                            className="accent-primary"
                            checked={prefs?.sound_option === opt.value}
                            onChange={() => {
                              if (opt.value === "custom" && !prefs?.custom_sound_url) return;
                              updatePrefs.mutate({ sound_option: opt.value, custom_sound_url: prefs?.custom_sound_url });
                            }}
                          />
                          {opt.value === "mute" ? <VolumeX className="w-3.5 h-3.5" /> : null}
                          <span className="flex-1">{opt.label}</span>
                          {opt.value !== "mute" && opt.value !== "custom" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                createBeepSound(opt.value)();
                              }}
                              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title={`Escuchar ${opt.label}`}
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {opt.value === "custom" && prefs?.custom_sound_url && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const audio = new Audio(prefs.custom_sound_url!);
                                audio.volume = 0.5;
                                audio.play().catch(() => {});
                              }}
                              className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Escuchar sonido personalizado"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Subir sonido personalizado (mp3/wav, máx 2MB)</p>
                    <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Elegir archivo</span>
                      <input type="file" accept="audio/mp3,audio/wav,audio/mpeg" className="hidden" onChange={handleSoundFileUpload} />
                    </label>
                    {prefs?.custom_sound_url && <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ Sonido personalizado cargado</p>}
                  </div>
                </div>
              )}

              {view === "chat" && (
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 px-3 py-2">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : displayMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">{searchMessages ? "Sin resultados" : "Envía el primer mensaje"}</p>
                    ) : (
                      <div className="space-y-2">
                        {displayMessages.map((msg) => {
                          const isMine = msg.sender_id === user?.id;
                          const senderName = profileMap[msg.sender_id]?.display_name || "Usuario";

                          return (
                            <div
                              key={msg.id}
                              data-msg-id={msg.id}
                              ref={(node) => {
                                if (!isMine && !msg.is_read) observeMessage(node, msg);
                              }}
                              className={cn("flex group", isMine ? "justify-end" : "justify-start")}
                            >
                              <div className={cn("flex items-end gap-1 max-w-[90%] relative", isMine ? "flex-row" : "flex-row")}> 
                                {!isMine && (
                                  <>
                                    <div className="max-w-[90%]">
                                      <p className="text-[10px] text-muted-foreground mb-0.5 ml-1 font-medium whitespace-nowrap truncate" title={senderName}>
                                        {senderName}
                                      </p>
                                      <div className="rounded-2xl px-3 py-2 text-sm bg-muted text-foreground rounded-bl-md">
                                        <p className="whitespace-normal break-normal [overflow-wrap:anywhere] leading-relaxed">
                                          {highlightText(msg.content, searchMessages)}
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground mb-1 whitespace-nowrap">
                                      {format(new Date(msg.created_at), "HH:mm")}
                                    </span>
                                  </>
                                )}

                                {isMine && (
                                  <>
                                    <span className="text-[10px] text-muted-foreground mb-1 whitespace-nowrap">
                                      {format(new Date(msg.created_at), "HH:mm")}
                                    </span>
                                    <div className="max-w-[90%]">
                                      <p className="text-[10px] text-muted-foreground mb-0.5 mr-1 font-medium text-right whitespace-nowrap truncate" title={senderName}>
                                        {senderName}
                                      </p>
                                      <div className="rounded-2xl px-3 py-2 text-sm bg-primary text-primary-foreground rounded-br-md">
                                        <p className="whitespace-normal break-normal [overflow-wrap:anywhere] leading-relaxed">
                                          {highlightText(msg.content, searchMessages)}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={cn(
                                        "inline-block w-2 h-2 rounded-full mb-1",
                                        msg.is_read ? "bg-emerald-500" : "bg-muted-foreground/40"
                                      )}
                                      title={msg.is_read ? "Leído" : "No leído"}
                                    />
                                  </>
                                )}

                                {isAdmin && (
                                  <button
                                    onClick={() => setDeleteTarget({ type: "message", id: msg.id })}
                                    className={cn(
                                      "opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center transition-all shadow-sm absolute -top-1 flex",
                                      isMine ? "-left-1" : "-right-1"
                                    )}
                                    title="Eliminar mensaje"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  <div className="px-3 pb-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder="Escribe un mensaje..."
                        className="h-8 text-sm flex-1 rounded-full"
                        autoFocus
                        disabled={!activeConversationId || createConversation.isPending}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0 rounded-full"
                        disabled={!activeConversationId || !messageText.trim() || sendMessage.isPending}
                        onClick={handleSend}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.type === "message" ? "¿Eliminar este mensaje?" : "¿Eliminar chat completo?"}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. {deleteTarget?.type === "conversation" && "Se eliminarán todos los mensajes de esta conversación."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
