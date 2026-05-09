import type { AiProviderConfig } from "../../providers/aiProviders";
import { supportsAnthropicAdaptiveThinking } from "./claude";
import { getDeepSeekCompatibleThinkingRequestOptions } from "./deepseek";
import { getDoubaoCompatibleThinkingRequestOptions } from "./doubao";
import { getGeminiCompatibleThinkingRequestOptions } from "./gemini";
import { getKimiCompatibleThinkingRequestOptions } from "./kimi";
import { getMimoCompatibleThinkingRequestOptions } from "./mimo";
import { getQwenThinkingRequestOptions, getDashScopeQwenNativeWebSearchKind, isDashScopeProvider } from "./qwen";
import { getZhipuCompatibleThinkingRequestOptions } from "./zhipu";

function provider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    apiKey: "secret",
    baseUrl: "",
    defaultModelId: "model",
    enabled: true,
    id: "provider",
    models: [],
    name: "Provider",
    type: "openai-compatible",
    ...overrides
  };
}

describe("provider/model helpers", () => {
  it("keeps Qwen-specific request shaping in the dedicated helper", () => {
    expect(isDashScopeProvider(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }))).toBe(true);
    expect(getDashScopeQwenNativeWebSearchKind(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3.6-plus")).toBe("dashscope-responses-tool");
    expect(getQwenThinkingRequestOptions(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3.6-plus", true)).toEqual({ enable_thinking: true });
    expect(getQwenThinkingRequestOptions(provider({
      baseUrl: "https://proxy.example.test/v1",
      id: "custom-compatible"
    }), "qwen3.6-plus", false)).toEqual({ chat_template_kwargs: { enable_thinking: false } });
  });

  it("keeps Gemini-specific request shaping in the dedicated helper", () => {
    expect(getGeminiCompatibleThinkingRequestOptions("google/gemini-3.1-pro-preview", true)).toEqual({
      extra_body: {
        google: {
          thinking_config: {
            include_thoughts: true,
            thinking_budget: -1
          }
        }
      }
    });
    expect(getGeminiCompatibleThinkingRequestOptions("writer-model", true)).toEqual({});
  });

  it("keeps DeepSeek-compatible request shaping in the dedicated helper", () => {
    expect(getDeepSeekCompatibleThinkingRequestOptions("deepseek-v4-pro", true)).toEqual({
      thinking: { type: "enabled" }
    });
    expect(getDeepSeekCompatibleThinkingRequestOptions("deepseek-v4-pro", false)).toEqual({
      thinking: { type: "disabled" }
    });
  });

  it("keeps shared compatible reasoning model request shaping in vendor helpers", () => {
    expect(getDoubaoCompatibleThinkingRequestOptions("doubao-seed-1-6-thinking-250715", true)).toEqual({
      thinking: { type: "enabled" }
    });
    expect(getKimiCompatibleThinkingRequestOptions("moonshotai/Kimi-K2.5", false)).toEqual({
      thinking: { type: "disabled" }
    });
    expect(getMimoCompatibleThinkingRequestOptions("mimo-v2.5-pro", true)).toEqual({
      thinking: { type: "enabled" }
    });
    expect(getZhipuCompatibleThinkingRequestOptions("zhipu/glm-4.6", false)).toEqual({
      thinking: { type: "disabled" }
    });
  });

  it("keeps Claude-specific adaptive thinking detection in the dedicated helper", () => {
    expect(supportsAnthropicAdaptiveThinking("claude-opus-4-7")).toBe(true);
    expect(supportsAnthropicAdaptiveThinking("claude-haiku-4-5")).toBe(false);
  });
});
