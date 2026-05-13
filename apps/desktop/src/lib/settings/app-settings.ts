import { load } from "@tauri-apps/plugin-store";
import {
  createAiAgentSessionTitle,
  createDefaultAiAgentSessionState,
  normalizeAiAgentSessionTitle,
  normalizeAiAgentWorkspaceKey,
  normalizeStoredAiAgentSessionState,
  normalizeStoredAiAgentSessionSummaries,
  normalizeStoredAiAgentSessionSummary,
  type StoredAiAgentSessionSummary,
  type StoredAiAgentSessionState
} from "@markra/ai";
import { defaultMarkdownShortcuts, normalizeMarkdownShortcuts, type MarkdownShortcutBindings } from "@markra/editor";
import { createDefaultAiSettings, normalizeAiSettings, type AiProviderSettings } from "@markra/providers";
import { isAppLanguage, type AppLanguage } from "@markra/shared";
import { normalizeNullableString } from "@markra/shared";
import { type WebSearchProviderId, type WebSearchSettings } from "@markra/ai";
import {
  editorContentWidthOptions,
  normalizeEditorContentWidthPx,
  type EditorContentWidth
} from "../editor-width";

const settingsStorePath = "settings.json";
const aiAgentSessionIndexStorePath = "ai-agent-sessions/index.json";
const aiAgentSessionStateKey = "session";
const aiAgentSessionMetaKey = "meta";
const aiAgentSessionIndexKey = "entries";
const welcomeDocumentSeenKey = "welcomeDocumentSeen";
const themeKey = "theme";
const languageKey = "language";
const aiProvidersKey = "aiProviders";
const aiAgentPreferencesKey = "aiAgentPreferences";
const editorPreferencesKey = "editorPreferences";
const exportSettingsKey = "exportSettings";
const webSearchKey = "webSearch";
const workspaceKey = "workspace";

export type AppTheme = "light" | "dark" | "system";
export type ResolvedAppTheme = "light" | "dark";
export type PdfMarginPreset = "custom" | "default" | "narrow" | "none" | "normal" | "wide";
export type PdfPageSize = "a4" | "custom" | "default" | "letter";
export type AiAgentPreferences = {
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
};
export type EditorPreferences = {
  autoOpenAiOnSelection: boolean;
  bodyFontSize: number;
  clipboardImageFolder: string;
  closeAiCommandOnAgentPanelOpen: boolean;
  contentWidth: EditorContentWidth;
  contentWidthPx: number | null;
  lineHeight: number;
  markdownShortcuts: MarkdownShortcutBindings;
  restoreWorkspaceOnStartup: boolean;
  showDocumentTabs: boolean;
  showWordCount: boolean;
};
export type ExportSettings = {
  pdfAuthor: string;
  pdfFooter: string;
  pdfHeader: string;
  pdfHeightMm: number;
  pdfMarginMm: number;
  pdfMarginPreset: PdfMarginPreset;
  pdfPageBreakOnH1: boolean;
  pdfPageSize: PdfPageSize;
  pdfWidthMm: number;
};
export type StoredWorkspaceState = {
  aiAgentSessionId: string | null;
  filePath: string | null;
  fileTreeOpen: boolean;
  folderName: string | null;
  folderPath: string | null;
};
export type { AppLanguage };
export type { EditorContentWidth };
export type { WebSearchProviderId, WebSearchSettings };

export const defaultEditorPreferences: EditorPreferences = {
  autoOpenAiOnSelection: true,
  bodyFontSize: 16,
  clipboardImageFolder: "assets",
  closeAiCommandOnAgentPanelOpen: false,
  contentWidth: "default",
  contentWidthPx: null,
  lineHeight: 1.65,
  markdownShortcuts: defaultMarkdownShortcuts,
  restoreWorkspaceOnStartup: true,
  showDocumentTabs: true,
  showWordCount: true
};

