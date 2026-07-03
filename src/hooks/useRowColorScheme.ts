import { useCallback, useMemo, useState } from "react";
import { darkenHex } from "@/lib/color-utils";

const LS_ROW_COLORS_KEY = "amc_proyecto_row_colors";

export const DEFAULT_ROW_COLORS = { par: "#F6E7C6", impar: "#DCE3EA" };

interface RowColors {
  par: string;
  impar: string;
}

function loadRowColors(): RowColors {
  try {
    const raw = localStorage.getItem(LS_ROW_COLORS_KEY);
    if (!raw) return DEFAULT_ROW_COLORS;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.par === "string" && typeof parsed?.impar === "string") return parsed;
    return DEFAULT_ROW_COLORS;
  } catch {
    return DEFAULT_ROW_COLORS;
  }
}

/**
 * Row background colors for the Proyectos listing (par/impar), persisted in
 * localStorage. Hover and nested-box (Notas/Checklist) shades are derived
 * from the two base colors so they always stay in the same family — editing
 * one parity's color updates every row (and its Notas/Checklist boxes) of
 * that parity at once.
 */
export function useRowColorScheme() {
  const [colors, setColorsState] = useState<RowColors>(loadRowColors);

  const setColors = useCallback((par: string, impar: string) => {
    const next = { par, impar };
    setColorsState(next);
    try { localStorage.setItem(LS_ROW_COLORS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const resetColors = useCallback(() => setColors(DEFAULT_ROW_COLORS.par, DEFAULT_ROW_COLORS.impar), [setColors]);

  const cssVars = useMemo(() => ({
    "--row-par": colors.par,
    "--row-par-hover": darkenHex(colors.par, 0.06),
    "--row-par-box": darkenHex(colors.par, 0.12),
    "--row-par-box-border": darkenHex(colors.par, 0.22),
    "--row-impar": colors.impar,
    "--row-impar-hover": darkenHex(colors.impar, 0.06),
    "--row-impar-box": darkenHex(colors.impar, 0.1),
    "--row-impar-box-border": darkenHex(colors.impar, 0.2),
  }), [colors]);

  return { colors, setColors, resetColors, cssVars };
}
