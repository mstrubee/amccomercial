import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
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
}

export function useMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Fetch conversations with participants and last message
  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get user's conversations
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id);

      if (!participations?.length) return [];

      const convIds = participations.map((p) => p.conversation_id);
      const lastReadMap = Object.fromEntries(
        participations.map((p) => [p.conversation_id, p.last_read_at])
      );

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", convIds);

      // Get profiles for all participant user_ids
      const userIds = [...new Set(allParticipants?.map((p) => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = Object.fromEntries(
        (profiles || []).map((p) => [p.user_id, p])
      );

      // Get last message per conversation and unread counts
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
          participants: convParticipants,
          last_message: lastMsg?.[0] || undefined,
          unread_count: count || 0,
        });
      }

      // Sort by last message date
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
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          // Refresh messages if in active conversation
          if (newMsg.conversation_id === activeConversationId) {
            queryClient.invalidateQueries({ queryKey: ["messages", activeConversationId] });
          }
          // Always refresh conversation list for unread counts
          queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
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
      // Update conversation updated_at
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

  // Create conversation
  const createConversation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Check if conversation already exists between these two users
      const { data: myParticipations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myParticipations?.length) {
        const convIds = myParticipations.map((p) => p.conversation_id);
        const { data: otherParticipations } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .eq("user_id", otherUserId)
          .in("conversation_id", convIds);

        if (otherParticipations?.length) {
          return otherParticipations[0].conversation_id;
        }
      }

      // Create new conversation with client-generated ID to avoid SELECT RLS issue
      const convId = crypto.randomUUID();
      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: convId });
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
    totalUnread,
  };
}
