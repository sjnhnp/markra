import { fireEvent, render } from "@testing-library/react";
import { AI_EDITOR_PREVIEW_ACTION_EVENT, defaultMarkdownShortcuts, type AiEditorPreviewActionDetail } from "@markra/editor";
import App from "../App";
import {
  confirmNativeMarkdownFileDelete,
  confirmNativeUnsavedMarkdownDocumentDiscard,
  createNativeMarkdownTreeFile,
  deleteNativeMarkdownTreeFile,
  openNativeMarkdownFolder,
  openNativeMarkdownFolderInNewWindow,
  openNativeMarkdownFileInNewWindow,
  openNativeMarkdownPath,
  readNativeMarkdownImageFile,
  readNativeMarkdownFile,
  saveNativeHtmlFile,
  saveNativeMarkdownFile,
  saveNativePdfFile,
  showNativeMarkdownFileTreeContextMenu,
  installNativeMarkdownFileDrop,
  listNativeMarkdownFilesForPath,
  renameNativeMarkdownTreeFile,
  watchNativeMarkdownFile
} from "../lib/tauri";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu
} from "../lib/tauri";
import { openNativeExternalUrl, openSettingsWindow } from "../lib/tauri";
import { checkNativeAppUpdate } from "../lib/tauri/updater";
import {
  createAiAgentSessionId,
  consumeWelcomeDocumentState,
  deleteStoredAiAgentSession,
  getStoredAiAgentPreferences,
  getStoredAiAgentSession,
  getStoredAiAgentSessionSummary,
  getStoredAiSettings,
  getStoredEditorPreferences,
  getStoredExportSettings,
  getStoredLanguage,
  getStoredTheme,
  getStoredWebSearchSettings,
  getStoredWorkspaceState,
  initializeStoredAiAgentSession,
  listStoredAiAgentSessions,
  resetWelcomeDocumentState,
  saveStoredAiAgentSession,
  saveStoredAiAgentSessionTitle,
  saveStoredAiSettings,
  saveStoredEditorPreferences,
  saveStoredExportSettings,
  saveStoredLanguage,
  saveStoredTheme,
  saveStoredWorkspaceState,
  setStoredAiAgentSessionArchived
} from "../lib/settings/app-settings";
import {
  listenAppAiSettingsChanged,
  listenAppEditorPreferencesChanged,
  listenAppExportSettingsChanged,
  listenAppLanguageChanged,
  listenAppThemeChanged,
  listenAppWebSearchSettingsChanged,
  notifyAppAiSettingsChanged,
  notifyAppEditorPreferencesChanged,
  notifyAppExportSettingsChanged,
  notifyAppLanguageChanged,
  notifyAppThemeChanged,
  notifyAppWebSearchSettingsChanged
} from "../lib/settings/settings-events";
import { fetchAiProviderModels, testAiProviderConnection } from "@markra/providers";
import { chatCompletion } from "@markra/ai";
import { generateAiAgentSessionTitle } from "@markra/ai";
import { resolveDesktopPlatform } from "../lib/platform";
vi.mock("../lib/tauri", () => ({
  confirmNativeMarkdownFileDelete: vi.fn(),
  confirmNativeUnsavedMarkdownDocumentDiscard: vi.fn(),
  createNativeMarkdownTreeFile: vi.fn(),
  deleteNativeMarkdownTreeFile: vi.fn(),
  installNativeMarkdownFileDrop: vi.fn(),
  openNativeMarkdownFolder: vi.fn(),
  openNativeMarkdownFolderInNewWindow: vi.fn(),
  openNativeMarkdownFileInNewWindow: vi.fn(),
  openNativeMarkdownPath: vi.fn(),
  readNativeMarkdownImageFile: vi.fn(),
  readNativeMarkdownFile: vi.fn(),
  requestNativeAiJson: vi.fn(),
  requestNativeChat: vi.fn(),
  requestNativeChatStream: vi.fn(),
  requestNativeWebResource: vi.fn(),
  renameNativeMarkdownTreeFile: vi.fn(),
  saveNativeClipboardImage: vi.fn(),
  saveNativeHtmlFile: vi.fn(),
  saveNativeMarkdownFile: vi.fn(),
  saveNativePdfFile: vi.fn(),
  showNativeMarkdownFileTreeContextMenu: vi.fn(),
  watchNativeMarkdownFile: vi.fn(),
  listNativeMarkdownFilesForPath: vi.fn(),
  installNativeApplicationMenu: vi.fn(),
  installNativeEditorContextMenu: vi.fn(),
  openNativeExternalUrl: vi.fn(),
  openSettingsWindow: vi.fn(),
  setNativeWindowTitle: vi.fn()
}));

