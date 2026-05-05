import { act, renderHook } from "@testing-library/react";
import { chatCompletion } from "../lib/agent/chatCompletion";
import { useAiCommandUi } from "./useAiCommandUi";
import type { AiProviderConfig } from "../lib/aiProviders";

vi.mock("../lib/agent/chatCompletion", () => ({
  chatCompletion: vi.fn()
}));

const mockedChatCompletion = vi.mocked(chatCompletion);

function provider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    apiKey: "secret",
    baseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-5.5",
    enabled: true,
    id: "openai",
    models: [],
    name: "OpenAI",
    type: "openai",
    ...overrides
  };
}

describe("useAiCommandUi", () => {
  beforeEach(() => {
    mockedChatCompletion.mockReset();
  });

  it("returns a configuration error when no provider is ready", async () => {
    const onAiResult = vi.fn();
    const { result } = renderHook(() =>
      useAiCommandUi({
        getDocumentContent: () => "# Draft",
        getSelection: () => ({ from: 2, text: "Draft", to: 7 }),
        model: null,
        onAiResult,
        provider: null,
        settingsLoading: false
      })
    );

    act(() => {
      result.current.updatePrompt("rewrite");
    });
    await act(async () => {
      await result.current.submitPrompt();
    });

    expect(mockedChatCompletion).not.toHaveBeenCalled();
    expect(onAiResult).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });

  it("calls chat completion with editor context and emits a replace result", async () => {
    const onAiResult = vi.fn();
    mockedChatCompletion.mockResolvedValue({ content: "Better draft", finishReason: "stop" });
    const { result } = renderHook(() =>
      useAiCommandUi({
        getDocumentContent: () => "# Draft\n\nOriginal draft",
        getSelection: () => ({ from: 9, text: "Original draft", to: 23 }),
        model: "gpt-5.5",
        onAiResult,
        provider: provider(),
        settingsLoading: false
      })
    );

    act(() => {
      result.current.updatePrompt("make it clearer");
    });
    await act(async () => {
      await result.current.submitPrompt();
    });

    expect(mockedChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ id: "openai" }),
      "gpt-5.5",
      expect.arrayContaining([
        expect.objectContaining({ role: "system" }),
        expect.objectContaining({ content: expect.stringContaining("Original draft"), role: "user" })
      ])
    );
    expect(onAiResult).toHaveBeenCalledWith({
      from: 9,
      original: "Original draft",
      replacement: "Better draft",
      to: 23,
      type: "replace"
    });
  });

  it("interrupts an in-flight AI request and ignores its eventual response", async () => {
    const onAiResult = vi.fn();
    let resolveCompletion: (value: { content: string; finishReason: string }) => void = () => {};
    mockedChatCompletion.mockReturnValue(
      new Promise((resolve) => {
        resolveCompletion = resolve;
      })
    );
    const { result } = renderHook(() =>
      useAiCommandUi({
        getDocumentContent: () => "Original draft",
        getSelection: () => ({ from: 1, text: "Original draft", to: 15 }),
        model: "gpt-5.5",
        onAiResult,
        provider: provider(),
        settingsLoading: false
      })
    );

    act(() => {
      result.current.updatePrompt("make it clearer");
    });

    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submitPrompt();
    });

    expect(result.current.submitting).toBe(true);

    act(() => {
      result.current.interruptPrompt();
    });

    expect(result.current.submitting).toBe(false);

    await act(async () => {
      resolveCompletion({ content: "Better draft", finishReason: "stop" });
      await submitPromise;
    });

    expect(onAiResult).not.toHaveBeenCalled();
    expect(result.current.submitting).toBe(false);
  });
});
