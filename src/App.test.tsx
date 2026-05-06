import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
import {
  openNativeMarkdownFolder,
  openNativeMarkdownFileInNewWindow,
  openNativeMarkdownPath,
  readNativeMarkdownFile,
  saveNativeMarkdownFile,
  installNativeMarkdownFileDrop,
  listNativeMarkdownFilesForPath,
  watchNativeMarkdownFile
} from "./lib/tauri/file";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu,
  type NativeMenuHandlers
} from "./lib/tauri/menu";
import { openSettingsWindow } from "./lib/tauri/window";
import {
  consumeWelcomeDocumentState,
  getStoredAiSettings,
  getStoredEditorPreferences,
  getStoredLanguage,
  getStoredTheme,
  getStoredWorkspaceState,
  resetWelcomeDocumentState,
  saveStoredAiSettings,
  saveStoredEditorPreferences,
  saveStoredLanguage,
  saveStoredTheme,
  saveStoredWorkspaceState
} from "./lib/settings/appSettings";
import {
  listenAppAiSettingsChanged,
  listenAppEditorPreferencesChanged,
  listenAppLanguageChanged,
  listenAppThemeChanged,
  notifyAppAiSettingsChanged,
  notifyAppEditorPreferencesChanged,
  notifyAppLanguageChanged,
  notifyAppThemeChanged
} from "./lib/settings/settingsEvents";
import { fetchAiProviderModels, testAiProviderConnection } from "./lib/ai/providers/aiProviderRequests";
import { chatCompletion } from "./lib/ai/agent/chatCompletion";
import { AI_EDITOR_PREVIEW_RESTORE_EVENT } from "./lib/ai/editorPreview";

vi.mock("./lib/tauri/file", () => ({
  installNativeMarkdownFileDrop: vi.fn(),
  openNativeMarkdownFolder: vi.fn(),
  openNativeMarkdownFileInNewWindow: vi.fn(),
  openNativeMarkdownPath: vi.fn(),
  readNativeMarkdownFile: vi.fn(),
  saveNativeMarkdownFile: vi.fn(),
  watchNativeMarkdownFile: vi.fn(),
  listNativeMarkdownFilesForPath: vi.fn()
}));

vi.mock("./lib/tauri/menu", () => ({
  installNativeApplicationMenu: vi.fn(),
  installNativeEditorContextMenu: vi.fn()
}));

vi.mock("./lib/settings/appSettings", () => ({
  consumeWelcomeDocumentState: vi.fn(),
  defaultEditorPreferences: { autoOpenAiOnSelection: true },
  getStoredAiSettings: vi.fn(),
  getStoredEditorPreferences: vi.fn(),
  getStoredLanguage: vi.fn(),
  getStoredTheme: vi.fn(),
  getStoredWorkspaceState: vi.fn(),
  resetWelcomeDocumentState: vi.fn(),
  saveStoredAiSettings: vi.fn(),
  saveStoredEditorPreferences: vi.fn(),
  saveStoredLanguage: vi.fn(),
  saveStoredTheme: vi.fn(),
  saveStoredWorkspaceState: vi.fn()
}));

vi.mock("./lib/settings/settingsEvents", () => ({
  listenAppAiSettingsChanged: vi.fn(),
  listenAppEditorPreferencesChanged: vi.fn(),
  listenAppLanguageChanged: vi.fn(),
  listenAppThemeChanged: vi.fn(),
  notifyAppAiSettingsChanged: vi.fn(),
  notifyAppEditorPreferencesChanged: vi.fn(),
  notifyAppLanguageChanged: vi.fn(),
  notifyAppThemeChanged: vi.fn()
}));

vi.mock("./lib/ai/providers/aiProviderRequests", () => ({
  fetchAiProviderModels: vi.fn(),
  testAiProviderConnection: vi.fn()
}));

vi.mock("./lib/ai/agent/chatCompletion", () => ({
  chatCompletion: vi.fn()
}));

vi.mock("./lib/tauri/window", () => ({
  openSettingsWindow: vi.fn(),
  setNativeWindowTitle: vi.fn()
}));

