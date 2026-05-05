import { load } from "@tauri-apps/plugin-store";
import { createDefaultAiSettings, normalizeAiSettings, type AiProviderSettings } from "../ai/providers/aiProviders";
import { isAppLanguage, type AppLanguage } from "../i18n";
import { normalizeNullableString } from "../utils";

const settingsStorePath = "settings.json";
const welcomeDocumentSeenKey = "welcomeDocumentSeen";
const themeKey = "theme";
const languageKey = "language";
const aiProvidersKey = "aiProviders";
const editorPreferencesKey = "editorPreferences";
const workspaceKey = "workspace";

export type AppTheme = "light" | "dark" | "system";
export type ResolvedAppTheme = "light" | "dark";
export type EditorPreferences = {
  autoOpenAiOnSelection: boolean;
};
export type StoredWorkspaceState = {
  filePath: string | null;
  fileTreeOpen: boolean;
  folderName: string | null;
  folderPath: string | null;
};
export type { AppLanguage };

export const defaultEditorPreferences: EditorPreferences = {
  autoOpenAiOnSelection: true
};

export const defaultWorkspaceState: StoredWorkspaceState = {
  filePath: null,
  fileTreeOpen: false,
  folderName: null,
  folderPath: null
};

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

export async function getStoredEditorPreferences(): Promise<EditorPreferences> {
  const store = await loadSettingsStore();
  const preferences = await store.get<Partial<EditorPreferences>>(editorPreferencesKey);

  return normalizeEditorPreferences(preferences);
}

export async function saveStoredEditorPreferences(preferences: EditorPreferences) {
  const store = await loadSettingsStore();

  await store.set(editorPreferencesKey, normalizeEditorPreferences(preferences));
  await store.save();
}

export async function getStoredWorkspaceState(): Promise<StoredWorkspaceState> {
  const store = await loadSettingsStore();
  const workspace = await store.get<StoredWorkspaceState>(workspaceKey);

  return normalizeWorkspaceState(workspace);
}

export async function saveStoredWorkspaceState(patch: Partial<StoredWorkspaceState>) {
  const store = await loadSettingsStore();
  const current = normalizeWorkspaceState(await store.get<StoredWorkspaceState>(workspaceKey));
  const workspace = normalizeWorkspaceState({ ...current, ...patch });

  await store.set(workspaceKey, workspace);
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
} from "../ai/providers/aiProviders";

export function normalizeEditorPreferences(value: unknown): EditorPreferences {
  if (typeof value !== "object" || value === null) return defaultEditorPreferences;

  return {
    autoOpenAiOnSelection:
      typeof (value as Partial<EditorPreferences>).autoOpenAiOnSelection === "boolean"
        ? Boolean((value as Partial<EditorPreferences>).autoOpenAiOnSelection)
        : defaultEditorPreferences.autoOpenAiOnSelection
  };
}

export function normalizeWorkspaceState(value: unknown): StoredWorkspaceState {
  if (typeof value !== "object" || value === null) return defaultWorkspaceState;

  const workspace = value as Partial<StoredWorkspaceState>;

  return {
    filePath: normalizeNullableString(workspace.filePath),
    fileTreeOpen: typeof workspace.fileTreeOpen === "boolean" ? workspace.fileTreeOpen : false,
    folderName: normalizeNullableString(workspace.folderName),
    folderPath: normalizeNullableString(workspace.folderPath)
  };
}
