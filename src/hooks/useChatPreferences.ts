import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback, useEffect, useRef } from "react";
import type { User } from "@supabase/supabase-js";

export type SoundOption = "pop" | "icq" | "bell" | "ding" | "mute" | "custom";

export interface ChatPreferences {
  id: string;
  user_id: string;
  sound_option: SoundOption;
  custom_sound_url: string | null;
}

// ─── Resilient Audio Manager ───────────────────────────────────────
// Survives suspended states, tab backgrounding, and non-gesture triggers.

let _ctx: AudioContext | null = null;
let _pendingPlay: (() => void) | null = null;
let _listenersRegistered = false;
let _lastPlayTime = 0;
const COOLDOWN_MS = 300;

function getOrCreateCtx(): AudioContext {
  if (!_ctx || _ctx.state === "closed") {
    _ctx = new AudioContext();
  }
  return _ctx;
}

/** Try to resume AudioContext. Safe to call from any context. */
function tryResume() {
  if (!_ctx || _ctx.state === "closed") return;
  if (_ctx.state === "suspended") {
    _ctx.resume().catch(() => {});
  }
}

/** Called from user-gesture listeners to unlock/resume + flush pending plays. */
function onUserGesture() {
  const ctx = getOrCreateCtx();
  if (ctx.state === "suspended") {
    ctx.resume().then(() => {
      if (_pendingPlay) {
        const fn = _pendingPlay;
        _pendingPlay = null;
        fn();
      }
    }).catch(() => {});
  } else if (ctx.state === "running" && _pendingPlay) {
    const fn = _pendingPlay;
    _pendingPlay = null;
    fn();
  }
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    tryResume();
  }
}

/** Register persistent listeners once. They stay for the lifetime of the page. */
function ensureGestureListeners() {
  if (_listenersRegistered || typeof window === "undefined") return;
  _listenersRegistered = true;

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", onUserGesture, opts);
  window.addEventListener("keydown", onUserGesture, opts);
  window.addEventListener("touchstart", onUserGesture, opts);
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Eagerly create context
  getOrCreateCtx();
}

// Auto-init on module load
ensureGestureListeners();

// ─── Sound generators ──────────────────────────────────────────────

function playBeepOnCtx(ctx: AudioContext, type: SoundOption) {
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
}

/** Attempt to play a built-in sound. If AudioContext is suspended, queue for next gesture. */
function safePlayBuiltIn(type: SoundOption) {
  const now = Date.now();
  if (now - _lastPlayTime < COOLDOWN_MS) return; // anti-spam
  _lastPlayTime = now;

  try {
    const ctx = getOrCreateCtx();

    if (ctx.state === "running") {
      playBeepOnCtx(ctx, type);
      console.debug("[chat-sound] played:", type);
      return;
    }

    // Context is suspended – try resume
    console.debug("[chat-sound] ctx suspended, attempting resume for:", type);
    ctx.resume().then(() => {
      if (ctx.state === "running") {
        playBeepOnCtx(ctx, type);
        console.debug("[chat-sound] played after resume:", type);
      } else {
        // Still blocked – queue for next user gesture
        console.debug("[chat-sound] still suspended, queuing for next gesture:", type);
        _pendingPlay = () => {
          try {
            const c = getOrCreateCtx();
            if (c.state === "running") playBeepOnCtx(c, type);
          } catch { /* ignore */ }
        };
      }
    }).catch(() => {
      // Queue for next gesture
      _pendingPlay = () => {
        try {
          const c = getOrCreateCtx();
          if (c.state === "running") playBeepOnCtx(c, type);
        } catch { /* ignore */ }
      };
    });
  } catch {
    // Web Audio not available at all
  }
}

// Public export for settings preview
export function createBeepSound(type: SoundOption): (() => void) {
  return () => safePlayBuiltIn(type);
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useChatPreferences(user: User | null | undefined) {
  const qc = useQueryClient();

  // Ensure gesture listeners are active when hook mounts
  useEffect(() => {
    ensureGestureListeners();
  }, []);

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

    if (option === "custom" && prefs?.custom_sound_url) {
      const audio = new Audio(prefs.custom_sound_url);
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Custom audio failed (CORS, network, etc.) – fall back to built-in pop
        console.debug("[chat-sound] custom audio failed, falling back to pop");
        safePlayBuiltIn("pop");
      });
      return;
    }

    safePlayBuiltIn(option);
  }, [prefs?.sound_option, prefs?.custom_sound_url]);

  return { prefs, updatePrefs, uploadCustomSound, playNotificationSound };
}
