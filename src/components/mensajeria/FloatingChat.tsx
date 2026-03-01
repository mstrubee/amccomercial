import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, ArrowLeft, Send, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages, Conversation } from "@/hooks/useMessages";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

type View = "list" | "chat" | "new";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [messageText, setMessageText] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

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
    totalUnread,
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

  const openConversation = (convId: string) => {
    setActiveConversationId(convId);
    setView("chat");
  };

  const handleSend = () => {
    if (!messageText.trim() || !activeConversationId) return;
    sendMessage.mutate({ conversationId: activeConversationId, content: messageText.trim() });
    setMessageText("");
  };

  const handleNewConversation = (otherUserId: string) => {
    createConversation.mutate(otherUserId);
    setView("chat");
    setSearchUser("");
  };

  const handleBack = () => {
    setView("list");
    setActiveConversationId(null);
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const filteredProfiles = profiles.filter(
    (p) =>
      p.display_name.toLowerCase().includes(searchUser.toLowerCase()) ||
      p.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed bottom-4 right-16 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
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
            className="fixed bottom-[72px] right-4 z-50 w-80 h-[460px] bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              {view !== "list" && (
                <button onClick={handleBack} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-foreground flex-1">
                {view === "list" && "Mensajes"}
                {view === "new" && "Nueva conversación"}
                {view === "chat" && (activeConv?.participants.map((p) => p.display_name).join(", ") || "Chat")}
              </h3>
              {view === "list" && (
                <button
                  onClick={() => setView("new")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

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
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setView("new")}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Nueva conversación
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => openConversation(conv.id)}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-sm font-medium text-foreground truncate">
                              {conv.participants.map((p) => p.display_name).join(", ")}
                            </span>
                            {conv.unread_count > 0 && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 ml-2">
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

              {/* Chat view */}
              {view === "chat" && (
                <div className="flex flex-col h-full">
                  <ScrollArea className="flex-1 px-3 py-2">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Envía el primer mensaje
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {messages.map((msg) => {
                          const isMine = msg.sender_id === user?.id;
                          return (
                            <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                              <div
                                className={cn(
                                  "max-w-[75%] rounded-lg px-3 py-1.5 text-sm",
                                  isMine
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-foreground"
                                )}
                              >
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                <p
                                  className={cn(
                                    "text-[10px] mt-0.5",
                                    isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                                  )}
                                >
                                  {format(new Date(msg.created_at), "HH:mm")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>
                  <div className="px-3 pb-3 pt-2 border-t border-border">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                      }}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="h-8 text-sm flex-1"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={!messageText.trim() || sendMessage.isPending}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
