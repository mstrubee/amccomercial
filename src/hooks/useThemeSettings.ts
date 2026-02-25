import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const THEME_KEYS = [
  "theme_sidebar_bg",
  "theme_sidebar_text",
  "theme_accent_color",
  "theme_font_family",
  "theme_custom_font_url",
  "theme_company_logo",
  "theme_background_color",
  "theme_alert_position",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export interface ThemeSettings {
  theme_sidebar_bg: string;
  theme_sidebar_text: string;
  theme_accent_color: string;
  theme_font_family: string;
  theme_custom_font_url: string;
  theme_company_logo: string;
  theme_background_color: string;
  theme_alert_position: string;
}

const DEFAULTS: ThemeSettings = {
  theme_sidebar_bg: "",
  theme_sidebar_text: "",
  theme_accent_color: "",
  theme_font_family: "Inter",
  theme_custom_font_url: "",
  theme_company_logo: "",
  theme_background_color: "",
  theme_alert_position: "bottom-right",
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
    const {
      theme_sidebar_bg,
      theme_sidebar_text,
      theme_accent_color,
      theme_font_family,
      theme_custom_font_url,
      theme_background_color,
    } = query.data;
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

    if (theme_background_color) {
      root.style.setProperty("--custom-bg", theme_background_color);
      document.body.style.backgroundColor = theme_background_color;
    } else {
      root.style.removeProperty("--custom-bg");
      document.body.style.removeProperty("background-color");
    }

    const font = theme_font_family || "Inter";
    root.style.setProperty("--custom-font", `'${font}', system-ui, sans-serif`);

    // Inject custom font URL
    const existingLink = document.getElementById("custom-font-link");
    if (theme_custom_font_url) {
      if (existingLink) {
        (existingLink as HTMLLinkElement).href = theme_custom_font_url;
      } else {
        const link = document.createElement("link");
        link.id = "custom-font-link";
        link.rel = "stylesheet";
        link.href = theme_custom_font_url;
        document.head.appendChild(link);
      }
    } else {
      existingLink?.remove();
    }
  }, [query.data]);

  return query;
}

export function useSaveThemeSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: ThemeKey; value: string }) => {
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
