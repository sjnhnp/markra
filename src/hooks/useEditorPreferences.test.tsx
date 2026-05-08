import { act, renderHook, waitFor } from "@testing-library/react";
import { getStoredEditorPreferences } from "../lib/settings/appSettings";
import { listenAppEditorPreferencesChanged } from "../lib/settings/settingsEvents";
import { useEditorPreferences } from "./useEditorPreferences";

vi.mock("../lib/settings/appSettings", () => ({
  defaultEditorPreferences: {
    autoOpenAiOnSelection: true,
    bodyFontSize: 16,
    clipboardImageFolder: "assets",
    contentWidth: "default",
    lineHeight: 1.65,
    restoreWorkspaceOnStartup: true,
    showWordCount: true
  },
  getStoredEditorPreferences: vi.fn()
}));

vi.mock("../lib/settings/settingsEvents", () => ({
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
      contentWidth: "default",
      lineHeight: 1.65,
      restoreWorkspaceOnStartup: true,
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
        contentWidth: "wide",
        lineHeight: 1.8,
        restoreWorkspaceOnStartup: false,
        showWordCount: false
      });
    });

    expect(result.current.preferences.autoOpenAiOnSelection).toBe(false);
    expect(result.current.preferences.bodyFontSize).toBe(18);
    expect(result.current.preferences.contentWidth).toBe("wide");
  });
});