vi.mock("../lib/tauri/updater", () => ({
  checkNativeAppUpdate: vi.fn()
}));

vi.mock("../lib/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/platform")>();

  return {
    ...actual,
    resolveDesktopPlatform: vi.fn(() => "macos")
  };
});

vi.mock("../lib/settings/app-settings", () => ({
  createAiAgentSessionId: vi.fn(),
  consumeWelcomeDocumentState: vi.fn(),
  deleteStoredAiAgentSession: vi.fn(),
  defaultEditorPreferences: {
    autoOpenAiOnSelection: true,
    bodyFontSize: 16,
    clipboardImageFolder: "assets",
    closeAiCommandOnAgentPanelOpen: false,
    contentWidth: "default",
    lineHeight: 1.65,
    markdownShortcuts: {
      bold: "Mod+B",
      bulletList: "Mod+Shift+8",
      codeBlock: "Mod+Alt+C",
      heading1: "Mod+Alt+1",
      heading2: "Mod+Alt+2",
      heading3: "Mod+Alt+3",
      inlineCode: "Mod+E",
      italic: "Mod+I",
      orderedList: "Mod+Shift+7",
      paragraph: "Mod+Alt+0",
      quote: "Mod+Shift+B",
      strikethrough: "Mod+Shift+X"
    },
    restoreWorkspaceOnStartup: true,
    showWordCount: true
  },
  defaultWebSearchSettings: {
    contentMaxChars: 12000,
    enabled: true,
    maxResults: 5,
    providerId: "local-bing",
    searxngApiHost: ""
  },
  defaultExportSettings: {
    pdfAuthor: "",
    pdfFooter: "",
    pdfHeader: "",
    pdfHeightMm: 297,
    pdfMarginMm: 18,
    pdfMarginPreset: "default",
    pdfPageBreakOnH1: false,
    pdfPageSize: "default",
    pdfWidthMm: 210
  },
  getStoredAiAgentSession: vi.fn(),
  getStoredAiAgentSessionSummary: vi.fn(),
  getStoredAiAgentPreferences: vi.fn(),
  getStoredAiSettings: vi.fn(),
  getStoredEditorPreferences: vi.fn(),
  getStoredExportSettings: vi.fn(),
  getStoredLanguage: vi.fn(),
  getStoredTheme: vi.fn(),
  getStoredWebSearchSettings: vi.fn(),
  getStoredWorkspaceState: vi.fn(),
  initializeStoredAiAgentSession: vi.fn(),
  listStoredAiAgentSessions: vi.fn(),
  normalizeEditorPreferences: vi.fn((preferences) => ({
    autoOpenAiOnSelection: true,
    bodyFontSize: 16,
    clipboardImageFolder: "assets",
    closeAiCommandOnAgentPanelOpen: false,
    contentWidth: "default",
    lineHeight: 1.65,
    markdownShortcuts: {
      bold: "Mod+B",
      bulletList: "Mod+Shift+8",
      codeBlock: "Mod+Alt+C",
      heading1: "Mod+Alt+1",
      heading2: "Mod+Alt+2",
      heading3: "Mod+Alt+3",
      inlineCode: "Mod+E",
      italic: "Mod+I",
      orderedList: "Mod+Shift+7",
      paragraph: "Mod+Alt+0",
      quote: "Mod+Shift+B",
      strikethrough: "Mod+Shift+X"
    },
    restoreWorkspaceOnStartup: true,
    showWordCount: true,
    ...preferences
  })),
  normalizeExportSettings: vi.fn((settings) => ({
    pdfAuthor: "",
    pdfFooter: "",
    pdfHeader: "",
    pdfHeightMm: 297,
    pdfMarginMm: 18,
    pdfMarginPreset: "default",
    pdfPageBreakOnH1: false,
    pdfPageSize: "default",
    pdfWidthMm: 210,
    ...settings
  })),
  normalizeWebSearchSettings: vi.fn((settings) => ({
    contentMaxChars: 12000,
    enabled: true,
    maxResults: 5,
    providerId: "local-bing",
    searxngApiHost: "",
    ...settings
  })),
  resetWelcomeDocumentState: vi.fn(),
  saveStoredAiAgentPreferences: vi.fn(),
  saveStoredAiAgentSession: vi.fn(),
  saveStoredAiAgentSessionTitle: vi.fn(),
  saveStoredAiSettings: vi.fn(),
  saveStoredEditorPreferences: vi.fn(),
  saveStoredExportSettings: vi.fn(),
  saveStoredLanguage: vi.fn(),
  saveStoredTheme: vi.fn(),
  saveStoredWorkspaceState: vi.fn(),
  setStoredAiAgentSessionArchived: vi.fn()
}));

