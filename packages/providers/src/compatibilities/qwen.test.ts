import {
  getDashScopeQwenChatWebSearchRequestOptions,
  getDashScopeQwenNativeWebSearchKind,
  getQwenThinkingRequestOptions,
  isDashScopeProvider
} from "./qwen";
import type { AiProviderConfig } from "../providers";

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

describe("qwen", () => {
  it("recognizes DashScope providers from configured ids and base urls", () => {
    expect(isDashScopeProvider(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }))).toBe(true);
    expect(isDashScopeProvider(provider({
      baseUrl: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian-us"
    }))).toBe(true);
    expect(isDashScopeProvider(provider({
      baseUrl: "https://proxy.example.test/v1",
      id: "custom-compatible"
    }))).toBe(false);
  });

  it("classifies DashScope native web search modes for Qwen models", () => {
    expect(getDashScopeQwenNativeWebSearchKind(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3.6-plus")).toBe("dashscope-responses-tool");
    expect(getDashScopeQwenNativeWebSearchKind(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3-max")).toBe("dashscope-enable-search");
  });

  it("builds forced DashScope chat web search options for compatible Qwen models", () => {
    expect(getDashScopeQwenChatWebSearchRequestOptions(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3-max", true)).toEqual({
      enable_search: true,
      search_options: {
        forced_search: true,
        search_strategy: "max"
      }
    });
    expect(getDashScopeQwenChatWebSearchRequestOptions(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3.6-plus", true)).toEqual({});
  });

  it("builds provider-specific Qwen thinking request options", () => {
    expect(getQwenThinkingRequestOptions(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3.6-plus", true)).toEqual({ enable_thinking: true });
    expect(getQwenThinkingRequestOptions(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian"
    }), "qwen3.6-plus", false)).toEqual({ enable_thinking: false });
    expect(getQwenThinkingRequestOptions(provider({
      baseUrl: "https://proxy.example.test/v1",
      id: "custom-compatible"
    }), "qwen3.6-plus", true)).toEqual({ chat_template_kwargs: { enable_thinking: true } });
    expect(getQwenThinkingRequestOptions(provider({
      baseUrl: "https://proxy.example.test/v1",
      id: "custom-compatible"
    }), "qwen3.6-plus", false)).toEqual({ chat_template_kwargs: { enable_thinking: false } });
  });
});
