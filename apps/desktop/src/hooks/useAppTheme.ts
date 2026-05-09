import { useCallback, useEffect, useState } from "react";
import { getStoredTheme, saveStoredTheme, type AppTheme, type ResolvedAppTheme } from "../lib/settings/appSettings";
import { listenAppThemeChanged, notifyAppThemeChanged } from "../lib/settings/settingsEvents";

const systemDarkThemeQuery = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedAppTheme {
  if (typeof window.matchMedia !== "function") return "light";

  return window.matchMedia(systemDarkThemeQuery).matches ? "dark" : "light";
}

function resolveAppTheme(theme: AppTheme, systemTheme: ResolvedAppTheme): ResolvedAppTheme {
  return theme === "system" ? systemTheme : theme;
}

function applyAppTheme(theme: ResolvedAppTheme) {
  // Keep the root attribute as the single switch for theme-scoped CSS variables.
  document.documentElement.dataset.theme = theme;
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedAppTheme>(() => getSystemTheme());
  const resolvedTheme = resolveAppTheme(theme, systemTheme);

  useEffect(() => {
    let active = true;

    getStoredTheme().then((storedTheme) => {
      if (active) setTheme(storedTheme);
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(systemDarkThemeQuery);
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  useEffect(() => {
    applyAppTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => unknown) | null = null;

    listenAppThemeChanged((nextTheme) => {
      if (active) setTheme(nextTheme);
    }).then((stopListening) => {
      if (!active) {
        stopListening();
        return;
      }

      cleanup = stopListening;
    }).catch(() => {});

    return () => {
      active = false;
      cleanup?.();
    };
  }, []);

  const selectTheme = useCallback((nextTheme: AppTheme) => {
    setTheme(nextTheme);
    saveStoredTheme(nextTheme).then(() => notifyAppThemeChanged(nextTheme)).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    saveStoredTheme(nextTheme).then(() => notifyAppThemeChanged(nextTheme)).catch(() => {});
  }, [resolvedTheme]);

  return {
    resolvedTheme,
    selectTheme,
    theme,
    toggleTheme
  };
}
