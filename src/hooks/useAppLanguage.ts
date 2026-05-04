import { useCallback, useEffect, useState } from "react";
import { getStoredLanguage, saveStoredLanguage, type AppLanguage } from "../lib/appSettings";
import { listenAppLanguageChanged, notifyAppLanguageChanged } from "../lib/settingsEvents";

function applyAppLanguage(language: AppLanguage) {
  document.documentElement.lang = language;
}

export function useAppLanguage() {
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void getStoredLanguage().then((storedLanguage) => {
      if (!active) return;

      setLanguage(storedLanguage);
      applyAppLanguage(storedLanguage);
      setReady(true);
    }).catch(() => {
      if (!active) return;

      applyAppLanguage("en");
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void listenAppLanguageChanged((nextLanguage) => {
      setLanguage(nextLanguage);
      applyAppLanguage(nextLanguage);
      setReady(true);
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

  const selectLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguage(nextLanguage);
    setReady(true);
    applyAppLanguage(nextLanguage);

    void saveStoredLanguage(nextLanguage)
      .then(() => notifyAppLanguageChanged(nextLanguage))
      .catch(() => {});
  }, []);

  return {
    language,
    ready,
    selectLanguage
  };
}