export const defaultExportSettings: ExportSettings = {
  pdfAuthor: "",
  pdfFooter: "",
  pdfHeader: "",
  pdfHeightMm: 297,
  pdfMarginMm: 18,
  pdfMarginPreset: "default",
  pdfPageBreakOnH1: false,
  pdfPageSize: "default",
  pdfWidthMm: 210
};

export const defaultAiAgentPreferences: AiAgentPreferences = {
  thinkingEnabled: false,
  webSearchEnabled: false
};

export const defaultWebSearchSettings: WebSearchSettings = {
  contentMaxChars: 12_000,
  enabled: true,
  maxResults: 5,
  providerId: "local-bing",
  searxngApiHost: ""
};

const editorBodyFontSizeOptions = [14, 15, 16, 17, 18, 20] as const;
const editorLineHeightOptions = [1.5, 1.65, 1.8] as const;
const exportPageSizeOptions: PdfPageSize[] = ["default", "a4", "letter", "custom"];
const exportMarginPresetOptions: PdfMarginPreset[] = ["default", "none", "narrow", "normal", "wide", "custom"];
const exportPageSizeDimensions: Record<Exclude<PdfPageSize, "custom">, { heightMm: number; widthMm: number }> = {
  a4: { heightMm: 297, widthMm: 210 },
  default: { heightMm: 297, widthMm: 210 },
  letter: { heightMm: 279, widthMm: 216 }
};
const exportMarginPresetMm: Record<Exclude<PdfMarginPreset, "custom">, number> = {
  default: 18,
  narrow: 10,
  none: 0,
  normal: 18,
  wide: 25
};

export const defaultWorkspaceState: StoredWorkspaceState = {
  aiAgentSessionId: null,
  filePath: null,
  fileTreeOpen: false,
  folderName: null,
  folderPath: null
};

function loadSettingsStore() {
  return load(settingsStorePath, { autoSave: false, defaults: {} });
}

function loadAiAgentSessionStore(sessionId: string | null) {
  return load(aiAgentSessionStorePath(sessionId), { autoSave: false, defaults: {} });
}

function loadAiAgentSessionIndexStore() {
  return load(aiAgentSessionIndexStorePath, { autoSave: false, defaults: {} });
}

export function createAiAgentSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();

  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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

export async function getStoredAiAgentPreferences(): Promise<AiAgentPreferences> {
  const store = await loadSettingsStore();
  const preferences = await store.get<Partial<AiAgentPreferences>>(aiAgentPreferencesKey);

  return normalizeAiAgentPreferences(preferences);
}

export async function getStoredAiAgentSession(sessionId: string | null): Promise<StoredAiAgentSessionState> {
  if (!sessionId?.trim()) return normalizeStoredAiAgentSessionState(undefined);

  const sessionStore = await loadAiAgentSessionStore(sessionId);
  const session = await sessionStore.get<StoredAiAgentSessionState>(aiAgentSessionStateKey);

  return normalizeStoredAiAgentSessionState(session);
}

export async function getStoredAiAgentSessionSummary(sessionId: string | null) {
  if (!sessionId?.trim()) return null;

  const sessionStore = await loadAiAgentSessionStore(sessionId);
  const summary = await sessionStore.get<StoredAiAgentSessionSummary>(aiAgentSessionMetaKey);

  return normalizeStoredAiAgentSessionSummary(summary);
}

export async function listStoredAiAgentSessions(
  workspaceKey: string | null,
  options: {
    includeArchived?: boolean;
  } = {}
): Promise<StoredAiAgentSessionSummary[]> {
  const store = await loadAiAgentSessionIndexStore();
  const entries = await store.get<StoredAiAgentSessionSummary[]>(aiAgentSessionIndexKey);
  const normalizedWorkspaceKey = normalizeAiAgentWorkspaceKey(workspaceKey);

  return normalizeStoredAiAgentSessionSummaries(entries)
    .filter((entry) => entry.workspaceKey === normalizedWorkspaceKey)
    .filter((entry) => options.includeArchived || entry.archivedAt === null);
}