vi.mock("../lib/settings/settings-events", () => ({
  listenAppAiSettingsChanged: vi.fn(),
  listenAppEditorPreferencesChanged: vi.fn(),
  listenAppExportSettingsChanged: vi.fn(),
  listenAppLanguageChanged: vi.fn(),
  listenAppThemeChanged: vi.fn(),
  listenAppWebSearchSettingsChanged: vi.fn(),
  notifyAppAiSettingsChanged: vi.fn(),
  notifyAppEditorPreferencesChanged: vi.fn(),
  notifyAppExportSettingsChanged: vi.fn(),
  notifyAppLanguageChanged: vi.fn(),
  notifyAppThemeChanged: vi.fn(),
  notifyAppWebSearchSettingsChanged: vi.fn()
}));

vi.mock("@markra/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@markra/ai")>();

  return {
    ...actual,
    chatCompletion: vi.fn(),
    generateAiAgentSessionTitle: vi.fn()
  };
});

vi.mock("@markra/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@markra/providers")>();

  return {
    ...actual,
    fetchAiProviderModels: vi.fn(),
    testAiProviderConnection: vi.fn()
  };
});

export const mockedOpenNativeMarkdownFolder = vi.mocked(openNativeMarkdownFolder);
export const mockedOpenNativeMarkdownFolderInNewWindow = vi.mocked(openNativeMarkdownFolderInNewWindow);
export const mockedConfirmNativeMarkdownFileDelete = vi.mocked(confirmNativeMarkdownFileDelete);
export const mockedConfirmNativeUnsavedMarkdownDocumentDiscard = vi.mocked(confirmNativeUnsavedMarkdownDocumentDiscard);
export const mockedCreateNativeMarkdownTreeFile = vi.mocked(createNativeMarkdownTreeFile);
export const mockedDeleteNativeMarkdownTreeFile = vi.mocked(deleteNativeMarkdownTreeFile);
export const mockedOpenNativeMarkdownFileInNewWindow = vi.mocked(openNativeMarkdownFileInNewWindow);
export const mockedOpenNativeMarkdownPath = vi.mocked(openNativeMarkdownPath);
export const mockedReadNativeMarkdownImageFile = vi.mocked(readNativeMarkdownImageFile);
export const mockedReadNativeMarkdownFile = vi.mocked(readNativeMarkdownFile);
export const mockedSaveNativeHtmlFile = vi.mocked(saveNativeHtmlFile);
export const mockedSaveNativeMarkdownFile = vi.mocked(saveNativeMarkdownFile);
export const mockedSaveNativePdfFile = vi.mocked(saveNativePdfFile);
export const mockedShowNativeMarkdownFileTreeContextMenu = vi.mocked(showNativeMarkdownFileTreeContextMenu);
export const mockedInstallNativeMarkdownFileDrop = vi.mocked(installNativeMarkdownFileDrop);
export const mockedListNativeMarkdownFilesForPath = vi.mocked(listNativeMarkdownFilesForPath);
export const mockedRenameNativeMarkdownTreeFile = vi.mocked(renameNativeMarkdownTreeFile);
export const mockedWatchNativeMarkdownFile = vi.mocked(watchNativeMarkdownFile);
export const mockedInstallNativeApplicationMenu = vi.mocked(installNativeApplicationMenu);
export const mockedInstallNativeEditorContextMenu = vi.mocked(installNativeEditorContextMenu);
export const mockedOpenSettingsWindow = vi.mocked(openSettingsWindow);
export const mockedOpenNativeExternalUrl = vi.mocked(openNativeExternalUrl);
export const mockedCheckNativeAppUpdate = vi.mocked(checkNativeAppUpdate);
export const mockedResolveDesktopPlatform = vi.mocked(resolveDesktopPlatform);
export const mockedConsumeWelcomeDocumentState = vi.mocked(consumeWelcomeDocumentState);
export const mockedCreateAiAgentSessionId = vi.mocked(createAiAgentSessionId);
export const mockedDeleteStoredAiAgentSession = vi.mocked(deleteStoredAiAgentSession);
export const mockedGetStoredAiAgentPreferences = vi.mocked(getStoredAiAgentPreferences);
export const mockedGetStoredAiAgentSession = vi.mocked(getStoredAiAgentSession);
export const mockedGetStoredAiAgentSessionSummary = vi.mocked(getStoredAiAgentSessionSummary);
export const mockedGetStoredAiSettings = vi.mocked(getStoredAiSettings);
export const mockedGetStoredEditorPreferences = vi.mocked(getStoredEditorPreferences);
export const mockedGetStoredExportSettings = vi.mocked(getStoredExportSettings);
export const mockedGetStoredLanguage = vi.mocked(getStoredLanguage);
export const mockedGetStoredTheme = vi.mocked(getStoredTheme);
export const mockedGetStoredWebSearchSettings = vi.mocked(getStoredWebSearchSettings);
export const mockedGetStoredWorkspaceState = vi.mocked(getStoredWorkspaceState);
export const mockedInitializeStoredAiAgentSession = vi.mocked(initializeStoredAiAgentSession);
export const mockedListStoredAiAgentSessions = vi.mocked(listStoredAiAgentSessions);
export const mockedResetWelcomeDocumentState = vi.mocked(resetWelcomeDocumentState);
export const mockedSaveStoredAiAgentSession = vi.mocked(saveStoredAiAgentSession);
export const mockedSaveStoredAiAgentSessionTitle = vi.mocked(saveStoredAiAgentSessionTitle);
export const mockedSaveStoredAiSettings = vi.mocked(saveStoredAiSettings);
export const mockedSaveStoredEditorPreferences = vi.mocked(saveStoredEditorPreferences);
export const mockedSaveStoredExportSettings = vi.mocked(saveStoredExportSettings);
export const mockedSaveStoredLanguage = vi.mocked(saveStoredLanguage);
export const mockedSaveStoredTheme = vi.mocked(saveStoredTheme);
export const mockedSaveStoredWorkspaceState = vi.mocked(saveStoredWorkspaceState);
export const mockedSetStoredAiAgentSessionArchived = vi.mocked(setStoredAiAgentSessionArchived);
export const mockedListenAppAiSettingsChanged = vi.mocked(listenAppAiSettingsChanged);
export const mockedListenAppEditorPreferencesChanged = vi.mocked(listenAppEditorPreferencesChanged);
export const mockedListenAppExportSettingsChanged = vi.mocked(listenAppExportSettingsChanged);
export const mockedListenAppLanguageChanged = vi.mocked(listenAppLanguageChanged);
export const mockedListenAppThemeChanged = vi.mocked(listenAppThemeChanged);
export const mockedListenAppWebSearchSettingsChanged = vi.mocked(listenAppWebSearchSettingsChanged);
export const mockedNotifyAppAiSettingsChanged = vi.mocked(notifyAppAiSettingsChanged);
export const mockedNotifyAppEditorPreferencesChanged = vi.mocked(notifyAppEditorPreferencesChanged);
export const mockedNotifyAppExportSettingsChanged = vi.mocked(notifyAppExportSettingsChanged);
export const mockedNotifyAppLanguageChanged = vi.mocked(notifyAppLanguageChanged);
export const mockedNotifyAppThemeChanged = vi.mocked(notifyAppThemeChanged);
export const mockedNotifyAppWebSearchSettingsChanged = vi.mocked(notifyAppWebSearchSettingsChanged);
export const mockedFetchAiProviderModels = vi.mocked(fetchAiProviderModels);
export const mockedTestAiProviderConnection = vi.mocked(testAiProviderConnection);
export const mockedChatCompletion = vi.mocked(chatCompletion);
export const mockedGenerateAiAgentSessionTitle = vi.mocked(generateAiAgentSessionTitle);

