import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type SoundOption = "pop" | "icq" | "bell" | "ding" | "mute" | "custom";

export interface ChatPreferences {
  id: string;
  user_id: string;
  sound_option: SoundOption;
  custom_sound_url: string | null;
}

const SOUND_URLS: Record<string, string> = {
  pop: "https://cdn.freesound.org/previews/662/662411_11523868-lq.mp3",
  icq: "https://cdn.freesound.org/previews/25/25879_37876-lq.mp3",
  bell: "https://cdn.freesound.org/previews/411/411749_5121236-lq.mp3",
  ding: "https://cdn.freesound.org/previews/536/536420_4921277-lq.mp3",
};

export function useChatPreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ["chat-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("chat_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as ChatPreferences | null) ?? { sound_option: "pop" as SoundOption, custom_sound_url: null };
    },
    enabled: !!user,
  });

  const updatePrefs = useMutation({
    mutationFn: async (input: { sound_option: SoundOption; custom_sound_url?: string | null }) => {
      if (!user) throw new Error("Not authenticated");
      const { data: existing } = await (supabase as any)
        .from("chat_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await (supabase as any)
          .from("chat_preferences")
          .update({ sound_option: input.sound_option, custom_sound_url: input.custom_sound_url ?? null, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } else {
        await (supabase as any)
          .from("chat_preferences")
          .insert({ user_id: user.id, sound_option: input.sound_option, custom_sound_url: input.custom_sound_url ?? null });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-preferences", user?.id] }),
  });

  const uploadCustomSound = async (file: File): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-sounds").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("chat-sounds").getPublicUrl(path);
    return data.publicUrl;
  };

  const playNotificationSound = () => {
    const option = prefs?.sound_option || "pop";
    if (option === "mute") return;
    const url = option === "custom" ? prefs?.custom_sound_url : SOUND_URLS[option];
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(() => {});
  };

  return { prefs, updatePrefs, uploadCustomSound, playNotificationSound };
}