export async function initializeStoredAiAgentSession(
  sessionId: string,
  workspaceKey: string | null,
  options: Partial<Pick<StoredAiAgentSessionState, "agentModelId" | "agentProviderId">> = {}
) {
  const preferences = await getStoredAiAgentPreferences();

  await saveStoredAiAgentSession(sessionId, createDefaultAiAgentSessionState({
    agentModelId: options.agentModelId,
    agentProviderId: options.agentProviderId,
    thinkingEnabled: preferences.thinkingEnabled,
    webSearchEnabled: preferences.webSearchEnabled
  }), { workspaceKey });
}

export async function saveStoredAiAgentSession(
  sessionId: string | null,
  session: StoredAiAgentSessionState,
  options: {
    workspaceKey?: string | null;
  } = {}
) {
  if (!sessionId?.trim()) return;

  const normalizedSession = normalizeStoredAiAgentSessionState(session);
  const store = await loadAiAgentSessionStore(sessionId);
  const existingSummary = normalizeStoredAiAgentSessionSummary(await store.get(aiAgentSessionMetaKey));
  const now = Date.now();
  const fallbackTitle = createAiAgentSessionTitle(normalizedSession);
  const preserveManagedTitle =
    (existingSummary?.titleSource === "ai" || existingSummary?.titleSource === "manual") && existingSummary.title;
  const summary: StoredAiAgentSessionSummary = {
    archivedAt: existingSummary?.archivedAt ?? null,
    createdAt: existingSummary?.createdAt ?? now,
    id: sessionId,
    messageCount: normalizedSession.messages.length,
    title: preserveManagedTitle ? existingSummary.title : fallbackTitle,
    titleSource: preserveManagedTitle ? existingSummary?.titleSource ?? null : fallbackTitle ? "fallback" : null,
    updatedAt: now,
    workspaceKey: normalizeAiAgentWorkspaceKey(existingSummary?.workspaceKey ?? options.workspaceKey)
  };

  await store.set(aiAgentSessionStateKey, normalizedSession);
  await store.set(aiAgentSessionMetaKey, summary);
  await store.save();

  const indexStore = await loadAiAgentSessionIndexStore();
  const currentEntries = normalizeStoredAiAgentSessionSummaries(await indexStore.get(aiAgentSessionIndexKey));
  const nextEntries = [summary, ...currentEntries.filter((entry) => entry.id !== sessionId)];

  await indexStore.set(aiAgentSessionIndexKey, nextEntries);
  await indexStore.save();
}

export async function saveStoredAiAgentSessionTitle(
  sessionId: string | null,
  title: string | null,
  options: {
    source?: "ai" | "manual";
    workspaceKey?: string | null;
  } = {}
) {
  if (!sessionId?.trim()) return;

  const normalizedTitle = normalizeAiAgentSessionTitle(title);
  if (!normalizedTitle) return;

  const store = await loadAiAgentSessionStore(sessionId);
  const existingSummary = normalizeStoredAiAgentSessionSummary(await store.get(aiAgentSessionMetaKey));
  const session = normalizeStoredAiAgentSessionState(await store.get<StoredAiAgentSessionState>(aiAgentSessionStateKey));
  const now = Date.now();
  const summary: StoredAiAgentSessionSummary = {
    archivedAt: existingSummary?.archivedAt ?? null,
    createdAt: existingSummary?.createdAt ?? now,
    id: sessionId,
    messageCount: session.messages.length,
    title: normalizedTitle,
    titleSource: options.source ?? "ai",
    updatedAt: now,
    workspaceKey: normalizeAiAgentWorkspaceKey(existingSummary?.workspaceKey ?? options.workspaceKey)
  };

  await store.set(aiAgentSessionMetaKey, summary);
  await store.save();

  const indexStore = await loadAiAgentSessionIndexStore();
  const currentEntries = normalizeStoredAiAgentSessionSummaries(await indexStore.get(aiAgentSessionIndexKey));
  const nextEntries = [summary, ...currentEntries.filter((entry) => entry.id !== sessionId)];

  await indexStore.set(aiAgentSessionIndexKey, nextEntries);
  await indexStore.save();
}

