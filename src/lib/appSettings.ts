import { load } from "@tauri-apps/plugin-store";
import { createDefaultAiSettings, normalizeAiSettings, type AiProviderSettings } from "./aiProviders";
import { isAppLanguage, type AppLanguage } from "./i18n";

const settingsStorePath = "settings.json";
const welcomeDocumentSeenKey = "welcomeDocumentSeen";
const themeKey = "theme";
const languageKey = "language";
const aiProvidersKey = "aiProviders";

export type AppTheme = "light" | "dark" | "system";
export type ResolvedAppTheme = "light" | "dark";
export type { AppLanguage };

function loadSettingsStore() {
  return load(settingsStorePath, { autoSave: false, defaults: {} });
}

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark" || value === "system";
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

  return isAppTheme(theme) ? theme : "system";
}

export async function saveStoredTheme(theme: AppTheme) {
  const store = await loadSettingsStore();

  await store.set(themeKey, theme);
  await store.save();
}

export async function getStoredLanguage(): Promise<AppLanguage> {
  const store = await loadSettingsStore();
  const language = await store.get<AppLanguage>(languageKey);

  return isAppLanguage(language) ? language : "en";
}

export async function saveStoredLanguage(language: AppLanguage) {
  const store = await loadSettingsStore();

  await store.set(languageKey, language);
  await store.save();
}

export async function getStoredAiSettings(): Promise<AiProviderSettings> {
  const store = await loadSettingsStore();
  const settings = await store.get<AiProviderSettings>(aiProvidersKey);

  return settings ? normalizeAiSettings(settings) : createDefaultAiSettings();
}

export async function saveStoredAiSettings(settings: AiProviderSettings) {
  const store = await loadSettingsStore();

  await store.set(aiProvidersKey, settings);
  await store.save();
}

export async function resetWelcomeDocumentState() {
  const store = await loadSettingsStore();

  await store.delete(welcomeDocumentSeenKey);
  await store.save();
}

export type {
  AiModelCapability,
  AiProviderApiStyle,
  AiProviderConfig,
  AiProviderModel,
  AiProviderSettings
} from "./aiProviders";
