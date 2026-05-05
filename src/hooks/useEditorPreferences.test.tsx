import { act, renderHook, waitFor } from "@testing-library/react";
import { getStoredEditorPreferences } from "../lib/appSettings";
import { listenAppEditorPreferencesChanged } from "../lib/settingsEvents";
import { useEditorPreferences } from "./useEditorPreferences";

vi.mock("../lib/appSettings", () => ({
  defaultEditorPreferences: { autoOpenAiOnSelection: true },
  getStoredEditorPreferences: vi.fn()
}));

vi.mock("../lib/settingsEvents", () => ({
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
    mockedGetStoredEditorPreferences.mockResolvedValue({ autoOpenAiOnSelection: true });
    mockedListenAppEditorPreferencesChanged.mockImplementation(async (listener) => {
      onPreferencesChanged = listener;
      return () => {};
    });

    const { result } = renderHook(() => useEditorPreferences());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences.autoOpenAiOnSelection).toBe(true);

    act(() => {
      onPreferencesChanged?.({ autoOpenAiOnSelection: false });
    });

    expect(result.current.preferences.autoOpenAiOnSelection).toBe(false);
  });
});