export async function setStoredAiAgentSessionArchived(sessionId: string | null, archived: boolean) {
  if (!sessionId?.trim()) return;

  const store = await loadAiAgentSessionStore(sessionId);
  const existingSummary = normalizeStoredAiAgentSessionSummary(await store.get(aiAgentSessionMetaKey));
  const session = normalizeStoredAiAgentSessionState(await store.get<StoredAiAgentSessionState>(aiAgentSessionStateKey));
  const now = Date.now();
  const summary: StoredAiAgentSessionSummary = {
    archivedAt: archived ? now : null,
    createdAt: existingSummary?.createdAt ?? now,
    id: sessionId,
    messageCount: session.messages.length,
    title: existingSummary?.title ?? createAiAgentSessionTitle(session),
    titleSource: existingSummary?.titleSource ?? (createAiAgentSessionTitle(session) ? "fallback" : null),
    updatedAt: now,
    workspaceKey: normalizeAiAgentWorkspaceKey(existingSummary?.workspaceKey)
  };

  await store.set(aiAgentSessionMetaKey, summary);
  await store.save();

  const indexStore = await loadAiAgentSessionIndexStore();
  const currentEntries = normalizeStoredAiAgentSessionSummaries(await indexStore.get(aiAgentSessionIndexKey));
  const nextEntries = [summary, ...currentEntries.filter((entry) => entry.id !== sessionId)];

  await indexStore.set(aiAgentSessionIndexKey, nextEntries);
  await indexStore.save();
}

export async function deleteStoredAiAgentSession(sessionId: string | null) {
  if (!sessionId?.trim()) return;

  const store = await loadAiAgentSessionStore(sessionId);
  await store.delete(aiAgentSessionStateKey);
  await store.delete(aiAgentSessionMetaKey);
  await store.save();

  const indexStore = await loadAiAgentSessionIndexStore();
  const currentEntries = normalizeStoredAiAgentSessionSummaries(await indexStore.get(aiAgentSessionIndexKey));
  const nextEntries = currentEntries.filter((entry) => entry.id !== sessionId);

  await indexStore.set(aiAgentSessionIndexKey, nextEntries);
  await indexStore.save();
}

export async function saveStoredAiSettings(settings: AiProviderSettings) {
  const store = await loadSettingsStore();

  await store.set(aiProvidersKey, settings);
  await store.save();
}