export const mockNativePath = "/mock-files/native.md";
export const mockDroppedPath = "/mock-files/dropped.md";
export const mockFolderPath = "/mock-files/vault";
export const mockUntitledPath = "/mock-files/Untitled.md";

export function mockSystemColorScheme(initiallyDark: boolean) {
  let matches = initiallyDark;
  const listeners = new Set<(event: MediaQueryListEvent) => unknown>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    onchange: null,
    addEventListener: vi.fn((_event: "change", listener: (event: MediaQueryListEvent) => unknown) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: "change", listener: (event: MediaQueryListEvent) => unknown) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn((listener: (event: MediaQueryListEvent) => unknown) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: (event: MediaQueryListEvent) => unknown) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn()
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQueryList)
  });

  return {
    setSystemDark(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches: nextMatches, media: "(prefers-color-scheme: dark)" } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    }
  };
}

export function mockOpenMarkdownFile(file: { content: string; name: string; path: string }) {
  mockedOpenNativeMarkdownPath.mockResolvedValue({
    kind: "file",
    file
  });
}

export type { NativeMenuHandlers } from "../lib/tauri";
export { AI_EDITOR_PREVIEW_ACTION_EVENT, AI_EDITOR_PREVIEW_RESTORE_EVENT } from "@markra/editor";

