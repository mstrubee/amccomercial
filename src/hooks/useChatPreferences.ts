import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";

export type SoundOption = "pop" | "icq" | "bell" | "ding" | "mute" | "custom";

export interface ChatPreferences {
  id: string;
  user_id: string;
  sound_option: SoundOption;
  custom_sound_url: string | null;
}

// Shared AudioContext – survives across calls and resumes on user gesture
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    sharedAudioCtx = new AudioContext();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Warm up AudioContext on first user interaction so it's ready for realtime events
if (typeof window !== "undefined") {
  const warmUp = () => {
    getAudioContext();
    window.removeEventListener("click", warmUp);
    window.removeEventListener("keydown", warmUp);
  };
  window.addEventListener("click", warmUp, { once: true });
  window.addEventListener("keydown", warmUp, { once: true });
}

// Generate simple notification sounds using Web Audio API
export function createBeepSound(type: SoundOption): (() => void) {
  return () => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.value = 0.3;

      switch (type) {
        case "pop":
          osc.type = "sine";
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.15);
          break;

        case "icq":
          osc.type = "square";
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.setValueAtTime(600, ctx.currentTime + 0.08);
          osc.frequency.setValueAtTime(900, ctx.currentTime + 0.16);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.25);
          break;

        case "bell":
          osc.type = "sine";
          osc.frequency.setValueAtTime(1200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.4);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
          break;

        case "ding":
          osc.type = "triangle";
          osc.frequency.setValueAtTime(1047, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
          break;

        default:
          osc.type = "sine";
          osc.frequency.value = 660;
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Web Audio not available
    }
  };
}

export function useChatPreferences(user: User | null | undefined) {
  const qc = useQueryClient();
  const soundFnsRef = useRef<Record<string, () => void>>({});

  const { data: prefs } = useQuery({
    queryKey: ["chat-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from("chat_preferences")
        .select("id, user_id, sound_option, custom_sound_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return (data as ChatPreferences | null) ?? { sound_option: "pop" as SoundOption, custom_sound_url: null };
    },
    enabled: !!user,
  });

  const updatePrefs = useMutation({
    mutationFn: async (input: { sound_option: SoundOption; custom_sound_url?: string | null }) => {
      if (!user) throw new Error("Not authenticated");

      const payload = {
        user_id: user.id,
        sound_option: input.sound_option,
        custom_sound_url: input.custom_sound_url ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any).from("chat_preferences").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat-preferences", user?.id] }),
  });

  const uploadCustomSound = async (file: File): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("chat-sounds").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;

    const { data } = supabase.storage.from("chat-sounds").getPublicUrl(path);
    return data.publicUrl;
  };

  const playNotificationSound = useCallback(() => {
    const option = prefs?.sound_option || "pop";
    if (option === "mute") return;

    const playBuiltIn = (type: SoundOption) => {
      if (!soundFnsRef.current[type]) {
        soundFnsRef.current[type] = createBeepSound(type);
      }
      soundFnsRef.current[type]();
    };

    if (option === "custom" && prefs?.custom_sound_url) {
      const audio = new Audio(prefs.custom_sound_url);
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Fallback to built-in sound when custom audio fails
        playBuiltIn("pop");
      });
      return;
    }

    // Use Web Audio API for built-in sounds (no CORS issues)
    playBuiltIn(option);
  }, [prefs?.sound_option, prefs?.custom_sound_url]);

  return { prefs, updatePrefs, uploadCustomSound, playNotificationSound };
}
