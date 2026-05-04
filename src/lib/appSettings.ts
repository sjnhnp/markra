import { load } from "@tauri-apps/plugin-store";

const settingsStorePath = "settings.json";
const welcomeDocumentSeenKey = "welcomeDocumentSeen";
const themeKey = "theme";

export type AppTheme = "light" | "dark";

function loadSettingsStore() {
  return load(settingsStorePath, { autoSave: false, defaults: {} });
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

export async function consumeWelcomeDocumentState() {
  const store = await loadSettingsStore();
  const hasSeenWelcomeDocument = await store.get<boolean>(welcomeDocumentSeenKey);

  if (hasSeenWelcomeDocument) return false;

  await store.set(welcomeDocumentSeenKey, true);
  await store.save();

  return true;
}

export async function getStoredTheme(): Promise<AppTheme> {
  const store = await loadSettingsStore();
  const theme = await store.get<AppTheme>(themeKey);

  return isAppTheme(theme) ? theme : "light";
}

export async function saveStoredTheme(theme: AppTheme) {
  const store = await loadSettingsStore();

  await store.set(themeKey, theme);
  await store.save();
}

export async function resetWelcomeDocumentState() {
  const store = await loadSettingsStore();

  await store.delete(welcomeDocumentSeenKey);
  await store.save();
}
