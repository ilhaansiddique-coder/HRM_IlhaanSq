// Project themes: only Light (custom Dabang-inspired palette, overridden in
// src/index.css) and Dark (daisyUI's built-in "night"). All other daisyUI
// themes have been removed from the picker and the type.
export type DaisyThemeName = "light" | "night";

export interface DaisyThemeOption {
  name: DaisyThemeName;
  label: string;
  dark: boolean;
  swatch: [string, string, string];
}

export const DAISY_THEMES: DaisyThemeOption[] = [
  { name: "light", label: "Light", dark: false, swatch: ["#ffffff", "#6366f1", "#f472b6"] },
  { name: "night", label: "Dark", dark: true, swatch: ["#0f172a", "#38bdf8", "#f471b5"] },
];

const DEFAULT_THEME: DaisyThemeName = "light";

const themeExists = (theme: string): theme is DaisyThemeName =>
  DAISY_THEMES.some((item) => item.name === theme);

const storageKey = (userId?: string) => (userId ? `daisy-theme:${userId}` : "daisy-theme");

export const resolveTheme = (value: string | null | undefined): DaisyThemeName =>
  value && themeExists(value) ? value : DEFAULT_THEME;

export const getStoredTheme = (userId?: string): DaisyThemeName | null => {
  if (typeof window === "undefined") return null;
  const savedForUser = userId ? window.localStorage.getItem(storageKey(userId)) : null;
  if (savedForUser && themeExists(savedForUser)) {
    return savedForUser;
  }

  const savedGlobal = window.localStorage.getItem(storageKey());
  return savedGlobal && themeExists(savedGlobal) ? savedGlobal : null;
};

export const setStoredTheme = (theme: DaisyThemeName, userId?: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), theme);
  if (userId) {
    window.localStorage.setItem(storageKey(), theme);
  }
};

export const applyThemeToDocument = (theme: DaisyThemeName) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
};

export const isDarkTheme = (theme: DaisyThemeName) =>
  DAISY_THEMES.find((item) => item.name === theme)?.dark ?? true;