const mockedOpenNativeMarkdownFolder = vi.mocked(openNativeMarkdownFolder);
const mockedOpenNativeMarkdownFileInNewWindow = vi.mocked(openNativeMarkdownFileInNewWindow);
const mockedOpenNativeMarkdownPath = vi.mocked(openNativeMarkdownPath);
const mockedReadNativeMarkdownFile = vi.mocked(readNativeMarkdownFile);
const mockedSaveNativeMarkdownFile = vi.mocked(saveNativeMarkdownFile);
const mockedInstallNativeMarkdownFileDrop = vi.mocked(installNativeMarkdownFileDrop);
const mockedListNativeMarkdownFilesForPath = vi.mocked(listNativeMarkdownFilesForPath);
const mockedWatchNativeMarkdownFile = vi.mocked(watchNativeMarkdownFile);
const mockedInstallNativeApplicationMenu = vi.mocked(installNativeApplicationMenu);
const mockedInstallNativeEditorContextMenu = vi.mocked(installNativeEditorContextMenu);
const mockedOpenSettingsWindow = vi.mocked(openSettingsWindow);
const mockedConsumeWelcomeDocumentState = vi.mocked(consumeWelcomeDocumentState);
const mockedGetStoredAiSettings = vi.mocked(getStoredAiSettings);
const mockedGetStoredEditorPreferences = vi.mocked(getStoredEditorPreferences);
const mockedGetStoredLanguage = vi.mocked(getStoredLanguage);
const mockedGetStoredTheme = vi.mocked(getStoredTheme);
const mockedGetStoredWorkspaceState = vi.mocked(getStoredWorkspaceState);
const mockedResetWelcomeDocumentState = vi.mocked(resetWelcomeDocumentState);
const mockedSaveStoredAiSettings = vi.mocked(saveStoredAiSettings);
const mockedSaveStoredEditorPreferences = vi.mocked(saveStoredEditorPreferences);
const mockedSaveStoredLanguage = vi.mocked(saveStoredLanguage);
const mockedSaveStoredTheme = vi.mocked(saveStoredTheme);
const mockedSaveStoredWorkspaceState = vi.mocked(saveStoredWorkspaceState);
const mockedListenAppAiSettingsChanged = vi.mocked(listenAppAiSettingsChanged);
const mockedListenAppEditorPreferencesChanged = vi.mocked(listenAppEditorPreferencesChanged);
const mockedListenAppLanguageChanged = vi.mocked(listenAppLanguageChanged);
const mockedListenAppThemeChanged = vi.mocked(listenAppThemeChanged);
const mockedNotifyAppAiSettingsChanged = vi.mocked(notifyAppAiSettingsChanged);
const mockedNotifyAppEditorPreferencesChanged = vi.mocked(notifyAppEditorPreferencesChanged);
const mockedNotifyAppLanguageChanged = vi.mocked(notifyAppLanguageChanged);
const mockedNotifyAppThemeChanged = vi.mocked(notifyAppThemeChanged);
const mockedFetchAiProviderModels = vi.mocked(fetchAiProviderModels);
const mockedTestAiProviderConnection = vi.mocked(testAiProviderConnection);
const mockedChatCompletion = vi.mocked(chatCompletion);

const mockNativePath = "/mock-files/native.md";
const mockDroppedPath = "/mock-files/dropped.md";
const mockFolderPath = "/mock-files/vault";
const mockUntitledPath = "/mock-files/Untitled.md";

