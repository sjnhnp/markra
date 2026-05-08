import { emit, listen } from "@tauri-apps/api/event";
import { normalizeAiSettings } from "../ai/providers/aiProviders";
import {
  isAppTheme,
  normalizeEditorPreferences,
  type AiProviderSettings,
  type AppTheme,
  type EditorPreferences
} from "./appSettings";
import { isAppLanguage, type AppLanguage } from "../i18n";
import { hasTauriRuntime } from "../utils";

const themeChangedEvent = "markra://theme-changed";
const languageChangedEvent = "markra://language-changed";
const editorPreferencesChangedEvent = "markra://editor-preferences-changed";
const aiSettingsChangedEvent = "markra://ai-settings-changed";

type ThemeChangedPayload = {
  theme: AppTheme;
};

type LanguageChangedPayload = {
  language: AppLanguage;
};

type EditorPreferencesChangedPayload = {
  preferences: EditorPreferences;
};

type AiSettingsChangedPayload = {
  settings: AiProviderSettings;
};

export async function notifyAppThemeChanged(theme: AppTheme) {
  if (!hasTauriRuntime()) return;

  await emit(themeChangedEvent, { theme });
}

export async function listenAppThemeChanged(onThemeChanged: (theme: AppTheme) => unknown) {
  if (!hasTauriRuntime()) return () => {};

  return listen<ThemeChangedPayload>(themeChangedEvent, (event) => {
    if (isAppTheme(event.payload.theme)) {
      onThemeChanged(event.payload.theme);
    }
  });
}

export async function notifyAppLanguageChanged(language: AppLanguage) {
  if (!hasTauriRuntime()) return;

  await emit(languageChangedEvent, { language });
}

export async function listenAppLanguageChanged(onLanguageChanged: (language: AppLanguage) => unknown) {
  if (!hasTauriRuntime()) return () => {};

  return listen<LanguageChangedPayload>(languageChangedEvent, (event) => {
    if (isAppLanguage(event.payload.language)) {
      onLanguageChanged(event.payload.language);
    }
  });
}

export async function notifyAppEditorPreferencesChanged(preferences: EditorPreferences) {
  if (!hasTauriRuntime()) return;

  await emit(editorPreferencesChangedEvent, { preferences });
}

export async function listenAppEditorPreferencesChanged(
  onPreferencesChanged: (preferences: EditorPreferences) => unknown
) {
  if (!hasTauriRuntime()) return () => {};

  return listen<EditorPreferencesChangedPayload>(editorPreferencesChangedEvent, (event) => {
    const preferences = normalizeEditorPreferences(event.payload.preferences);
    if (
      typeof event.payload.preferences === "object" &&
      event.payload.preferences !== null &&
      preferences.autoOpenAiOnSelection === event.payload.preferences.autoOpenAiOnSelection
    ) {
      onPreferencesChanged(preferences);
    }
  });
}

export async function notifyAppAiSettingsChanged(settings: AiProviderSettings) {
  if (!hasTauriRuntime()) return;

  await emit(aiSettingsChangedEvent, { settings });
}

export async function listenAppAiSettingsChanged(onAiSettingsChanged: (settings: AiProviderSettings) => unknown) {
  if (!hasTauriRuntime()) return () => {};

  return listen<AiSettingsChangedPayload>(aiSettingsChangedEvent, (event) => {
    onAiSettingsChanged(normalizeAiSettings(event.payload.settings));
  });
}
