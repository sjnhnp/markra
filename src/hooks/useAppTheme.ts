import { useCallback, useEffect, useState } from "react";
import { getStoredTheme, saveStoredTheme, type AppTheme } from "../lib/appSettings";
import { listenAppThemeChanged, notifyAppThemeChanged } from "../lib/settingsEvents";

function applyAppTheme(theme: AppTheme) {
  // Keep the root attribute as the single switch for theme-scoped CSS variables.
  document.documentElement.dataset.theme = theme;
}

export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>("light");

  useEffect(() => {
    let active = true;

    void getStoredTheme().then((storedTheme) => {
      if (active) setTheme(storedTheme);
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void listenAppThemeChanged((nextTheme) => {
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
    void saveStoredTheme(nextTheme).then(() => notifyAppThemeChanged(nextTheme)).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";

      void saveStoredTheme(nextTheme).then(() => notifyAppThemeChanged(nextTheme)).catch(() => {});

      return nextTheme;
    });
  }, []);

  return {
    selectTheme,
    theme,
    toggleTheme
  };
}