export async function saveStoredAiAgentPreferences(preferences: Partial<AiAgentPreferences>) {
  const store = await loadSettingsStore();
  const currentPreferences = normalizeAiAgentPreferences(await store.get<Partial<AiAgentPreferences>>(aiAgentPreferencesKey));

  await store.set(aiAgentPreferencesKey, normalizeAiAgentPreferences({ ...currentPreferences, ...preferences }));
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

export async function getStoredExportSettings(): Promise<ExportSettings> {
  const store = await loadSettingsStore();
  const settings = await store.get<Partial<ExportSettings>>(exportSettingsKey);

  return normalizeExportSettings(settings);
}

export async function saveStoredExportSettings(settings: ExportSettings) {
  const store = await loadSettingsStore();

  await store.set(exportSettingsKey, normalizeExportSettings(settings));
  await store.save();
}

export async function getStoredWebSearchSettings(): Promise<WebSearchSettings> {
  const store = await loadSettingsStore();
  const settings = await store.get<Partial<WebSearchSettings>>(webSearchKey);

  return normalizeWebSearchSettings(settings);
}

export async function saveStoredWebSearchSettings(settings: WebSearchSettings) {
  const store = await loadSettingsStore();

  await store.set(webSearchKey, normalizeWebSearchSettings(settings));
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
} from "@markra/providers";
export type { StoredAiAgentSessionSummary };

export function normalizeAiAgentPreferences(value: unknown): AiAgentPreferences {
  if (typeof value !== "object" || value === null) return defaultAiAgentPreferences;

  const preferences = value as Partial<AiAgentPreferences>;

  return {
    thinkingEnabled:
      typeof preferences.thinkingEnabled === "boolean"
        ? preferences.thinkingEnabled
        : defaultAiAgentPreferences.thinkingEnabled,
    webSearchEnabled:
      typeof preferences.webSearchEnabled === "boolean"
        ? preferences.webSearchEnabled
        : defaultAiAgentPreferences.webSearchEnabled
  };
}

export function normalizeEditorPreferences(value: unknown): EditorPreferences {
  if (typeof value !== "object" || value === null) return defaultEditorPreferences;

  const preferences = value as Partial<EditorPreferences>;

  return {
    autoOpenAiOnSelection:
      typeof preferences.autoOpenAiOnSelection === "boolean"
        ? preferences.autoOpenAiOnSelection
        : defaultEditorPreferences.autoOpenAiOnSelection,
    bodyFontSize: editorBodyFontSizeOptions.includes(preferences.bodyFontSize as typeof editorBodyFontSizeOptions[number])
      ? Number(preferences.bodyFontSize)
      : defaultEditorPreferences.bodyFontSize,
    clipboardImageFolder: normalizeClipboardImageFolder(preferences.clipboardImageFolder),
    closeAiCommandOnAgentPanelOpen:
      typeof preferences.closeAiCommandOnAgentPanelOpen === "boolean"
        ? preferences.closeAiCommandOnAgentPanelOpen
        : defaultEditorPreferences.closeAiCommandOnAgentPanelOpen,
    contentWidth: editorContentWidthOptions.includes(preferences.contentWidth as EditorContentWidth)
      ? (preferences.contentWidth as EditorContentWidth)
      : defaultEditorPreferences.contentWidth,
    contentWidthPx: normalizeEditorContentWidthPx(preferences.contentWidthPx),
    lineHeight: editorLineHeightOptions.includes(preferences.lineHeight as typeof editorLineHeightOptions[number])
      ? Number(preferences.lineHeight)
      : defaultEditorPreferences.lineHeight,
    markdownShortcuts: normalizeMarkdownShortcuts(preferences.markdownShortcuts),
    restoreWorkspaceOnStartup:
      typeof preferences.restoreWorkspaceOnStartup === "boolean"
        ? preferences.restoreWorkspaceOnStartup
        : defaultEditorPreferences.restoreWorkspaceOnStartup,
    showDocumentTabs:
      typeof preferences.showDocumentTabs === "boolean"
        ? preferences.showDocumentTabs
        : defaultEditorPreferences.showDocumentTabs,
    showWordCount:
      typeof preferences.showWordCount === "boolean" ? preferences.showWordCount : defaultEditorPreferences.showWordCount
  };
}

export function normalizeExportSettings(value: unknown): ExportSettings {
  if (typeof value !== "object" || value === null) return defaultExportSettings;

  const settings = value as Partial<ExportSettings>;
  const pdfPageSize = exportPageSizeOptions.includes(settings.pdfPageSize as PdfPageSize)
    ? (settings.pdfPageSize as PdfPageSize)
    : defaultExportSettings.pdfPageSize;
  const pdfMarginMm = normalizeExportMarginMm(settings.pdfMarginMm);
  const pdfMarginPreset = normalizeExportMarginPreset(settings.pdfMarginPreset, pdfMarginMm);
  const dimensions = pdfPageSize === "custom"
    ? {
        heightMm: normalizeExportPageDimension(settings.pdfHeightMm, defaultExportSettings.pdfHeightMm),
        widthMm: normalizeExportPageDimension(settings.pdfWidthMm, defaultExportSettings.pdfWidthMm)
      }
    : exportPageSizeDimensions[pdfPageSize];

  return {
    pdfAuthor: normalizeExportText(settings.pdfAuthor),
    pdfFooter: normalizeExportText(settings.pdfFooter),
    pdfHeader: normalizeExportText(settings.pdfHeader),
    pdfHeightMm: dimensions.heightMm,
    pdfMarginMm: pdfMarginPreset === "custom" ? pdfMarginMm : exportMarginPresetMm[pdfMarginPreset],
    pdfMarginPreset,
    pdfPageBreakOnH1: typeof settings.pdfPageBreakOnH1 === "boolean" ? settings.pdfPageBreakOnH1 : false,
    pdfPageSize,
    pdfWidthMm: dimensions.widthMm
  };
}

export function normalizeClipboardImageFolder(value: unknown) {
  if (typeof value !== "string") return defaultEditorPreferences.clipboardImageFolder;

  const normalized = value.trim().replace(/\\/gu, "/").replace(/\/+/gu, "/");
  if (normalized === ".") return ".";
  if (!normalized || normalized.startsWith("/") || /^[a-zA-Z]:/u.test(normalized)) {
    return defaultEditorPreferences.clipboardImageFolder;
  }

  const parts = normalized
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== ".");

  if (!parts.length || parts.some((part) => part === "..")) {
    return defaultEditorPreferences.clipboardImageFolder;
  }

  return parts.join("/");
}

