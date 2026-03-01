import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string | null;
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

export function useMessages(projectId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Fetch conversations with participants and last message
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations", user?.id, projectId ?? "all"],
    queryFn: async () => {
      if (!user) return [];

      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (!participations?.length) return [];

      let convIds = participations.map((p) => p.conversation_id);
      const lastReadMap = Object.fromEntries(
        participations.map((p) => [p.conversation_id, p.last_read_at])
      );

      // Filter by project_id if provided
      if (projectId !== undefined) {
        const { data: convRows } = await supabase
          .from("conversations")
          .select("id" as any)
          .in("id", convIds);
        // We need project_id which is new column - use raw query via rpc or cast
        const convRowsAny = convRows as any[] | null;
        if (convRowsAny) {
          // Fetch project_id separately since types not regenerated
          const filteredIds: string[] = [];
          for (const c of convRowsAny) {
            const { data: convDetail } = await supabase
              .from("conversations")
              .select("*")
              .eq("id", c.id)
              .single();
            const detail = convDetail as any;
            if (projectId ? detail?.project_id === projectId : !detail?.project_id) {
              filteredIds.push(c.id);
            }
          }
          convIds = filteredIds;
        }
      }

      if (!convIds.length) return [];

      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      const userIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.user_id, p])
      );

      const results: Conversation[] = [];
      for (const convId of convIds) {
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("content, created_at, sender_id")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(1);

        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convId)
          .gt("created_at", lastReadMap[convId]);

        const convParticipants = (allParticipants || [])
          .filter((p) => p.conversation_id === convId && p.user_id !== user.id)
          .map((p) => profileMap[p.user_id] || { user_id: p.user_id, display_name: "Usuario", email: "" });

        results.push({
          id: convId,
          created_at: "",
          updated_at: "",
          project_id: projectId ?? null,
          participants: convParticipants,
          last_message: lastMsg?.[0] || undefined,
          unread_count: count || 0,
        });
      }

      results.sort((a, b) => {
        const da = a.last_message?.created_at || "0";
        const db = b.last_message?.created_at || "0";
        return db.localeCompare(da);
      });

      return results;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch messages for active conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      return (data || []) as Message[];
    },
    enabled: !!activeConversationId,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as Message;
            if (newMsg.conversation_id === activeConversationId) {
              queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
            }
            queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
          } else if (payload.eventType === "DELETE") {
            queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
            queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
          } else if (payload.eventType === "UPDATE") {
            queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversationId, queryClient]);

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
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["messages", vars.conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });

  // Create conversation (optionally linked to a project)
  const createConversation = useMutation({
    mutationFn: async ({ otherUserId, projectId: pid }: { otherUserId: string; projectId?: string | null }) => {
      if (!user) throw new Error("Not authenticated");

      // Check existing
      const { data: myParticipations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myParticipations?.length) {
        const cIds = myParticipations.map((p) => p.conversation_id);
        const { data: otherP } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", otherUserId)
          .in("conversation_id", cIds);

        if (otherP?.length) {
          for (const op of otherP) {
            const { data: conv } = await supabase
              .from("conversations")
              .select("*")
              .eq("id", op.conversation_id)
              .single();
            const convAny = conv as any;
            if (convAny && convAny.project_id === (pid ?? null)) {
              return convAny.id;
            }
          }
        }
      }

      const convId = crypto.randomUUID();
      const insertData: any = { id: convId };
      if (pid) insertData.project_id = pid;
      const { error: convError } = await supabase
        .from("conversations")
        .insert(insertData);
      if (convError) throw convError;

      const { error: partError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: convId, user_id: user.id },
          { conversation_id: convId, user_id: otherUserId },
        ]);
      if (partError) throw partError;

      return convId;
    },
    onSuccess: (convId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      setActiveConversationId(convId);
    },
  });

  // Mark conversation as read
  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
    },
    [user, queryClient]
  );

  // Mark message as read
  const markMessageRead = useCallback(
    async (messageId: string) => {
      await supabase
        .from("messages")
        .update({ is_read: true } as any)
        .eq("id", messageId);
    },
    []
  );

  // Delete single message (admin)
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });

  // Delete entire conversation (admin)
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      // Delete messages first, then participants, then conversation
      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      await supabase.from("conversation_participants").delete().eq("conversation_id", conversationId);
      const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveConversationId(null);
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  // Search messages in a conversation
  const searchMessages = useCallback(
    async (conversationId: string, query: string): Promise<Message[]> => {
      if (!query.trim()) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .ilike("content", `%${query}%`)
        .order("created_at", { ascending: true });
      return (data || []) as Message[];
    },
    []
  );

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