export function renderApp() {
  return render(<App />);
}

export function dispatchAiEditorPreviewAction(detail: Partial<AiEditorPreviewActionDetail>) {
  fireEvent(window, new CustomEvent(AI_EDITOR_PREVIEW_ACTION_EVENT, { detail }));
}

export function installAppTestHarness() {
  afterAll(async () => {
    // Milkdown ctx leaves 3s listener cleanup timers pending after editor teardown.
    await new Promise((resolve) => {
      window.setTimeout(resolve, 3200);
    });
  });

  beforeEach(() => {
    window.history.pushState({}, "", "/");
    mockedConsumeWelcomeDocumentState.mockReset();
    mockedCreateAiAgentSessionId.mockReset();
    mockedDeleteStoredAiAgentSession.mockReset();
    mockedConfirmNativeMarkdownFileDelete.mockReset();
    mockedConfirmNativeUnsavedMarkdownDocumentDiscard.mockReset();
    mockedCreateNativeMarkdownTreeFile.mockReset();
    mockedDeleteNativeMarkdownTreeFile.mockReset();
    mockedInstallNativeMarkdownFileDrop.mockReset();
    mockedOpenNativeMarkdownFolder.mockReset();
    mockedOpenNativeMarkdownFolderInNewWindow.mockReset();
    mockedOpenNativeMarkdownFileInNewWindow.mockReset();
    mockedOpenNativeMarkdownPath.mockReset();
    mockedReadNativeMarkdownImageFile.mockReset();
    mockedReadNativeMarkdownFile.mockReset();
    mockedSaveNativeHtmlFile.mockReset();
    mockedSaveNativePdfFile.mockReset();
    mockedRenameNativeMarkdownTreeFile.mockReset();
    mockedSaveNativeMarkdownFile.mockReset();
    mockedShowNativeMarkdownFileTreeContextMenu.mockReset();
    mockedListNativeMarkdownFilesForPath.mockReset();
    mockedWatchNativeMarkdownFile.mockReset();
    mockedInstallNativeApplicationMenu.mockReset();
    mockedInstallNativeEditorContextMenu.mockReset();
    mockedOpenNativeExternalUrl.mockReset();
    mockedCheckNativeAppUpdate.mockReset();
    mockedResolveDesktopPlatform.mockReset();
    mockedOpenSettingsWindow.mockReset();
    mockedGetStoredLanguage.mockReset();
    mockedGetStoredAiSettings.mockReset();
    mockedGetStoredAiAgentPreferences.mockReset();
    mockedGetStoredAiAgentSession.mockReset();
    mockedGetStoredAiAgentSessionSummary.mockReset();
    mockedGetStoredEditorPreferences.mockReset();
    mockedGetStoredExportSettings.mockReset();
    mockedGetStoredTheme.mockReset();
    mockedGetStoredWorkspaceState.mockReset();
    mockedInitializeStoredAiAgentSession.mockReset();
    mockedListStoredAiAgentSessions.mockReset();
    mockedResetWelcomeDocumentState.mockReset();
    mockedSaveStoredAiAgentSession.mockReset();
    mockedSaveStoredAiAgentSessionTitle.mockReset();
    mockedSaveStoredAiSettings.mockReset();
    mockedSaveStoredEditorPreferences.mockReset();
    mockedSaveStoredExportSettings.mockReset();
    mockedSaveStoredLanguage.mockReset();
    mockedSaveStoredTheme.mockReset();
    mockedSaveStoredWorkspaceState.mockReset();
    mockedSetStoredAiAgentSessionArchived.mockReset();
    mockedListenAppAiSettingsChanged.mockReset();
    mockedListenAppEditorPreferencesChanged.mockReset();
    mockedListenAppExportSettingsChanged.mockReset();
    mockedListenAppLanguageChanged.mockReset();
    mockedListenAppThemeChanged.mockReset();
    mockedNotifyAppAiSettingsChanged.mockReset();
    mockedNotifyAppEditorPreferencesChanged.mockReset();
    mockedNotifyAppExportSettingsChanged.mockReset();
    mockedNotifyAppLanguageChanged.mockReset();
    mockedNotifyAppThemeChanged.mockReset();
    mockedFetchAiProviderModels.mockReset();
    mockedTestAiProviderConnection.mockReset();
    mockedChatCompletion.mockReset();
    mockedGenerateAiAgentSessionTitle.mockReset();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-window");
    mockedWatchNativeMarkdownFile.mockResolvedValue(() => {});
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([]);
    mockedInstallNativeMarkdownFileDrop.mockResolvedValue(() => {});
    mockedInstallNativeApplicationMenu.mockResolvedValue(() => {});
    mockedInstallNativeEditorContextMenu.mockResolvedValue(() => {});
    mockedOpenNativeExternalUrl.mockResolvedValue(undefined);
    mockedCheckNativeAppUpdate.mockResolvedValue(null);
    mockedResolveDesktopPlatform.mockReturnValue("macos");
    mockedOpenSettingsWindow.mockResolvedValue(undefined);
    mockedReadNativeMarkdownImageFile.mockResolvedValue({
      dataUrl: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png",
      path: "/mock-files/assets/image.png",
      src: "assets/image.png"
    });
    mockedSaveStoredEditorPreferences.mockResolvedValue(undefined);
    mockedSaveStoredExportSettings.mockResolvedValue(undefined);
    mockedSaveNativeHtmlFile.mockResolvedValue({
      name: "Untitled.html",
      path: "/mock-files/Untitled.html"
    });
    mockedSaveNativePdfFile.mockResolvedValue({
      name: "Untitled.pdf",
      path: "/mock-files/Untitled.pdf"
    });
    mockedShowNativeMarkdownFileTreeContextMenu.mockResolvedValue(undefined);
    mockedListenAppAiSettingsChanged.mockResolvedValue(() => {});
    mockedListenAppEditorPreferencesChanged.mockResolvedValue(() => {});
    mockedListenAppExportSettingsChanged.mockResolvedValue(() => {});
    mockedListenAppWebSearchSettingsChanged.mockResolvedValue(() => {});
    mockedConsumeWelcomeDocumentState.mockResolvedValue(true);
    mockedCreateAiAgentSessionId.mockReturnValue("session-app");
    mockedConfirmNativeMarkdownFileDelete.mockResolvedValue(true);
    mockedConfirmNativeUnsavedMarkdownDocumentDiscard.mockResolvedValue(true);
    mockedCreateNativeMarkdownTreeFile.mockResolvedValue({
      name: "Daily note.md",
      path: "/mock-files/vault/Daily note.md",
      relativePath: "Daily note.md"
    });
    mockedDeleteNativeMarkdownTreeFile.mockResolvedValue(undefined);
    mockedRenameNativeMarkdownTreeFile.mockResolvedValue({
      name: "Renamed.md",
      path: "/mock-files/vault/Renamed.md",
      relativePath: "Renamed.md"
    });
    mockedGetStoredAiAgentSession.mockResolvedValue({
      agentModelId: null,
      agentProviderId: null,
      draft: "",
      messages: [],
      panelOpen: false,
      panelWidth: null,
      thinkingEnabled: false,
      webSearchEnabled: false
    });
    mockedGetStoredAiAgentPreferences.mockResolvedValue({
      thinkingEnabled: false,
      webSearchEnabled: false
    });
    mockedGetStoredWebSearchSettings.mockResolvedValue({
      contentMaxChars: 12000,
      enabled: true,
      maxResults: 5,
      providerId: "local-bing",
      searxngApiHost: ""
    });
    mockedGetStoredAiAgentSessionSummary.mockResolvedValue(null);
    mockedGetStoredEditorPreferences.mockResolvedValue({
      autoOpenAiOnSelection: true,
      bodyFontSize: 16,
      clipboardImageFolder: "assets",
      closeAiCommandOnAgentPanelOpen: false,
      contentWidth: "default",
      lineHeight: 1.65,
      markdownShortcuts: defaultMarkdownShortcuts,
      restoreWorkspaceOnStartup: true,
      showWordCount: true
    });
    mockedGetStoredExportSettings.mockResolvedValue({
      pdfAuthor: "",
      pdfFooter: "",
      pdfHeader: "",
      pdfHeightMm: 297,
      pdfMarginMm: 18,
      pdfMarginPreset: "default",
      pdfPageBreakOnH1: false,
      pdfPageSize: "default",
      pdfWidthMm: 210
    });
    mockedGetStoredAiSettings.mockResolvedValue({
      defaultModelId: "gpt-5.5",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-5.5",
          enabled: false,
          id: "openai",
          models: [
            {
              capabilities: ["text", "reasoning", "tools"],
              enabled: true,
              id: "gpt-5.5",
              name: "GPT-5.5"
            }
          ],
          name: "OpenAI",
          type: "openai"
        },
        {
          apiKey: "",
          baseUrl: "https://api.anthropic.com/v1",
          defaultModelId: "claude-opus-4-7",
          enabled: false,
          id: "anthropic",
          models: [
            {
              capabilities: ["text", "vision"],
              enabled: true,
              id: "claude-opus-4-7",
              name: "Claude Opus 4.7"
            }
          ],
          name: "Anthropic",
          type: "anthropic"
        }
      ]
    });
    mockedGetStoredLanguage.mockResolvedValue("en");
    mockedGetStoredTheme.mockResolvedValue("light");
    mockedGetStoredWorkspaceState.mockResolvedValue({
      aiAgentSessionId: "session-app",
      filePath: null,
      fileTreeOpen: false,
      folderName: null,
      folderPath: null
    });
    mockedResetWelcomeDocumentState.mockResolvedValue(undefined);
    mockedInitializeStoredAiAgentSession.mockResolvedValue(undefined);
    mockedListStoredAiAgentSessions.mockResolvedValue([]);
    mockedDeleteStoredAiAgentSession.mockResolvedValue(undefined);
    mockedSaveStoredAiAgentSession.mockResolvedValue(undefined);
    mockedSaveStoredAiAgentSessionTitle.mockResolvedValue(undefined);
    mockedSaveStoredAiSettings.mockResolvedValue(undefined);
    mockedSaveStoredLanguage.mockResolvedValue(undefined);
    mockedSaveStoredTheme.mockResolvedValue(undefined);
    mockedSaveStoredWorkspaceState.mockResolvedValue(undefined);
    mockedSetStoredAiAgentSessionArchived.mockResolvedValue(undefined);
    mockedListenAppLanguageChanged.mockResolvedValue(() => {});
    mockedListenAppThemeChanged.mockResolvedValue(() => {});
    mockedNotifyAppLanguageChanged.mockResolvedValue(undefined);
    mockedNotifyAppThemeChanged.mockResolvedValue(undefined);
    mockedFetchAiProviderModels.mockResolvedValue([
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "gpt-5", name: "GPT-5" },
      { capabilities: ["image"], enabled: true, id: "gpt-image-1", name: "GPT Image 1" }
    ]);
    mockedTestAiProviderConnection.mockResolvedValue({ message: "Connected", ok: true });
    mockedChatCompletion.mockResolvedValue({ content: "Improved AI draft", finishReason: "stop" });
    mockedGenerateAiAgentSessionTitle.mockResolvedValue(null);
    mockSystemColorScheme(false);
  });
}
