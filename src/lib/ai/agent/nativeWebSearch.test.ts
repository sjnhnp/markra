import { getNativeWebSearchKind, providerSupportsNativeWebSearch } from "./nativeWebSearch";
import type { AiProviderConfig } from "../providers/aiProviders";

function provider(overrides: Partial<AiProviderConfig>): AiProviderConfig {
  return {
    apiKey: "secret",
    baseUrl: "",
    defaultModelId: "model",
    enabled: true,
    id: "provider",
    models: [],
    name: "Provider",
    type: "openai",
    ...overrides
  };
}

describe("native web search support", () => {
  it("recognizes providers that can use native web search in Markra adapters", () => {
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "gpt-5.5", name: "GPT-5.5" }],
      type: "openai"
    }), "gpt-5.5")).toBe("openai-responses");
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "grok-4.3", name: "Grok 4.3" }],
      type: "xai"
    }), "grok-4.3")).toBe("openai-responses");
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "claude-opus-4-7", name: "Claude Opus 4.7" }],
      type: "anthropic"
    }), "claude-opus-4-7")).toBe("anthropic-server-tool");
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "gemini-3.1-flash-lite-preview", name: "Gemini Flash-Lite" }],
      type: "google"
    }), "gemini-3.1-flash-lite-preview")).toBe("google-search-grounding");
    expect(getNativeWebSearchKind(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian",
      models: [{ capabilities: ["text", "web"], enabled: true, id: "qwen3.6-plus", name: "Qwen3.6 Plus" }],
      type: "openai-compatible"
    }), "qwen3.6-plus")).toBe("dashscope-responses-tool");
    expect(getNativeWebSearchKind(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian",
      models: [{ capabilities: ["text", "web"], enabled: true, id: "qwen3-max", name: "Qwen3 Max" }],
      type: "openai-compatible"
    }), "qwen3-max")).toBe("dashscope-enable-search");
    expect(getNativeWebSearchKind(provider({
      baseUrl: "https://api.perplexity.ai",
      id: "perplexity",
      models: [{ capabilities: ["text", "web"], enabled: true, id: "sonar-pro", name: "Sonar Pro" }],
      type: "openai-compatible"
    }), "sonar-pro")).toBe("perplexity-sonar");
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "groq/compound", name: "Groq Compound" }],
      type: "groq"
    }), "groq/compound")).toBe("groq-compound");
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "openrouter/auto", name: "OpenRouter Auto" }],
      type: "openrouter"
    }), "openrouter/auto")).toBe("openrouter-server-tool");
    expect(getNativeWebSearchKind(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "gpt-5.4", name: "GPT-5.4 deployment" }],
      type: "azure-openai"
    }), "gpt-5.4")).toBe("azure-openai-responses");
  });

  it("uses the model web capability as the native search gate", () => {
    expect(getNativeWebSearchKind(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian",
      models: [{ capabilities: ["text", "web"], enabled: true, id: "custom-dashscope-model", name: "Custom DashScope Model" }],
      type: "openai-compatible"
    }), "custom-dashscope-model")).toBe("dashscope-enable-search");

    expect(providerSupportsNativeWebSearch(provider({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      id: "aliyun-bailian",
      models: [{ capabilities: ["text", "tools"], enabled: true, id: "qwen3.6-plus", name: "Qwen3.6 Plus" }],
      type: "openai-compatible"
    }), "qwen3.6-plus")).toBe(false);
  });

  it("does not treat generic compatible or DeepSeek official models as native web search providers", () => {
    expect(providerSupportsNativeWebSearch(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "qwen3.6-plus", name: "Qwen3.6 Plus" }],
      type: "openai-compatible"
    }), "qwen3.6-plus")).toBe(false);
    expect(providerSupportsNativeWebSearch(provider({
      models: [{ capabilities: ["text", "web"], enabled: true, id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" }],
      type: "deepseek"
    }), "deepseek-v4-pro")).toBe(false);
  });
});
