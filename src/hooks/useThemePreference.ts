import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pmt-web-theme";

export const palettes = {
  light: {
    background: "#f8fafc",
    text: "#0f172a",
    muted: "#475569",
    subtle: "#94a3b8",
    card: "#ffffff",
    surfaceMuted: "#f1f5f9",
    border: "#e2e8f0",
    gridBorder: "#cbd5f5",
    button: "#0f172a",
    buttonText: "#ffffff",
    buttonMuted: "#94a3b8",
    success: "#15803d",
    danger: "#b91c1c",
    warningBorder: "#fee2e2",
    warningBg: "#fef2f2",
    tableStripe: "#f1f5f9",
    overlay: "rgba(15,23,42,0.55)",
    inputBg: "#ffffff",
  },
  dark: {
    background: "#020617",
    text: "#f8fafc",
    muted: "#cbd5f5",
    subtle: "#94a3b8",
    card: "#0f172a",
    surfaceMuted: "#111827",
    border: "#1f2937",
    gridBorder: "#243046",
    button: "#38bdf8",
    buttonText: "#020617",
    buttonMuted: "#475569",
    success: "#4ade80",
    danger: "#f87171",
    warningBorder: "#7f1d1d",
    warningBg: "rgba(127,29,29,0.35)",
    tableStripe: "#1f2937",
    overlay: "rgba(2,6,23,0.85)",
    inputBg: "#0f172a",
  },
} as const;

export type ThemeName = keyof typeof palettes;
export type ThemePalette = (typeof palettes)["light"];

export function useThemePreference() {
  const [theme, setTheme] = useState<ThemeName>("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setTheme(media.matches ? "dark" : "light");

    const listener = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? "dark" : "light");
    };

    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeName = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  const palette = palettes[theme];

  return {
    theme,
    palette,
    toggleTheme,
    setTheme,
  };
}
