import { emit, listen } from "@tauri-apps/api/event";
import { isAppTheme, type AppTheme } from "./appSettings";

const themeChangedEvent = "markra://theme-changed";

type ThemeChangedPayload = {
  theme: AppTheme;
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
