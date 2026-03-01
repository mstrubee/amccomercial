import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string | null;
  empresa_id: string | null;
  participants: { user_id: string; display_name: string; email: string }[];
  last_message?: { content: string; created_at: string; sender_id: string };
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

interface UseMessagesOptions {
  projectId?: string | null;
  empresaId?: string | null;
}

const CONVERSATIONS_KEY = "conversations";

export function useMessages(options: UseMessagesOptions = {}) {
  const { projectId, empresaId } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const projectScope = useMemo(() => (projectId === undefined ? "all" : projectId ?? "none"), [projectId]);
  const empresaScope = useMemo(() => (empresaId === undefined ? "all" : empresaId ?? "none"), [empresaId]);

  const invalidateConversationQueries = useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === CONVERSATIONS_KEY,
    });
  }, [queryClient]);

  // Fetch conversations with participants and last message
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: [CONVERSATIONS_KEY, user?.id, projectScope, empresaScope],
    queryFn: async () => {
      if (!user) return [];

      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (!participations?.length) return [];

      const participantConversationIds = participations.map((p) => p.conversation_id);
      const lastReadMap = Object.fromEntries(participations.map((p) => [p.conversation_id, p.last_read_at]));

      const { data: conversationRows } = await (supabase as any)
        .from("conversations")
        .select("id, created_at, updated_at, project_id, empresa_id")
        .in("id", participantConversationIds);

      const scopedConversations = (conversationRows || []).filter((row: any) => {
        const projectMatches =
          projectId === undefined ? true : projectId === null ? row.project_id == null : row.project_id === projectId;

        const empresaMatches =
          empresaId === undefined ? true : empresaId === null ? row.empresa_id == null : row.empresa_id === empresaId;

        return projectMatches && empresaMatches;
      });

      if (!scopedConversations.length) return [];

      const convIds = scopedConversations.map((c: any) => c.id);
      const conversationMap = Object.fromEntries(scopedConversations.map((c: any) => [c.id, c]));

      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      const userIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));

      const { data: allMessages } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at, sender_id")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: false });

      const lastMessageMap = new Map<string, { content: string; created_at: string; sender_id: string }>();
      for (const m of allMessages || []) {
        if (!lastMessageMap.has(m.conversation_id)) {
          lastMessageMap.set(m.conversation_id, {
            content: m.content,
            created_at: m.created_at,
            sender_id: m.sender_id,
          });
        }
      }

      const results: Conversation[] = [];

      for (const convId of convIds) {
        const lastReadAt = lastReadMap[convId] || "1970-01-01T00:00:00.000Z";

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .gt("created_at", lastReadAt)
          .neq("sender_id", user.id);

        const convParticipants = (allParticipants || [])
          .filter((p) => p.conversation_id === convId && p.user_id !== user.id)
          .map((p) => profileMap[p.user_id] || { user_id: p.user_id, display_name: "Usuario", email: "" });

        const dbConversation = conversationMap[convId] as any;

        results.push({
          id: convId,
          created_at: dbConversation?.created_at || "",
          updated_at: dbConversation?.updated_at || "",
          project_id: dbConversation?.project_id ?? null,
          empresa_id: dbConversation?.empresa_id ?? null,
          participants: convParticipants,
          last_message: lastMessageMap.get(convId),
          unread_count: count || 0,
        });
      }

      results.sort((a, b) => {
        const da = a.last_message?.created_at || a.updated_at || "0";
        const db = b.last_message?.created_at || b.updated_at || "0";
        return db.localeCompare(da);
      });

      return results;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  // Fetch messages for active conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const { data } = await (supabase as any)
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, is_read")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      return (data || []) as Message[];
    },
    enabled: !!activeConversationId,
  });

  // Realtime subscription for new messages and live moderation
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("messages-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as Message;

          if (newMsg.conversation_id === activeConversationId) {
            queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
          }

          window.dispatchEvent(
            new CustomEvent("chat:new-message", {
              detail: {
                conversationId: newMsg.conversation_id,
                senderId: newMsg.sender_id,
              },
            })
          );

          invalidateConversationQueries();
        } else if (payload.eventType === "DELETE") {
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          invalidateConversationQueries();
        } else if (payload.eventType === "UPDATE") {
          queryClient.invalidateQueries({ queryKey: ["messages"] });
          invalidateConversationQueries();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversationId, queryClient, invalidateConversationQueries]);

  // Send message
  const sendMessage = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
      });
      if (error) throw error;

      await (supabase as any)
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      invalidateConversationQueries();
    },
  });

  // Create or join conversation: 1 project + 1 empresa = 1 chat (group)
  const createConversation = useMutation({
    mutationFn: async ({
      otherUserIds,
      projectId: pid,
      empresaId: eid,
    }: {
      otherUserIds: string[];
      projectId?: string | null;
      empresaId?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Look for an existing conversation with the same project+empresa
      let existingConvId: string | null = null;

      if (pid) {
        const query = (supabase as any)
          .from("conversations")
          .select("id")
          .eq("project_id", pid);

        if (eid) {
          query.eq("empresa_id", eid);
        } else {
          query.is("empresa_id", null);
        }

        const { data: existingConvs } = await query.limit(1);
        if (existingConvs?.length) {
          existingConvId = existingConvs[0].id;
        }
      }

      if (existingConvId) {
        // Add current user + selected users as participants if not already in
        const { data: existingParts } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", existingConvId);

        const existingUserIds = new Set((existingParts || []).map((p) => p.user_id));
        const allUserIds = [user.id, ...otherUserIds];
        const newParticipants = allUserIds.filter((uid) => !existingUserIds.has(uid));

        if (newParticipants.length > 0) {
          await supabase.from("conversation_participants").insert(
            newParticipants.map((uid) => ({ conversation_id: existingConvId!, user_id: uid }))
          );
        }

        return existingConvId;
      }

      // No existing conversation — create a new one
      const convId = crypto.randomUUID();
      const insertData: any = { id: convId, project_id: pid ?? null, empresa_id: eid ?? null };

      const { error: convError } = await (supabase as any).from("conversations").insert(insertData);
      if (convError) throw convError;

      const allUserIds = [user.id, ...otherUserIds];
      const uniqueUserIds = [...new Set(allUserIds)];
      const { error: partError } = await supabase.from("conversation_participants").insert(
        uniqueUserIds.map((uid) => ({ conversation_id: convId, user_id: uid }))
      );
      if (partError) throw partError;

      return convId;
    },
    onSuccess: (convId) => {
      invalidateConversationQueries();
      setActiveConversationId(convId);
    },
  });

  // Mark conversation as read (for unread counter)
  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      invalidateConversationQueries();
    },
    [user, invalidateConversationQueries]
  );

  // Mark message as read (visual read receipt)
  const markMessageRead = useCallback(async (messageId: string) => {
    await (supabase as any).from("messages").update({ is_read: true }).eq("id", messageId).eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["messages"] });
    invalidateConversationQueries();
  }, [queryClient, invalidateConversationQueries]);

  // Delete single message (admin)
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
      invalidateConversationQueries();
    },
  });

  // Delete entire conversation (admin)
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId);
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveConversationId(null);
      invalidateConversationQueries();
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  // Search messages in a conversation
  const searchMessages = useCallback(async (conversationId: string, query: string): Promise<Message[]> => {
    if (!query.trim()) return [];
    const { data } = await (supabase as any)
      .from("messages")
      .select("id, conversation_id, sender_id, content, created_at, is_read")
      .eq("conversation_id", conversationId)
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: true });
    return (data || []) as Message[];
  }, []);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return {
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
    searchMessages,
    totalUnread,
  };
}