function mockSystemColorScheme(initiallyDark: boolean) {
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

function mockOpenMarkdownFile(file: { content: string; name: string; path: string }) {
  mockedOpenNativeMarkdownPath.mockResolvedValue({
    kind: "file",
    file
  });
}

describe("Markra workspace", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    mockedConsumeWelcomeDocumentState.mockReset();
    mockedInstallNativeMarkdownFileDrop.mockReset();
    mockedOpenNativeMarkdownFolder.mockReset();
    mockedOpenNativeMarkdownFileInNewWindow.mockReset();
    mockedOpenNativeMarkdownPath.mockReset();
    mockedReadNativeMarkdownFile.mockReset();
    mockedSaveNativeMarkdownFile.mockReset();
    mockedListNativeMarkdownFilesForPath.mockReset();
    mockedWatchNativeMarkdownFile.mockReset();
    mockedInstallNativeApplicationMenu.mockReset();
    mockedInstallNativeEditorContextMenu.mockReset();
    mockedOpenSettingsWindow.mockReset();
    mockedGetStoredLanguage.mockReset();
    mockedGetStoredAiSettings.mockReset();
    mockedGetStoredEditorPreferences.mockReset();
    mockedGetStoredTheme.mockReset();
    mockedGetStoredWorkspaceState.mockReset();
    mockedResetWelcomeDocumentState.mockReset();
    mockedSaveStoredAiSettings.mockReset();
    mockedSaveStoredEditorPreferences.mockReset();
    mockedSaveStoredLanguage.mockReset();
    mockedSaveStoredTheme.mockReset();
    mockedSaveStoredWorkspaceState.mockReset();
    mockedListenAppAiSettingsChanged.mockReset();
    mockedListenAppEditorPreferencesChanged.mockReset();
    mockedListenAppLanguageChanged.mockReset();
    mockedListenAppThemeChanged.mockReset();
    mockedNotifyAppAiSettingsChanged.mockReset();
    mockedNotifyAppEditorPreferencesChanged.mockReset();
    mockedNotifyAppLanguageChanged.mockReset();
    mockedNotifyAppThemeChanged.mockReset();
    mockedFetchAiProviderModels.mockReset();
    mockedTestAiProviderConnection.mockReset();
    mockedChatCompletion.mockReset();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-window");
    mockedWatchNativeMarkdownFile.mockResolvedValue(() => {});
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([]);
    mockedInstallNativeMarkdownFileDrop.mockResolvedValue(() => {});
    mockedInstallNativeApplicationMenu.mockResolvedValue(() => {});
    mockedInstallNativeEditorContextMenu.mockResolvedValue(() => {});
    mockedOpenSettingsWindow.mockResolvedValue(undefined);
    mockedListenAppAiSettingsChanged.mockResolvedValue(() => {});
    mockedListenAppEditorPreferencesChanged.mockResolvedValue(() => {});
    mockedConsumeWelcomeDocumentState.mockResolvedValue(true);
    mockedGetStoredEditorPreferences.mockResolvedValue({ autoOpenAiOnSelection: true });
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
      filePath: null,
      fileTreeOpen: false,
      folderName: null,
      folderPath: null
    });
    mockedResetWelcomeDocumentState.mockResolvedValue(undefined);
    mockedSaveStoredAiSettings.mockResolvedValue(undefined);
    mockedSaveStoredLanguage.mockResolvedValue(undefined);
    mockedSaveStoredTheme.mockResolvedValue(undefined);
    mockedSaveStoredWorkspaceState.mockResolvedValue(undefined);
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
    mockSystemColorScheme(false);
  });

  it("renders a Typora-like minimal writing surface", async () => {
    const { container } = render(<App />);
    const shell = container.querySelector(".app-shell");

    expect(screen.getByRole("heading", { name: "Untitled.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("Window drag region")).toBeInTheDocument();
    expect(await screen.findByText("Welcome to Markra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Markdown or Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown editor")).toHaveAttribute("data-editor-engine", "milkdown");
    expect(container.querySelector("[data-milkdown-root]")).toBeInTheDocument();
    expect(screen.queryByText("文件")).not.toBeInTheDocument();
    expect(container.querySelector(".native-title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toBeInTheDocument();
    expect(container.querySelector(".quiet-status")?.closest(".editor-content-slot")).toBeInTheDocument();
    expect(container.querySelector(".editor-content-slot")).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(container.querySelector(".quiet-status")).not.toHaveClass("fixed");
    expect(shell).toHaveClass("bg-(--bg-primary)");
    expect(shell).toHaveClass("grid-rows-[minmax(0,1fr)]");
    expect(shell).toHaveClass("overscroll-none");
  });

  it("opens settings from the lower-left settings launcher", async () => {
    render(<App />);

    await screen.findByText("Welcome to Markra");

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(mockedOpenSettingsWindow).toHaveBeenCalledTimes(1);
  });

  it("opens a right-side AI Agent workspace from the titlebar", async () => {
    mockedGetStoredAiSettings.mockResolvedValue({
      defaultModelId: "gpt-5.5",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "sk-test",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-5.5",
          enabled: true,
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
        }
      ]
    });
    const { container } = render(<App />);

    await screen.findByText("Welcome to Markra");

    fireEvent.click(screen.getByRole("button", { name: "Toggle AI Agent" }));

    expect(screen.getByRole("button", { name: "Toggle AI Agent" })).toHaveAttribute("aria-pressed", "true");
    const agentPanel = screen.getByRole("complementary", { name: "AI Agent" });
    expect(agentPanel).toBeInTheDocument();
    expect(within(agentPanel).getAllByText("OpenAI · GPT-5.5")[0]).toBeInTheDocument();
    expect(within(agentPanel).getByRole("combobox", { name: "AI model" })).toHaveValue("openai::gpt-5.5");
    expect(container.querySelector(".editor-agent-layout")).toHaveClass("grid-cols-[minmax(0,1fr)_24rem]");

    fireEvent.click(screen.getByRole("button", { name: "Close AI Agent" }));

    expect(screen.getByRole("button", { name: "Toggle AI Agent" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector(".editor-agent-layout")).toHaveClass("grid-cols-[minmax(0,1fr)_0rem]");
  });

  it("restores the AI command session when an applied suggestion is undone", async () => {
    render(<App />);

    await screen.findByText("Welcome to Markra");

    window.dispatchEvent(
      new CustomEvent(AI_EDITOR_PREVIEW_RESTORE_EVENT, {
        detail: {
          result: {
            from: 1,
            original: "Original",
            replacement: "Improved",
            to: 9,
            type: "replace"
          }
        }
      })
    );

    const commandInput = await screen.findByRole("textbox", { name: "AI command" });

    expect(screen.queryByText("AI suggestion ready")).not.toBeInTheDocument();
    expect(commandInput.closest(".ai-command-panel")).not.toBeInTheDocument();
    expect(commandInput.closest(".ai-command-box")).toHaveClass("border-(--accent)", "rounded-lg");
    expect(screen.getByRole("textbox", { name: "AI command" })).toHaveAttribute(
      "placeholder",
      "Tell AI what else needs to be changed..."
    );
  });

  it("restores the last opened markdown file on app launch", async () => {
    mockedGetStoredWorkspaceState.mockResolvedValue({
      filePath: mockNativePath,
      fileTreeOpen: false,
      folderName: null,
      folderPath: null
    });
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Restored file\n\nBack from last launch.",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    expect(await screen.findByText("Restored file")).toBeInTheDocument();
    expect(screen.getByText("Back from last launch.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "native.md" })).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockNativePath);
    expect(mockedConsumeWelcomeDocumentState).not.toHaveBeenCalled();
  });

  it("restores the last opened markdown folder on app launch", async () => {
    mockedGetStoredWorkspaceState.mockResolvedValue({
      filePath: null,
      fileTreeOpen: true,
      folderName: "vault",
      folderPath: mockFolderPath
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "index.md", path: "/mock-files/vault/index.md", relativePath: "index.md" },
      { name: "note.md", path: "/mock-files/vault/docs/note.md", relativePath: "docs/note.md" }
    ]);

    render(<App />);

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("vault")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "index.md" })).toBeInTheDocument();
    expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockFolderPath);
    expect(mockedConsumeWelcomeDocumentState).not.toHaveBeenCalled();
  });

  it("loads and persists the app color theme", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    mockedGetStoredTheme.mockResolvedValue("dark");

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));

    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await waitFor(() => expect(mockedSaveStoredTheme).toHaveBeenCalledWith("light"));
    await waitFor(() => expect(mockedNotifyAppThemeChanged).toHaveBeenCalledWith("light"));
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("updates the editor window when another window changes the theme", async () => {
    let onThemeChanged: ((theme: "light" | "dark" | "system") => unknown) | null = null;
    mockedListenAppThemeChanged.mockImplementation(async (listener) => {
      onThemeChanged = listener;
      return () => {};
    });

    render(<App />);

    await waitFor(() => expect(mockedListenAppThemeChanged).toHaveBeenCalledTimes(1));
    act(() => {
      onThemeChanged?.("dark");
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("follows the system color scheme when the stored theme preference is system", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    mockedGetStoredTheme.mockResolvedValue("system");
    const systemColorScheme = mockSystemColorScheme(true);

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));

    act(() => {
      systemColorScheme.setSystemDark(false);
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(mockedSaveStoredTheme).not.toHaveBeenCalled();
  });

  it("reinstalls native menus when another window changes the language", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    let onLanguageChanged: ((language: "en" | "zh-CN" | "fr") => unknown) | null = null;
    mockedListenAppLanguageChanged.mockImplementation(async (listener) => {
      onLanguageChanged = listener;
      return () => {};
    });

    render(<App />);

    await waitFor(() => expect(mockedInstallNativeApplicationMenu).toHaveBeenCalledWith(expect.any(Object), "en"));

    act(() => {
      onLanguageChanged?.("zh-CN");
    });

    await waitFor(() => expect(mockedInstallNativeApplicationMenu).toHaveBeenCalledWith(expect.any(Object), "zh-CN"));
  });

  it("waits for the stored language before replacing the Rust startup menu", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    let resolveLanguage: ((language: "fr") => unknown) | null = null;
    mockedGetStoredLanguage.mockReturnValue(
      new Promise((resolve) => {
        resolveLanguage = resolve;
      })
    );

    render(<App />);

    await waitFor(() => expect(mockedGetStoredLanguage).toHaveBeenCalledTimes(1));
    expect(mockedInstallNativeApplicationMenu).not.toHaveBeenCalled();

    act(() => {
      resolveLanguage?.("fr");
    });

    await waitFor(() => expect(mockedInstallNativeApplicationMenu).toHaveBeenCalledWith(expect.any(Object), "fr"));
  });

  it("renders an independent settings window route", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    window.history.pushState({}, "", "/?settings=1");

    const { container } = render(<App />);

    await waitFor(() => expect(container.querySelector(".settings-window")).toBeInTheDocument());
    expect(container.querySelector(".settings-drag-region")).toHaveAttribute("data-tauri-drag-region");
    expect(container.querySelector(".settings-window")).not.toHaveClass("border");
    expect(container.querySelector(".settings-window")).toHaveClass("overscroll-none");
    expect(container.querySelector(".settings-scroll")).toHaveClass("overscroll-none");
    expect(container.querySelector(".settings-sidebar-title")).toBeInTheDocument();
    expect(container.querySelector(".settings-sidebar nav")).toBeInTheDocument();
    expect(container.querySelector(".settings-layout")).toHaveClass("grid-cols-[180px_minmax(0,1fr)]");
    expect(container.querySelector(".settings-sidebar")).toHaveClass("bg-(--bg-secondary)");
    expect(container.querySelector(".settings-content-header")).toHaveClass("border-b");
    expect(container.querySelector(".settings-panel-title")).toHaveClass("text-[16px]");
    const settingsGroups = Array.from(container.querySelectorAll(".settings-list-group"));
    expect(settingsGroups.length).toBeGreaterThan(0);
    settingsGroups.forEach((group) => expect(group).not.toHaveClass("border-y"));
    expect(settingsGroups[0]).not.toHaveClass("divide-y");
    expect(settingsGroups.at(-1)).toHaveClass("divide-y");
    const categoryButtons = Array.from(container.querySelectorAll(".settings-sidebar nav button"));
    expect(categoryButtons).toHaveLength(6);
    expect(categoryButtons[0]).toHaveAttribute("aria-current", "page");
    expect(categoryButtons[1]).not.toHaveAttribute("aria-current");
    const languageSelect = container.querySelector("select");
    expect(languageSelect).toHaveValue("en");
    expect(container.querySelector('[role="group"]')).not.toBeInTheDocument();
    expect(container.querySelector(".markdown-paper")).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-window", "settings");

    fireEvent.change(languageSelect!, {
      target: { value: "zh-CN" }
    });
    await waitFor(() => expect(mockedSaveStoredLanguage).toHaveBeenCalledWith("zh-CN"));
    await waitFor(() => expect(mockedNotifyAppLanguageChanged).toHaveBeenCalledWith("zh-CN"));

    fireEvent.click(categoryButtons[2]);
    expect(categoryButtons[2]).toHaveAttribute("aria-current", "page");
    const themeGroup = container.querySelector('[role="group"]');
    expect(themeGroup).toBeInTheDocument();
    const themeButtons = themeGroup?.querySelectorAll("button");
    expect(themeButtons).toHaveLength(3);
    expect(screen.getByRole("button", { name: "跟随系统主题" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "使用深色主题" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await waitFor(() => expect(mockedSaveStoredTheme).toHaveBeenCalledWith("dark"));
    await waitFor(() => expect(mockedNotifyAppThemeChanged).toHaveBeenCalledWith("dark"));
  });

  it("edits and stores AI provider settings from the settings window", async () => {
    window.history.pushState({}, "", "/?settings=1");

    const { container } = render(<App />);

    await waitFor(() => expect(container.querySelector(".settings-window")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "AI" }));

    expect(await screen.findByRole("button", { name: "OpenAI" })).toHaveAttribute("aria-current", "page");
    expect(container.querySelector(".ai-settings-layout")).toHaveClass("h-full", "min-h-0", "grid-cols-[16rem_minmax(0,1fr)]");
    expect(container.querySelector(".ai-settings-layout")?.children).toHaveLength(2);
    expect(container.querySelector(".ai-provider-list-scroll")).toHaveClass("min-h-0", "overflow-auto");
    expect(screen.getAllByRole("img", { name: "OpenAI logo" })).toHaveLength(2);
    expect(screen.getByLabelText("Search providers")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Add provider" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Provider name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("API style")).not.toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByLabelText("API URL")).toHaveValue("https://api.openai.com/v1");

    fireEvent.click(screen.getByRole("button", { name: "Add model" }));
    expect(screen.getByRole("group", { name: "Capability" })).toBeInTheDocument();
    expect(["Text", "Image", "Vision", "Reasoning", "Tools"].map((label) => screen.getByRole("button", { name: label }))).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Text" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Vision" }));
    expect(screen.getByRole("button", { name: "Vision" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "gpt-5.5-thinking" }
    });
    fireEvent.change(screen.getByLabelText("Model name"), {
      target: { value: "GPT-5.5 Thinking" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Add model to provider" }));

    expect(screen.getAllByText("GPT-5.5 Thinking").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Edit model GPT-5.5 Thinking" }));
    expect(screen.getByLabelText("Model ID")).toHaveValue("gpt-5.5-thinking");
    expect(screen.getByLabelText("Model name")).toHaveValue("GPT-5.5 Thinking");
    fireEvent.change(screen.getByLabelText("Model ID"), {
      target: { value: "gpt-5.5-thinking-updated" }
    });
    fireEvent.change(screen.getByLabelText("Model name"), {
      target: { value: "GPT-5.5 Thinking Updated" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Vision" }));
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Save model changes" }));

    expect(screen.getAllByText("GPT-5.5 Thinking Updated").length).toBeGreaterThan(0);
    expect(screen.queryByText("GPT-5.5 Thinking")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" }
    });
    fireEvent.change(screen.getByLabelText("API URL"), {
      target: { value: "https://api.openai.com/v1" }
    });
    fireEvent.click(screen.getByRole("switch", { name: "Enable provider" }));
    fireEvent.click(screen.getByRole("button", { name: "Test API" }));

    await waitFor(() =>
      expect(mockedTestAiProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: "sk-test",
          baseUrl: "https://api.openai.com/v1",
          id: "openai"
        })
      )
    );
    await waitFor(() => expect(document.querySelector(".app-toast")).toHaveTextContent("Connected"));
    expect(document.querySelector(".app-toaster")).toHaveStyle({ width: "fit-content" });
    expect(document.querySelector(".app-toast")).toHaveClass("app-toast-centered");
    expect(document.querySelector(".app-toast")).toHaveClass("w-fit", "min-w-40");
    expect(document.querySelector(".app-toast")).not.toHaveClass("w-[24rem]");
    expect(document.querySelector(".app-toast-close")).toBeInTheDocument();
    expect(document.querySelector(".app-toast-close")).toHaveClass("absolute", "right-2");
    expect(document.querySelector(".app-toast-close")).not.toHaveClass("ml-auto");
    expect(screen.getAllByText("Connected")).toHaveLength(1);
    fireEvent.click(document.querySelector(".app-toast-close") as HTMLElement);
    await waitFor(() => expect(document.querySelector(".app-toast")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Get model list" }));

    await waitFor(() => expect(mockedFetchAiProviderModels).toHaveBeenCalledWith(expect.objectContaining({ id: "openai" })));
    await waitFor(() => expect(screen.getAllByText("GPT-5").length).toBeGreaterThan(0));
    expect(screen.getAllByText("GPT Image 1").length).toBeGreaterThan(0);
    await waitFor(() => expect(document.querySelector(".app-toast")).toHaveTextContent("Model list updated."));

    fireEvent.click(screen.getByRole("button", { name: "Save AI providers" }));

    await waitFor(() =>
      expect(mockedSaveStoredAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          providers: expect.arrayContaining([
            expect.objectContaining({
              apiKey: "sk-test",
              baseUrl: "https://api.openai.com/v1",
              enabled: true,
              id: "openai",
              models: expect.arrayContaining([
                expect.objectContaining({ id: "gpt-5" }),
                expect.objectContaining({ capabilities: ["image"], id: "gpt-image-1" }),
                expect.objectContaining({
                  capabilities: ["text", "tools"],
                  id: "gpt-5.5-thinking-updated",
                  name: "GPT-5.5 Thinking Updated"
                })
              ])
            })
          ])
        })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: "Add provider" }));

    expect(screen.getByLabelText("Provider name")).toHaveValue("Custom Provider");
    expect(screen.getByLabelText("API style")).toHaveValue("openai-compatible");
    expect(screen.getByLabelText("API URL")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Delete provider" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("API style"), {
      target: { value: "mistral" }
    });

    expect(screen.getByLabelText("API URL")).toHaveValue("https://api.mistral.ai/v1");

    fireEvent.click(screen.getByRole("button", { name: "Delete provider" }));

    expect(screen.queryByRole("button", { name: "Custom Provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete provider" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OpenAI" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(document.querySelector(".app-toast")).toHaveTextContent("Provider deleted."));
  });

  it("resets the welcome document from settings", async () => {
    window.history.pushState({}, "", "/?settings=1");

    const { container } = render(<App />);

    await waitFor(() => expect(container.querySelector(".settings-sidebar nav button")).toHaveAttribute("aria-current", "page"));
    expect(container.querySelector('[role="group"]')).not.toBeInTheDocument();

    const resetButton = container.querySelector(".settings-row button");
    fireEvent.click(resetButton!);

    await waitFor(() => expect(mockedResetWelcomeDocumentState).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("opens a folder markdown tree from the lower-left file list button", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "native.md", path: mockNativePath, relativePath: "native.md" },
      { name: "guide.md", path: "/mock-files/docs/guide.md", relativePath: "docs/guide.md" }
    ]);

    const { container } = render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();
    await waitFor(() => expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockNativePath));

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("complementary", { name: "Markdown file tree" })).not.toHaveClass("fixed");
    expect(container.querySelector(".workspace-layout")).toHaveClass("grid-cols-[18rem_minmax(0,1fr)]");
    expect(container.querySelector(".workspace-layout")).toHaveClass("transition-[grid-template-columns]");
    expect(container.querySelector(".file-tree-scroll")).toHaveClass("overscroll-none");
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("mock-files")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "docs" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "native.md" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "docs/guide.md" })).not.toBeInTheDocument();
  });

  it("opens a markdown folder from the shared Cmd+O open picker", async () => {
    mockedOpenNativeMarkdownPath.mockResolvedValue({
      kind: "folder",
      folder: {
        path: mockFolderPath,
        name: "vault"
      }
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "index.md", path: "/mock-files/vault/index.md", relativePath: "index.md" },
      { name: "note.md", path: "/mock-files/vault/docs/note.md", relativePath: "docs/note.md" }
    ]);

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("vault")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "index.md" })).toBeInTheDocument();
    expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockFolderPath);
  });

  it("opens a markdown folder into the sidebar file tree", async () => {
    mockedOpenNativeMarkdownFolder.mockResolvedValue({
      path: mockFolderPath,
      name: "vault"
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "index.md", path: "/mock-files/vault/index.md", relativePath: "index.md" },
      { name: "note.md", path: "/mock-files/vault/docs/note.md", relativePath: "docs/note.md" }
    ]);

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true, shiftKey: true });

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("vault")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "index.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "docs" })).toHaveAttribute("aria-expanded", "false");
    expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockFolderPath);
  });

  it("opens a markdown file from the current folder tree", async () => {
    const guidePath = "/mock-files/docs/guide.md";
    const rootTree = [
      { name: "native.md", path: mockNativePath, relativePath: "native.md" },
      { name: "guide.md", path: guidePath, relativePath: "docs/guide.md" }
    ];
    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedListNativeMarkdownFilesForPath.mockImplementation(async (path) =>
      path === guidePath ? [{ name: "guide.md", path: guidePath, relativePath: "guide.md" }] : rootTree
    );
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Guide\n\nOpened from the folder tree.",
      name: "guide.md",
      path: guidePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "docs" }));
    fireEvent.click(await screen.findByRole("button", { name: "docs/guide.md" }));

    expect(await screen.findByText("Guide")).toBeInTheDocument();
    expect(screen.getByText("Opened from the folder tree.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "guide.md" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "docs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "native.md" })).toBeInTheDocument();
    expect(mockedListNativeMarkdownFilesForPath).not.toHaveBeenCalledWith(guidePath);
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(guidePath);
  });

  it("switches the sidebar top-left action to a document outline view", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\n## Details",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));

    expect(screen.getByText("Outline")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Document outline" })).toHaveTextContent("Native file");
    expect(screen.getByRole("list", { name: "Document outline" })).toHaveTextContent("Details");
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
  });

  it("focuses the editor when an outline heading is selected", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nParagraph\n\n## Details\n\nTarget body",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Markdown document" })).toHaveFocus());
  });

  it("scrolls a selected outline heading below the top of the writing viewport", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nParagraph\n\n## Details\n\nTarget body",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();

    const writingSurface = screen.getByLabelText("Writing surface");
    const detailsHeading = screen.getByRole("heading", { name: "Details" });
    const scrollTo = vi.fn();
    Object.defineProperty(writingSurface, "scrollTop", {
      configurable: true,
      value: 120
    });
    Object.defineProperty(writingSurface, "scrollTo", {
      configurable: true,
      value: scrollTo
    });
    vi.spyOn(writingSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 710,
      height: 700,
      left: 0,
      right: 900,
      top: 10,
      width: 900,
      x: 0,
      y: 10,
      toJSON: () => ({})
    });
    vi.spyOn(detailsHeading, "getBoundingClientRect").mockReturnValue({
      bottom: 350,
      height: 40,
      left: 160,
      right: 760,
      top: 310,
      width: 600,
      x: 160,
      y: 310,
      toJSON: () => ({})
    });

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({
        behavior: "auto",
        top: 396
      })
    );
  });

  it("keeps outline heading navigation stable across repeated heading clicks", async () => {
    mockOpenMarkdownFile({
      content: "# A\n\nA body\n\n# B\n\nB body",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("A body")).toBeInTheDocument();

    const writingSurface = screen.getByLabelText("Writing surface");
    const headingA = screen.getByRole("heading", { name: "A" });
    const headingB = screen.getByRole("heading", { name: "B" });
    const scrollTo = vi.fn();
    let currentScrollTop = 0;
    Object.defineProperty(writingSurface, "scrollTop", {
      configurable: true,
      get: () => currentScrollTop
    });
    Object.defineProperty(writingSurface, "scrollTo", {
      configurable: true,
      value: scrollTo
    });
    scrollTo.mockImplementation(({ top }: ScrollToOptions) => {
      currentScrollTop = Number(top);
    });
    vi.spyOn(writingSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 710,
      height: 700,
      left: 0,
      right: 900,
      top: 10,
      width: 900,
      x: 0,
      y: 10,
      toJSON: () => ({})
    });
    vi.spyOn(headingA, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 50 - currentScrollTop,
      height: 40,
      left: 160,
      right: 760,
      top: 10 - currentScrollTop,
      width: 600,
      x: 160,
      y: 10 - currentScrollTop,
      toJSON: () => ({})
    }));
    vi.spyOn(headingB, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 450 - currentScrollTop,
      height: 40,
      left: 160,
      right: 760,
      top: 410 - currentScrollTop,
      width: 600,
      x: 160,
      y: 410 - currentScrollTop,
      toJSON: () => ({})
    }));

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));

    await waitFor(() =>
      expect(scrollTo.mock.calls.map(([options]) => (options as ScrollToOptions).top)).toEqual([376, 0, 376])
    );
  });

  it("shows the welcome document only on the first nonblank app launch", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const firstLaunch = render(<App />);

    expect(await screen.findByText("Welcome to Markra")).toBeInTheDocument();

    firstLaunch.unmount();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Untitled.md" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Markdown editor")).toHaveTextContent(/^$/);
    expect(screen.queryByText("Welcome to Markra")).not.toBeInTheDocument();
    expect(mockedConsumeWelcomeDocumentState).toHaveBeenCalledTimes(2);
  });

  it("starts a native new-document window with an empty untitled document", async () => {
    window.history.pushState({}, "", "/?blank=1");

    render(<App />);

    expect(screen.getByRole("heading", { name: "Untitled.md" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Markdown editor")).toHaveTextContent(/^$/);
    expect(screen.queryByText("Welcome to Markra")).not.toBeInTheDocument();
    expect(mockedConsumeWelcomeDocumentState).not.toHaveBeenCalled();
  });

  it("focuses the editor when the default launch opens an empty document", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);

    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "Markdown document" });

    await waitFor(() => expect(editor).toHaveFocus());
  });

  it("focuses the editor when a native new-document window opens", async () => {
    window.history.pushState({}, "", "/?blank=1");

    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "Markdown document" });

    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it("loads a markdown file when a native file window opens with an initial path", async () => {
    window.history.pushState({}, "", "/?path=%2Fmock-files%2Fdropped.md");
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Dropped file\n\nOpened in a new window.",
      name: "dropped.md",
      path: mockDroppedPath
    });

    render(<App />);

    expect(await screen.findByText("Dropped file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dropped.md" })).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockDroppedPath);
    expect(mockedConsumeWelcomeDocumentState).not.toHaveBeenCalled();
  });

  it("opens a dropped markdown file in the current empty editor", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Dropped file\n\nOpened from drag and drop.",
      name: "dropped.md",
      path: mockDroppedPath
    });

    render(<App />);
    await waitFor(() => expect(mockedInstallNativeMarkdownFileDrop).toHaveBeenCalledTimes(1));
    const handleDrop = mockedInstallNativeMarkdownFileDrop.mock.calls[0]?.[0];

    await act(async () => {
      await handleDrop?.(mockDroppedPath);
    });

    expect(await screen.findByText("Dropped file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dropped.md" })).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockDroppedPath);
    expect(mockedOpenNativeMarkdownFileInNewWindow).not.toHaveBeenCalled();
  });

  it("opens a dropped markdown file in a new window when the current editor has content", async () => {
    render(<App />);
    await screen.findByText("Welcome to Markra");
    await waitFor(() => expect(mockedInstallNativeMarkdownFileDrop).toHaveBeenCalledTimes(1));
    const handleDrop = mockedInstallNativeMarkdownFileDrop.mock.calls[0]?.[0];

    await act(async () => {
      await handleDrop?.(mockDroppedPath);
    });

    expect(mockedOpenNativeMarkdownFileInNewWindow).toHaveBeenCalledWith(mockDroppedPath);
    expect(mockedReadNativeMarkdownFile).not.toHaveBeenCalledWith(mockDroppedPath);
    expect(screen.getByText("Welcome to Markra")).toBeInTheDocument();
  });

  it("saves an untitled document with the native save dialog shortcut", async () => {
    mockedSaveNativeMarkdownFile.mockResolvedValue({
      name: "Untitled.md",
      path: mockUntitledPath
    });

    render(<App />);
    await screen.findByText("Welcome to Markra");

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: null,
          suggestedName: "Untitled.md"
        })
      )
    );
  });

  it("opens and saves markdown files through native Tauri file APIs", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedSaveNativeMarkdownFile.mockResolvedValue({
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(await screen.findByText("Native file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "native.md" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: mockNativePath,
          suggestedName: "native.md"
        })
      )
    );
  });

  it("wires native menu file actions to the current document commands", async () => {
    mockOpenMarkdownFile({
      content: "# Native menu file\n\nOpened from the native menu.",
      name: "native-menu.md",
      path: mockNativePath
    });
    mockedSaveNativeMarkdownFile.mockResolvedValue({
      name: "native-menu.md",
      path: mockNativePath
    });

    render(<App />);

    await waitFor(() => expect(mockedInstallNativeApplicationMenu).toHaveBeenCalledTimes(1));
    const menuHandlers = mockedInstallNativeApplicationMenu.mock.calls[0]?.[0] as NativeMenuHandlers;

    await act(async () => {
      await menuHandlers.openDocument?.();
    });

    expect(await screen.findByText("Native menu file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "native-menu.md" })).toBeInTheDocument();

    await act(async () => {
      await menuHandlers.saveDocument?.();
    });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: mockNativePath,
          suggestedName: "native-menu.md"
        })
      )
    );

    await act(async () => {
      await menuHandlers.saveDocumentAs?.();
    });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: null,
          suggestedName: "native-menu.md"
        })
      )
    );

    expect(screen.getByRole("heading", { name: "native-menu.md" })).toBeInTheDocument();
  });

  it("reloads the current file when a native watcher reports an external change", async () => {
    let emitExternalChange: (path: string) => unknown | Promise<unknown> = () => {};

    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Changed elsewhere\n\nReloaded from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedWatchNativeMarkdownFile.mockImplementation(async (_, onChange) => {
      emitExternalChange = onChange;
      return () => {};
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(await screen.findByText("Native file")).toBeInTheDocument();

    await waitFor(() => expect(mockedWatchNativeMarkdownFile).toHaveBeenCalledWith(mockNativePath, expect.any(Function)));
    await emitExternalChange(mockNativePath);

    expect(await screen.findByText("Changed elsewhere")).toBeInTheDocument();
    expect(screen.getByText("Reloaded from disk.")).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockNativePath);
  });
});
