import { act, renderHook, waitFor } from "@testing-library/react";
import { defaultAiQuickActionPrompts } from "../lib/ai-actions";
import { getStoredEditorPreferences } from "../lib/settings/app-settings";
import { listenAppEditorPreferencesChanged } from "../lib/settings/settings-events";
import { useEditorPreferences } from "./useEditorPreferences";

vi.mock("../lib/settings/app-settings", () => ({
  defaultEditorPreferences: {
    aiQuickActionPrompts: {
      continue: "Continue after the target text. Return only the new Markdown to insert after it. Do not repeat the target text.",
      polish: "Polish the target text for clarity, flow, grammar, and word choice without adding new facts.",
      rewrite: "Rewrite the target text according to the user instruction while preserving the intended meaning unless asked otherwise.",
      summarize: "Summarize the target text concisely while preserving the important facts and Markdown readability.",
      translate: "Automatically detect the target text's current language before translating it. If the target text is mostly English, translate it into Simplified Chinese. If the target text is mostly Chinese, translate it into English. For other languages, translate it into English unless the user instruction names another target language. If the user instruction explicitly names a different target language, use that explicit language instead. Preserve Markdown formatting."
    },
    aiSelectionDisplayMode: "command",
    autoOpenAiOnSelection: true,
    bodyFontSize: 16,
    clipboardImageFolder: "assets",
    closeAiCommandOnAgentPanelOpen: false,
    contentWidth: "default",
    contentWidthPx: null,
    imageUpload: {
      fileNamePattern: "pasted-image-{timestamp}",
      provider: "local",
      s3: {
        accessKeyId: "",
        bucket: "",
        endpointUrl: "",
        publicBaseUrl: "",
        region: "",
        secretAccessKey: "",
        uploadPath: ""
      },
      webdav: {
        password: "",
        publicBaseUrl: "",
        serverUrl: "",
        uploadPath: "",
        username: ""
      }
    },
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
      aiQuickActionPrompts: defaultAiQuickActionPrompts,
      aiSelectionDisplayMode: "command",
      autoOpenAiOnSelection: true,
      bodyFontSize: 16,
      clipboardImageFolder: "assets",
      closeAiCommandOnAgentPanelOpen: false,
      contentWidth: "default",
      contentWidthPx: null,
      imageUpload: {
        fileNamePattern: "pasted-image-{timestamp}",
        provider: "local",
        s3: {
          accessKeyId: "",
          bucket: "",
          endpointUrl: "",
          publicBaseUrl: "",
          region: "",
          secretAccessKey: "",
          uploadPath: ""
        },
        webdav: {
          password: "",
          publicBaseUrl: "",
          serverUrl: "",
          uploadPath: "",
          username: ""
        }
      },
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
      suggestAiPanelForComplexInlinePrompts: true,
      showDocumentTabs: true,
      titlebarActions: [
        { id: "aiAgent", visible: true },
        { id: "sourceMode", visible: true },
        { id: "open", visible: true },
        { id: "save", visible: true },
        { id: "theme", visible: true }
      ],
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
        aiQuickActionPrompts: defaultAiQuickActionPrompts,
        aiSelectionDisplayMode: "command",
        autoOpenAiOnSelection: false,
        bodyFontSize: 18,
        clipboardImageFolder: "images",
        closeAiCommandOnAgentPanelOpen: true,
        contentWidth: "wide",
        contentWidthPx: 1120,
        imageUpload: {
          fileNamePattern: "{name}-{timestamp}",
          provider: "webdav",
          s3: {
            accessKeyId: "",
            bucket: "",
            endpointUrl: "",
            publicBaseUrl: "",
            region: "",
            secretAccessKey: "",
            uploadPath: ""
          },
          webdav: {
            password: "secret",
            publicBaseUrl: "",
            serverUrl: "https://dav.example.com/images",
            uploadPath: "notes",
            username: "ada"
          }
        },
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
        suggestAiPanelForComplexInlinePrompts: true,
        showDocumentTabs: false,
        titlebarActions: [
          { id: "theme", visible: true },
          { id: "save", visible: false },
          { id: "open", visible: true },
          { id: "sourceMode", visible: true },
          { id: "aiAgent", visible: true }
        ],
        showWordCount: false
      });
    });

    expect(result.current.preferences.autoOpenAiOnSelection).toBe(false);
    expect(result.current.preferences.aiSelectionDisplayMode).toBe("command");
    expect(result.current.preferences.bodyFontSize).toBe(18);
    expect(result.current.preferences.closeAiCommandOnAgentPanelOpen).toBe(true);
    expect(result.current.preferences.contentWidth).toBe("wide");
  });
});
