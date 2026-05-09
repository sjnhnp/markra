import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { fetchAiProviderModels, testAiProviderConnection } from "../lib/ai/providers/aiProviderRequests";
import { createCustomAiProvider, createDefaultAiSettings } from "../lib/ai/providers/aiProviders";
import { t, type I18nKey } from "../lib/i18n";
import {
  getStoredAiSettings,
  getStoredEditorPreferences,
  getStoredWebSearchSettings,
  defaultEditorPreferences,
  defaultWebSearchSettings,
  resetWelcomeDocumentState,
  saveStoredAiSettings,
  saveStoredEditorPreferences,
  saveStoredWebSearchSettings,
  normalizeWebSearchSettings,
  type AiProviderConfig,
  type AiProviderModel,
  type AiProviderSettings,
  type EditorPreferences,
  type WebSearchSettings
} from "../lib/settings/appSettings";
import {
  notifyAppAiSettingsChanged,
  notifyAppEditorPreferencesChanged,
  notifyAppWebSearchSettingsChanged
} from "../lib/settings/settingsEvents";
import { useAppLanguage } from "./useAppLanguage";
import { useAppTheme } from "./useAppTheme";

export type SettingsCategory = "general" | "ai" | "web" | "appearance" | "editor";

export function useSettingsWindowState() {
  const appTheme = useAppTheme();
  const appLanguage = useAppLanguage();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [aiSettings, setAiSettings] = useState<AiProviderSettings>(() => createDefaultAiSettings());
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);
  const [editorPreferences, setEditorPreferences] = useState<EditorPreferences>(defaultEditorPreferences);
  const [webSearchSettings, setWebSearchSettings] = useState<WebSearchSettings>(defaultWebSearchSettings);
  const [selectedAiProviderId, setSelectedAiProviderId] = useState<string | undefined>(
    () => createDefaultAiSettings().defaultProviderId
  );
  const [welcomeReset, setWelcomeReset] = useState(false);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);
  const selectedAiProvider = useMemo(
    () => aiSettings.providers.find((provider) => provider.id === selectedAiProviderId) ?? aiSettings.providers[0],
    [aiSettings.providers, selectedAiProviderId]
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.window = "settings";

    return () => {
      delete document.documentElement.dataset.window;
    };
  }, []);

  useLayoutEffect(() => {
    document.title = translate("settings.title");
  }, [translate]);

  useEffect(() => {
    let cancelled = false;

    getStoredAiSettings().then((settings) => {
      if (cancelled) return;
      setAiSettings(settings);
      setSelectedAiProviderId(settings.defaultProviderId ?? settings.providers[0]?.id);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getStoredWebSearchSettings().then((settings) => {
      if (!cancelled) setWebSearchSettings(settings);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getStoredEditorPreferences().then((preferences) => {
      if (!cancelled) setEditorPreferences(preferences);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleResetWelcomeDocument = useCallback(() => {
    resetWelcomeDocumentState().then(() => {
      setWelcomeReset(true);
    }).catch(() => {});
  }, []);

  const handleAddAiProvider = useCallback(() => {
    setAiSettingsSaved(false);
    setAiSettings((currentSettings) => {
      const provider = createCustomAiProvider(currentSettings.providers.length + 1);
      setSelectedAiProviderId(provider.id);

      return {
        ...currentSettings,
        providers: [...currentSettings.providers, provider]
      };
    });
  }, []);

  const handleUpdateAiSettings = useCallback((settings: AiProviderSettings) => {
    setAiSettingsSaved(false);
    setAiSettings(settings);
  }, []);

  const handleSaveAiSettings = useCallback(() => {
    const settingsToSave = {
      ...aiSettings,
      defaultProviderId: selectedAiProvider?.id ?? aiSettings.defaultProviderId,
      defaultModelId: selectedAiProvider?.defaultModelId ?? aiSettings.defaultModelId
    };

    saveStoredAiSettings(settingsToSave).then(() => {
      setAiSettings(settingsToSave);
      setAiSettingsSaved(true);
      notifyAppAiSettingsChanged(settingsToSave).catch(() => {});
    }).catch(() => {});
  }, [aiSettings, selectedAiProvider]);

  const handleTestAiProvider = useCallback((provider: AiProviderConfig) => testAiProviderConnection(provider), []);

  const handleFetchAiProviderModels = useCallback((provider: AiProviderConfig): Promise<AiProviderModel[]> => {
    return fetchAiProviderModels(provider);
  }, []);

  const handleUpdateEditorPreferences = useCallback((preferences: EditorPreferences) => {
    setEditorPreferences(preferences);
    saveStoredEditorPreferences(preferences)
      .then(() => notifyAppEditorPreferencesChanged(preferences))
      .catch(() => {});
  }, []);

  const handleUpdateWebSearchSettings = useCallback((settings: WebSearchSettings) => {
    const normalizedSettings = normalizeWebSearchSettings(settings);
    setWebSearchSettings(normalizedSettings);
    saveStoredWebSearchSettings(normalizedSettings)
      .then(() => notifyAppWebSearchSettingsChanged(normalizedSettings))
      .catch(() => {});
  }, []);

  return {
    activeCategory,
    aiSettings,
    aiSettingsSaved,
    appLanguage,
    appTheme,
    editorPreferences,
    handleAddAiProvider,
    handleFetchAiProviderModels,
    handleResetWelcomeDocument,
    handleSaveAiSettings,
    handleTestAiProvider,
    handleUpdateAiSettings,
    handleUpdateEditorPreferences,
    handleUpdateWebSearchSettings,
    selectedAiProvider,
    setActiveCategory,
    setSelectedAiProviderId,
    translate,
    webSearchSettings,
    welcomeReset
  };
}
