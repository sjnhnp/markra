import { useEffect, useState } from "react";
import {
  defaultEditorPreferences,
  getStoredEditorPreferences,
  type EditorPreferences
} from "../lib/appSettings";
import { listenAppEditorPreferencesChanged } from "../lib/settingsEvents";

export function useEditorPreferences() {
  const [preferences, setPreferences] = useState<EditorPreferences>(defaultEditorPreferences);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let stopListening: (() => void) | null = null;

    void getStoredEditorPreferences()
      .then((storedPreferences) => {
        if (alive) setPreferences(storedPreferences);
      })
      .catch(() => {
        if (alive) setPreferences(defaultEditorPreferences);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    void listenAppEditorPreferencesChanged((nextPreferences) => {
      if (alive) setPreferences(nextPreferences);
    }).then((cleanup) => {
      if (!alive) {
        cleanup();
        return;
      }

      stopListening = cleanup;
    });

    return () => {
      alive = false;
      stopListening?.();
    };
  }, []);

  return {
    loading,
    preferences
  };
}
