// Re-export shared UI utilities from src/lib so both old and new code share one source
export { cn } from "../src/lib/utils";
export {
  applyThemeToDocument,
  DAISY_THEMES,
  getStoredTheme,
  resolveTheme,
  setStoredTheme,
  isDarkTheme,
  type DaisyThemeName,
  type DaisyThemeOption,
} from "../src/lib/themePreferences";
