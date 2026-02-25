import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const THEME_KEYS = [
  "theme_sidebar_bg",
  "theme_sidebar_text",
  "theme_accent_color",
  "theme_font_family",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export interface ThemeSettings {
  theme_sidebar_bg: string;
  theme_sidebar_text: string;
  theme_accent_color: string;
  theme_font_family: string;
}

const DEFAULTS: ThemeSettings = {
  theme_sidebar_bg: "",
  theme_sidebar_text: "",
  theme_accent_color: "",
  theme_font_family: "Inter",
};

export function useThemeSettings() {
  const query = useQuery({
    queryKey: ["theme-settings"],
    queryFn: async (): Promise<ThemeSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", THEME_KEYS as unknown as string[]);

      if (error) throw error;

      const settings = { ...DEFAULTS };
      data?.forEach((row) => {
        if (row.key in settings) {
          (settings as Record<string, string>)[row.key] = row.value;
        }
      });
      return settings;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Apply CSS variables whenever data changes
  useEffect(() => {
    if (!query.data) return;
    const { theme_sidebar_bg, theme_sidebar_text, theme_accent_color, theme_font_family } = query.data;
    const root = document.documentElement;

    if (theme_sidebar_bg) {
      root.style.setProperty("--custom-sidebar-bg", theme_sidebar_bg);
    } else {
      root.style.removeProperty("--custom-sidebar-bg");
    }

    if (theme_sidebar_text) {
      root.style.setProperty("--custom-sidebar-text", theme_sidebar_text);
    } else {
      root.style.removeProperty("--custom-sidebar-text");
    }

    if (theme_accent_color) {
      root.style.setProperty("--custom-accent", theme_accent_color);
    } else {
      root.style.removeProperty("--custom-accent");
    }

    const font = theme_font_family || "Inter";
    root.style.setProperty("--custom-font", `'${font}', system-ui, sans-serif`);
  }, [query.data]);

  return query;
}

export function useSaveThemeSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: ThemeKey; value: string }) => {
      // Try update first, then insert if no rows updated
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["theme-settings"] });
    },
  });
}
