import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nameToHandle } from "@/lib/mention-utils";

export interface MentionableUser {
  user_id: string;
  display_name: string;
  handle: string;
}

export function useMentionableUsers() {
  return useQuery({
    queryKey: ["mentionable-users"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<MentionableUser[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .not("display_name", "is", null);
      if (error) throw error;
      return (data || [])
        .filter((p: any) => p.display_name && p.display_name.trim())
        .map((p: any) => ({
          user_id: p.user_id,
          display_name: p.display_name as string,
          handle: nameToHandle(p.display_name as string),
        }));
    },
  });
}