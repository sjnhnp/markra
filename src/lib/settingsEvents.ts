import { emit, listen } from "@tauri-apps/api/event";
import { isAppTheme, normalizeEditorPreferences, type AppTheme, type EditorPreferences } from "./appSettings";
import { isAppLanguage, type AppLanguage } from "./i18n";

const themeChangedEvent = "markra://theme-changed";
const languageChangedEvent = "markra://language-changed";
const editorPreferencesChangedEvent = "markra://editor-preferences-changed";

type ThemeChangedPayload = {
  theme: AppTheme;
};

type LanguageChangedPayload = {
  language: AppLanguage;
};

type EditorPreferencesChangedPayload = {
  preferences: EditorPreferences;
};

function hasTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function notifyAppThemeChanged(theme: AppTheme) {
  if (!hasTauriRuntime()) return;

  await emit(themeChangedEvent, { theme });
}

export async function listenAppThemeChanged(onThemeChanged: (theme: AppTheme) => void) {
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

export async function listenAppLanguageChanged(onLanguageChanged: (language: AppLanguage) => void) {
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
  onPreferencesChanged: (preferences: EditorPreferences) => void
) {
  if (!hasTauriRuntime()) return () => {};

  return listen<EditorPreferencesChangedPayload>(editorPreferencesChangedEvent, (event) => {
    const preferences = normalizeEditorPreferences(event.payload.preferences);
    if (preferences.autoOpenAiOnSelection === event.payload.preferences.autoOpenAiOnSelection) {
      onPreferencesChanged(preferences);
    }
  });
}
