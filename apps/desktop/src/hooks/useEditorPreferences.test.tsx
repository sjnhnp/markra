import { act, renderHook, waitFor } from "@testing-library/react";
import { getStoredEditorPreferences } from "../lib/settings/app-settings";
import { listenAppEditorPreferencesChanged } from "../lib/settings/settings-events";
import { useEditorPreferences } from "./useEditorPreferences";

vi.mock("../lib/settings/app-settings", () => ({
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
      image: "Mod+Shift+I",
      inlineCode: "Mod+E",
      italic: "Mod+I",
      link: "Mod+K",
      orderedList: "Mod+Shift+7",
      paragraph: "Mod+Alt+0",
      quote: "Mod+Shift+B",
      strikethrough: "Mod+Shift+X",
      table: "Mod+Alt+T",
      toggleAiAgent: "Mod+Alt+J",
      toggleAiCommand: "Mod+Shift+J",
      toggleMarkdownFiles: "Mod+Shift+M",
      toggleSourceMode: "Mod+Alt+S"
    },
    restoreWorkspaceOnStartup: true,
    showDocumentTabs: true,
    showWordCount: true
  },
  getStoredEditorPreferences: vi.fn()
}));

vi.mock("../lib/settings/settings-events", () => ({
  listenAppEditorPreferencesChanged: vi.fn()
}));

const mockedGetStoredEditorPreferences = vi.mocked(getStoredEditorPreferences);
const mockedListenAppEditorPreferencesChanged = vi.mocked(listenAppEditorPreferencesChanged);

describe("useEditorPreferences", () => {
  beforeEach(() => {
    mockedGetStoredEditorPreferences.mockReset();
    mockedListenAppEditorPreferencesChanged.mockReset();
    mockedListenAppEditorPreferencesChanged.mockResolvedValue(() => {});
  });

  it("loads editor preferences and reacts to cross-window preference changes", async () => {
    let onPreferencesChanged: Parameters<typeof listenAppEditorPreferencesChanged>[0] | null = null;
    mockedGetStoredEditorPreferences.mockResolvedValue({
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
        image: "Mod+Shift+I",
        inlineCode: "Mod+E",
        italic: "Mod+I",
        link: "Mod+K",
        orderedList: "Mod+Shift+7",
        paragraph: "Mod+Alt+0",
        quote: "Mod+Shift+B",
        strikethrough: "Mod+Shift+X",
        table: "Mod+Alt+T",
        toggleAiAgent: "Mod+Alt+J",
        toggleAiCommand: "Mod+Shift+J",
        toggleMarkdownFiles: "Mod+Shift+M",
        toggleSourceMode: "Mod+Alt+S"
      },
      restoreWorkspaceOnStartup: true,
      showDocumentTabs: true,
      showWordCount: true
    });
    mockedListenAppEditorPreferencesChanged.mockImplementation(async (listener) => {
      onPreferencesChanged = listener;
      return () => {};
    });

    const { result } = renderHook(() => useEditorPreferences());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences.autoOpenAiOnSelection).toBe(true);

    act(() => {
      onPreferencesChanged?.({
        autoOpenAiOnSelection: false,
        bodyFontSize: 18,
        clipboardImageFolder: "images",
        closeAiCommandOnAgentPanelOpen: true,
        contentWidth: "wide",
        lineHeight: 1.8,
        markdownShortcuts: {
          bold: "Mod+Alt+B",
          bulletList: "Mod+Shift+8",
          codeBlock: "Mod+Alt+C",
          heading1: "Mod+Alt+1",
          heading2: "Mod+Alt+2",
          heading3: "Mod+Alt+3",
          image: "Mod+Shift+I",
          inlineCode: "Mod+E",
          italic: "Mod+I",
          link: "Mod+K",
          orderedList: "Mod+Shift+7",
          paragraph: "Mod+Alt+0",
          quote: "Mod+Shift+B",
          strikethrough: "Mod+Shift+X",
          table: "Mod+Alt+T",
          toggleAiAgent: "Mod+Alt+J",
          toggleAiCommand: "Mod+Shift+J",
          toggleMarkdownFiles: "Mod+Shift+M",
          toggleSourceMode: "Mod+Alt+S"
        },
        restoreWorkspaceOnStartup: false,
        showDocumentTabs: false,
        showWordCount: false
      });
    });

    expect(result.current.preferences.autoOpenAiOnSelection).toBe(false);
    expect(result.current.preferences.bodyFontSize).toBe(18);
    expect(result.current.preferences.closeAiCommandOnAgentPanelOpen).toBe(true);
    expect(result.current.preferences.contentWidth).toBe("wide");
  });
});
