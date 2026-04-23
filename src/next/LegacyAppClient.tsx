"use client";

import { useEffect } from "react";

import App from "@/App";
import ErrorBoundary from "@/components/ErrorBoundary";
import { applyThemeToDocument, getStoredTheme, resolveTheme } from "@/lib/themePreferences";
import { initPwa } from "@/pwa";
import { initClientErrorReporting } from "@/utils/logger";

export default function LegacyAppClient() {
  useEffect(() => {
    initClientErrorReporting();
    initPwa();
    applyThemeToDocument(resolveTheme(getStoredTheme()));
  }, []);

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
