import {
  buildOpenAiCompatibleRequestParts,
  buildResponsesStyleRequestOptions
} from "./request-compatibility";
import type { AiProviderConfig } from "./providers";

function provider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    apiKey: "secret",
    baseUrl: "https://api.openai.com/v1",
    defaultModelId: "model",
    enabled: true,
    id: "openai",
    models: [],
    name: "OpenAI",
    type: "openai",
    ...overrides
  };
}

describe("provider request compatibility", () => {
  it("builds OpenAI-compatible thinking and native web search request parts", () => {
    expect(buildOpenAiCompatibleRequestParts(
      provider({
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        id: "aliyun-bailian",
        type: "openai-compatible"
      }),
      "qwen3-max",
      { thinkingEnabled: true, webSearchEnabled: true }
    )).toEqual({
      extraBody: {
        enable_search: true,
        enable_thinking: true,
        search_options: {
          forced_search: true,
          search_strategy: "max"
        }
      },
      nativeTools: []
    });

    expect(buildOpenAiCompatibleRequestParts(
      provider({
        baseUrl: "https://api.xiaomimimo.com/v1",
        id: "xiaomi-mimo",
        models: [
          {
            capabilities: ["text", "web"],
            enabled: true,
            id: "mimo-v2.5-pro",
            name: "MiMo V2.5 Pro"
          }
        ],
        type: "openai-compatible"
      }),
      "mimo-v2.5-pro",
      { thinkingEnabled: true, webSearchEnabled: true }
    )).toEqual({
      extraBody: {
        thinking: { type: "enabled" }
      },
      nativeTools: [
        {
          force_search: true,
          type: "web_search"
        }
      ]
    });
  });

  it("builds Responses-style provider options", () => {
    expect(buildResponsesStyleRequestOptions(
      provider({
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        id: "volcengine",
        type: "openai-compatible"
      }),
      "doubao-seed-1-6-flash-250715",
      "web_search",
      { thinkingEnabled: true }
    )).toEqual({
      thinking: { type: "enabled" }
    });

    expect(buildResponsesStyleRequestOptions(
      provider({ type: "xai" }),
      "grok-4.3",
      "web_search",
      { thinkingEnabled: false }
    )).toEqual({
      reasoning: { effort: "none" }
    });
  });
});
