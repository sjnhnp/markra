import { emit, listen } from "@tauri-apps/api/event";
import {
  listenAppEditorPreferencesChanged,
  listenAppLanguageChanged,
  listenAppThemeChanged,
  notifyAppEditorPreferencesChanged,
  notifyAppLanguageChanged,
  notifyAppThemeChanged
} from "./settings-events";

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn()
}));

const mockedEmit = vi.mocked(emit);
const mockedListen = vi.mocked(listen);

describe("settings events", () => {
  beforeEach(() => {
    mockedEmit.mockReset();
    mockedListen.mockReset();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("does nothing outside the Tauri runtime", async () => {
    const cleanup = await listenAppThemeChanged(vi.fn());

    await notifyAppThemeChanged("dark");
    cleanup();

    expect(mockedListen).not.toHaveBeenCalled();
    expect(mockedEmit).not.toHaveBeenCalled();
  });

  it("emits and listens for theme changes inside Tauri", async () => {
    const unlisten = vi.fn();
    const onThemeChanged = vi.fn();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    mockedListen.mockResolvedValue(unlisten);

    const cleanup = await listenAppThemeChanged(onThemeChanged);
    const listener = mockedListen.mock.calls[0]?.[1];

    await notifyAppThemeChanged("system");
    listener?.({ payload: { theme: "system" } } as Parameters<NonNullable<typeof listener>>[0]);
    listener?.({ payload: { theme: "sepia" } } as Parameters<NonNullable<typeof listener>>[0]);
    cleanup();

    expect(mockedListen).toHaveBeenCalledWith("markra://theme-changed", expect.any(Function));
    expect(mockedEmit).toHaveBeenCalledWith("markra://theme-changed", { theme: "system" });
    expect(onThemeChanged).toHaveBeenCalledWith("system");
    expect(onThemeChanged).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("emits and listens for language changes inside Tauri", async () => {
    const unlisten = vi.fn();
    const onLanguageChanged = vi.fn();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    mockedListen.mockResolvedValue(unlisten);

    const cleanup = await listenAppLanguageChanged(onLanguageChanged);
    const listener = mockedListen.mock.calls[0]?.[1];

    await notifyAppLanguageChanged("fr");
    listener?.({ payload: { language: "fr" } } as Parameters<NonNullable<typeof listener>>[0]);
    listener?.({ payload: { language: "pirate" } } as Parameters<NonNullable<typeof listener>>[0]);
    cleanup();

    expect(mockedListen).toHaveBeenCalledWith("markra://language-changed", expect.any(Function));
    expect(mockedEmit).toHaveBeenCalledWith("markra://language-changed", { language: "fr" });
    expect(onLanguageChanged).toHaveBeenCalledWith("fr");
    expect(onLanguageChanged).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("emits and listens for editor preference changes inside Tauri", async () => {
    const unlisten = vi.fn();
    const onPreferencesChanged = vi.fn();
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    mockedListen.mockResolvedValue(unlisten);

    const cleanup = await listenAppEditorPreferencesChanged(onPreferencesChanged);
    const listener = mockedListen.mock.calls[0]?.[1];

    const preferences = {
      autoOpenAiOnSelection: false,
      bodyFontSize: 18,
      clipboardImageFolder: "images",
      closeAiCommandOnAgentPanelOpen: true,
      contentWidth: "wide" as const,
      lineHeight: 1.8,
      restoreWorkspaceOnStartup: false,
      showWordCount: false
    };

    await notifyAppEditorPreferencesChanged(preferences);
    listener?.({ payload: { preferences } } as Parameters<NonNullable<typeof listener>>[0]);
    listener?.({ payload: { preferences: { autoOpenAiOnSelection: "nope" } } } as Parameters<NonNullable<typeof listener>>[0]);
    cleanup();

    expect(mockedListen).toHaveBeenCalledWith("markra://editor-preferences-changed", expect.any(Function));
    expect(mockedEmit).toHaveBeenCalledWith("markra://editor-preferences-changed", {
      preferences
    });
    expect(onPreferencesChanged).toHaveBeenCalledWith(preferences);
    expect(onPreferencesChanged).toHaveBeenCalledTimes(1);
    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
