import { act, renderHook, waitFor } from "@testing-library/react";
import { getStoredAiSettings, saveStoredAiSettings } from "../lib/settings/appSettings";
import { useAiSettings } from "./useAiSettings";

vi.mock("../lib/settings/appSettings", () => ({
  getStoredAiSettings: vi.fn(),
  saveStoredAiSettings: vi.fn()
}));

const mockedGetStoredAiSettings = vi.mocked(getStoredAiSettings);
const mockedSaveStoredAiSettings = vi.mocked(saveStoredAiSettings);

describe("useAiSettings", () => {
  beforeEach(() => {
    mockedGetStoredAiSettings.mockReset();
    mockedSaveStoredAiSettings.mockReset();
    mockedSaveStoredAiSettings.mockResolvedValue(undefined);
  });

  it("selects the enabled default provider and a text-capable default model", async () => {
    mockedGetStoredAiSettings.mockResolvedValue({
      defaultModelId: "gpt-5.5",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "secret",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-image-2",
          enabled: true,
          id: "openai",
          models: [
            { capabilities: ["image"], enabled: true, id: "gpt-image-2", name: "GPT Image 2" },
            { capabilities: ["text", "vision"], enabled: true, id: "gpt-5.5", name: "GPT-5.5" }
          ],
          name: "OpenAI",
          type: "openai"
        }
      ]
    });

    const { result } = renderHook(() => useAiSettings());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeProvider?.id).toBe("openai");
    expect(result.current.defaultModelId).toBe("gpt-5.5");
    expect(result.current.availableTextModels).toEqual([
      {
        id: "gpt-5.5",
        name: "GPT-5.5",
        providerId: "openai",
        providerName: "OpenAI"
      }
    ]);
  });

  it("returns null provider/model when no enabled text provider exists", async () => {
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
          models: [{ capabilities: ["text"], enabled: true, id: "gpt-5.5", name: "GPT-5.5" }],
          name: "OpenAI",
          type: "openai"
        }
      ]
    });

    const { result } = renderHook(() => useAiSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.defaultModelId).toBeNull();
    expect(result.current.availableTextModels).toEqual([]);
  });

  it("persists the editor AI model selection", async () => {
    mockedGetStoredAiSettings.mockResolvedValue({
      defaultModelId: "gpt-5.5",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "openai-key",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-5.5",
          enabled: true,
          id: "openai",
          models: [{ capabilities: ["text"], enabled: true, id: "gpt-5.5", name: "GPT-5.5" }],
          name: "OpenAI",
          type: "openai"
        },
        {
          apiKey: "anthropic-key",
          baseUrl: "https://api.anthropic.com/v1",
          defaultModelId: "claude-opus-4-6",
          enabled: true,
          id: "anthropic",
          models: [
            { capabilities: ["text"], enabled: true, id: "claude-opus-4-6", name: "Claude Opus 4.6" },
            { capabilities: ["text", "reasoning"], enabled: true, id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" }
          ],
          name: "Anthropic",
          type: "anthropic"
        }
      ]
    });

    const { result } = renderHook(() => useAiSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.selectEditorModel("anthropic", "claude-sonnet-4-6");
    });

    expect(result.current.activeProvider?.id).toBe("anthropic");
    expect(result.current.defaultModelId).toBe("claude-sonnet-4-6");
    expect(mockedSaveStoredAiSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultModelId: "claude-sonnet-4-6",
        defaultProviderId: "anthropic",
        providers: expect.arrayContaining([
          expect.objectContaining({
            defaultModelId: "claude-sonnet-4-6",
            id: "anthropic"
          })
        ])
      })
    );
  });
});
