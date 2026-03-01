import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  MessageCircle, X, ArrowLeft, Send, Plus, Loader2,
  Search, Trash2, Settings, Volume2, VolumeX, Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages, Conversation, Message } from "@/hooks/useMessages";
import { useChatPreferences, SoundOption } from "@/hooks/useChatPreferences";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type View = "list" | "chat" | "new" | "settings";

const SOUND_OPTIONS: { value: SoundOption; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "icq", label: "Estilo ICQ" },
  { value: "bell", label: "Campana" },
  { value: "ding", label: "Ding" },
  { value: "mute", label: "Silenciar" },
  { value: "custom", label: "Personalizado" },
];

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [messageText, setMessageText] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [searchMessages, setSearchMessages] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "message" | "conversation"; id: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin } = useAuth();
  const { data: theme } = useThemeSettings();
  const pos = theme?.theme_floating_position || "left-14";
  const side = pos.split("-")[0];
  const isBottom = side === "left" || side === "right";
  const isLeft = side === "left" || side === "bottom";

  const { prefs, updatePrefs, uploadCustomSound, playNotificationSound } = useChatPreferences();
  const lastMessageCountRef = useRef(0);

  const {
    conversations, messages, loadingConversations, loadingMessages,
    activeConversationId, setActiveConversationId,
    sendMessage, createConversation, markAsRead, markMessageRead,
    deleteMessage, deleteConversation, totalUnread,
  } = useMessages();

  // Fetch profiles for new conversation
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-chat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .order("display_name");
      return (data || []).filter((p) => p.user_id !== user?.id);
    },
    enabled: open && view === "new",
  });

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

  // Play sound on new incoming message
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && lastMessageCountRef.current > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_id !== user?.id) {
        playNotificationSound();
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, user?.id, playNotificationSound]);

  // IntersectionObserver for read receipts
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observeMessage = useCallback(
    (node: HTMLDivElement | null, msg: Message) => {
      if (!node || msg.sender_id === user?.id || msg.is_read) return;
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const msgId = entry.target.getAttribute("data-msg-id");
                if (msgId) markMessageRead(msgId);
              }
            });
          },
          { threshold: 0.5 }
        );
      }
      observerRef.current.observe(node);
    },
    [user?.id, markMessageRead]
  );

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, [activeConversationId]);

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
      { onError: (err: any) => toast.error("Error al enviar: " + (err?.message || "Intenta nuevamente")) }
    );
    setMessageText("");
  };

  const handleNewConversation = (otherUserId: string) => {
    createConversation.mutate(
      { otherUserId },
      {
        onSuccess: () => { setView("chat"); setSearchUser(""); },
        onError: (err: any) => toast.error("No se pudo crear la conversación: " + (err?.message || "")),
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
        onSuccess: () => { toast.success("Chat eliminado"); handleBack(); },
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

  // Filter messages by search
  const displayMessages = searchMessages.trim()
    ? messages.filter((m) => m.content.toLowerCase().includes(searchMessages.toLowerCase()))
    : messages;

  // Highlight search term in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300/80 text-foreground rounded-sm px-0.5">{part}</mark>
      ) : (
        part
      )
    );
  };

  // Profile map for sender names
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["profiles-all-chat"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, email");
      return data || [];
    },
    enabled: !!activeConversationId,
  });
  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.user_id, p]));

  return (
    <div className="relative">
      {/* Floating button */}
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

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute w-[340px] h-[500px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden",
              isBottom ? "bottom-full mb-2" : "top-full mt-2",
              isLeft ? "left-0" : "right-0",
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
              {view !== "list" && (
                <button onClick={handleBack} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-foreground flex-1 truncate">
                {view === "list" && "Mensajes"}
                {view === "new" && "Nueva conversación"}
                {view === "settings" && "Configuración de sonido"}
                {view === "chat" && (activeConv?.participants.map((p) => p.display_name).join(", ") || "Chat")}
              </h3>
              <div className="flex items-center gap-1">
                {view === "chat" && (
                  <button onClick={() => { setShowSearch(!showSearch); setSearchMessages(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                    <Search className="w-3.5 h-3.5" />
                  </button>
                )}
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
                    <button onClick={() => setView("new")} className="text-muted-foreground hover:text-foreground transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Search bar in chat */}
            {view === "chat" && showSearch && (
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

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {/* Conversation list */}
              {view === "list" && (
                <ScrollArea className="h-full">
                  {loadingConversations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">No tienes conversaciones</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setView("new")}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nueva conversación
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => openConversation(conv.id)}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {conv.participants.map((p) => p.display_name).join(", ")}
                            </span>
                            {conv.unread_count > 0 && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 ml-2 shrink-0">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </div>
                          {conv.last_message && (
                            <p className="text-xs text-muted-foreground truncate">
                              {conv.last_message.content}
                            </p>
                          )}
                          {conv.last_message && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {format(new Date(conv.last_message.created_at), "d MMM, HH:mm", { locale: es })}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}

              {/* New conversation */}
              {view === "new" && (
                <div className="flex flex-col h-full">
                  <div className="px-3 pt-3 pb-2">
                    <Input
                      placeholder="Buscar usuario..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="divide-y divide-border">
                      {filteredProfiles.map((p) => (
                        <button
                          key={p.user_id}
                          onClick={() => handleNewConversation(p.user_id)}
                          className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors"
                          disabled={createConversation.isPending}
                        >
                          <p className="text-sm font-medium text-foreground">{p.display_name}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </button>
                      ))}
                      {filteredProfiles.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">No se encontraron usuarios</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Settings view */}
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
                            prefs?.sound_option === opt.value
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted/50 text-foreground"
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
                          {opt.label}
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
                    {prefs?.custom_sound_url && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">✓ Sonido personalizado cargado</p>
                    )}
                  </div>
                </div>
              )}

              {/* Chat view */}
              {view === "chat" && (
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 px-3 py-2">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : displayMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {searchMessages ? "Sin resultados" : "Envía el primer mensaje"}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
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
                              <div className="relative max-w-[80%]">
                                {/* Sender name for others' messages */}
                                {!isMine && (
                                  <p className="text-[10px] text-muted-foreground mb-0.5 ml-1 font-medium">{senderName}</p>
                                )}
                                <div
                                  className={cn(
                                    "rounded-2xl px-3 py-2 text-sm relative",
                                    isMine
                                      ? "bg-primary text-primary-foreground rounded-br-md"
                                      : "bg-muted text-foreground rounded-bl-md"
                                  )}
                                >
                                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                                    {highlightText(msg.content, searchMessages)}
                                  </p>
                                  <div className={cn("flex items-center gap-1 mt-0.5", isMine ? "justify-end" : "justify-start")}>
                                    <span className={cn("text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                      {format(new Date(msg.created_at), "HH:mm")}
                                    </span>
                                    {/* Read receipt for sent messages */}
                                    {isMine && (
                                      <span
                                        className={cn(
                                          "inline-block w-2 h-2 rounded-full ml-0.5",
                                          msg.is_read ? "bg-green-400" : "bg-muted-foreground/40"
                                        )}
                                        title={msg.is_read ? "Leído" : "No leído"}
                                      />
                                    )}
                                  </div>
                                </div>
                                {/* Admin delete button */}
                                {isAdmin && (
                                  <button
                                    onClick={() => setDeleteTarget({ type: "message", id: msg.id })}
                                    className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 rounded-full bg-destructive text-destructive-foreground items-center justify-center transition-all shadow-sm"
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === "message" ? "¿Eliminar este mensaje?" : "¿Eliminar chat completo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.{" "}
              {deleteTarget?.type === "conversation" && "Se eliminarán todos los mensajes de esta conversación."}
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
