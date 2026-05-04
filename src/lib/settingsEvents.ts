import { emit, listen } from "@tauri-apps/api/event";
import { isAppTheme, type AppTheme } from "./appSettings";
import { isAppLanguage, type AppLanguage } from "./i18n";

const themeChangedEvent = "markra://theme-changed";
const languageChangedEvent = "markra://language-changed";

type ThemeChangedPayload = {
  theme: AppTheme;
};

type LanguageChangedPayload = {
  language: AppLanguage;
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