function normalizeExportMarginMm(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultExportSettings.pdfMarginMm;

  return Math.min(Math.max(Math.round(value), 0), 60);
}

function normalizeExportMarginPreset(value: unknown, marginMm: number): PdfMarginPreset {
  if (exportMarginPresetOptions.includes(value as PdfMarginPreset)) {
    return value as PdfMarginPreset;
  }

  return marginMm === defaultExportSettings.pdfMarginMm ? "default" : "custom";
}

function normalizeExportPageDimension(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  return Math.min(Math.max(Math.round(value), 50), 2000);
}

function normalizeExportText(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, 200);
}

export function normalizeWebSearchSettings(value: unknown): WebSearchSettings {
  if (typeof value !== "object" || value === null) return defaultWebSearchSettings;

  const settings = value as Partial<WebSearchSettings>;

  return {
    contentMaxChars: normalizeWebSearchInteger(settings.contentMaxChars, {
      defaultValue: defaultWebSearchSettings.contentMaxChars,
      max: 40_000,
      min: 2_000
    }),
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : defaultWebSearchSettings.enabled,
    maxResults: normalizeWebSearchInteger(settings.maxResults, {
      defaultValue: defaultWebSearchSettings.maxResults,
      max: 20,
      min: 1
    }),
    providerId: settings.providerId === "searxng" ? "searxng" : defaultWebSearchSettings.providerId,
    searxngApiHost: normalizeWebSearchApiHost(settings.searxngApiHost)
  };
}

function normalizeWebSearchInteger(
  value: unknown,
  limits: {
    defaultValue: number;
    max: number;
    min: number;
  }
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return limits.defaultValue;

  return Math.min(Math.max(Math.round(value), limits.min), limits.max);
}

function normalizeWebSearchApiHost(value: unknown) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim().replace(/\/+$/u, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";

    url.pathname = url.pathname.replace(/\/+$/u, "");
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/+$/u, "");
  } catch {
    return "";
  }
}

export function normalizeWorkspaceState(value: unknown): StoredWorkspaceState {
  if (typeof value !== "object" || value === null) return defaultWorkspaceState;

  const workspace = value as Partial<StoredWorkspaceState>;

  return {
    aiAgentSessionId: normalizeNullableString(workspace.aiAgentSessionId),
    filePath: normalizeNullableString(workspace.filePath),
    fileTreeOpen: typeof workspace.fileTreeOpen === "boolean" ? workspace.fileTreeOpen : false,
    folderName: normalizeNullableString(workspace.folderName),
    folderPath: normalizeNullableString(workspace.folderPath)
  };
}

function aiAgentSessionStorePath(sessionId: string | null) {
  return `ai-agent-sessions/${sessionId ?? "default"}.json`;
}
