import {
  buildAiProviderModelsRequest,
  fetchAiProviderModels,
  parseAiProviderModels,
  testAiProviderConnection
} from "./aiProviderRequests";
import { createDefaultAiSettings, type AiProviderConfig } from "./aiProviders";

function provider(overrides: Partial<AiProviderConfig>): AiProviderConfig {
  return {
    apiKey: "sk-test",
    baseUrl: "",
    defaultModelId: "default",
    enabled: true,
    id: "provider",
    models: [],
    name: "Provider",
    type: "openai",
    ...overrides
  };
}

describe("AI provider requests", () => {
  it("ships mainstream providers by default", () => {
    const settings = createDefaultAiSettings();
    const providerIds = settings.providers.map((item) => item.id);

    expect(providerIds).toEqual(
      expect.arrayContaining([
        "openai",
        "anthropic",
        "google",
        "deepseek",
        "mistral",
        "groq",
        "openrouter",
        "together",
        "aliyun-bailian",
        "xiaomi-mimo",
        "volcengine",
        "xai",
        "ollama"
      ])
    );
    expect(providerIds).not.toContain("openai-compatible");
    expect(settings.defaultModelId).toBe("gpt-5.5");
    expect(settings.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ defaultModelId: "gpt-5.5", id: "openai" }),
        expect.objectContaining({ defaultModelId: "claude-opus-4-7", id: "anthropic" }),
        expect.objectContaining({ defaultModelId: "gemini-3.1-pro-preview", id: "google" }),
        expect.objectContaining({ defaultModelId: "deepseek-v4-pro", id: "deepseek" }),
        expect.objectContaining({ defaultModelId: "mistral-medium-latest", id: "mistral" }),
        expect.objectContaining({ defaultModelId: "groq/compound", id: "groq" }),
        expect.objectContaining({ defaultModelId: "openrouter/auto", id: "openrouter" }),
        expect.objectContaining({ defaultModelId: "moonshotai/Kimi-K2.5", id: "together" }),
        expect.objectContaining({ defaultModelId: "qwen3.6-plus", id: "aliyun-bailian", type: "openai-compatible" }),
        expect.objectContaining({ defaultModelId: "mimo-v2.5-pro", id: "xiaomi-mimo", type: "openai-compatible" }),
        expect.objectContaining({ defaultModelId: "doubao-seed-1-6-flash-250715", id: "volcengine", type: "openai-compatible" }),
        expect.objectContaining({ defaultModelId: "grok-4.3", id: "xai" }),
        expect.objectContaining({ defaultModelId: "gpt-5.4", id: "azure-openai" }),
        expect.objectContaining({ defaultModelId: "llama3.3", id: "ollama" })
      ])
    );
    expect(settings.providers.find((item) => item.id === "openai")?.models.map((model) => model.id)).toEqual([
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-image-2"
    ]);
    expect(settings.providers.find((item) => item.id === "deepseek")?.models.map((model) => model.id)).not.toContain(
      "deepseek-chat"
    );
    expect(settings.providers.find((item) => item.id === "aliyun-bailian")?.models.map((model) => model.id)).toEqual([
      "qwen3.6-plus",
      "qwen3-max",
      "qwen3-coder-plus",
      "qwen3.5-flash"
    ]);
    expect(settings.providers.find((item) => item.id === "xiaomi-mimo")?.models.map((model) => model.id)).toEqual([
      "mimo-v2.5-pro",
      "mimo-v2.5",
      "mimo-v2.5-flash"
    ]);
    expect(settings.providers.find((item) => item.id === "volcengine")?.models.map((model) => model.id)).toEqual([
      "doubao-seed-1-6-flash-250715",
      "doubao-seed-1-6-thinking-250715",
      "deepseek-v3-2-250915",
      "deepseek-r1-250528"
    ]);
  });

  it("builds provider-specific model list requests", () => {
    expect(buildAiProviderModelsRequest(provider({ type: "openai" }))).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      url: "https://api.openai.com/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "anthropic" }))).toMatchObject({
      headers: expect.objectContaining({
        "anthropic-version": expect.any(String),
        "x-api-key": "sk-test"
      }),
      url: "https://api.anthropic.com/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "google" }))).toMatchObject({
      headers: expect.objectContaining({ "x-goog-api-key": "sk-test" }),
      url: "https://generativelanguage.googleapis.com/v1beta/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "ollama", apiKey: "", baseUrl: "" }))).toMatchObject({
      headers: {},
      url: "http://localhost:11434/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "mistral" }))).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer sk-test" }),
      url: "https://api.mistral.ai/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "groq" }))).toMatchObject({
      url: "https://api.groq.com/openai/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "openrouter" }))).toMatchObject({
      url: "https://openrouter.ai/api/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "together" }))).toMatchObject({
      url: "https://api.together.xyz/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "xai" }))).toMatchObject({
      url: "https://api.x.ai/v1/models"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "azure-openai", baseUrl: "https://markra.openai.azure.com" }))).toMatchObject({
      headers: expect.objectContaining({ "api-key": "sk-test" }),
      url: "https://markra.openai.azure.com/openai/models?api-version=2024-10-21"
    });
    expect(buildAiProviderModelsRequest(provider({ type: "openai-compatible", baseUrl: "https://example.test/v1" }))).toMatchObject({
      url: "https://example.test/v1/models"
    });
    expect(
      buildAiProviderModelsRequest(
        provider({
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          id: "aliyun-bailian",
          type: "openai-compatible"
        })
      )
    ).toMatchObject({
      url: "https://dashscope.aliyuncs.com/compatible-mode/v1/models"
    });
    expect(
      buildAiProviderModelsRequest(
        provider({
          baseUrl: "https://api.xiaomimimo.com/v1",
          id: "xiaomi-mimo",
          type: "openai-compatible"
        })
      )
    ).toMatchObject({
      url: "https://api.xiaomimimo.com/v1/models"
    });
    expect(
      buildAiProviderModelsRequest(
        provider({
          baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
          id: "volcengine",
          type: "openai-compatible"
        })
      )
    ).toMatchObject({
      url: "https://ark.cn-beijing.volces.com/api/v3/models"
    });
  });

  it("parses common model list response shapes", () => {
    expect(
      parseAiProviderModels(provider({ type: "openai" }), {
        data: [{ id: "gpt-5" }, { id: "gpt-image-1", object: "model" }]
      })
    ).toEqual([
      { capability: "text", enabled: true, id: "gpt-5", name: "gpt-5" },
      { capability: "image", enabled: true, id: "gpt-image-1", name: "gpt-image-1" }
    ]);

    expect(
      parseAiProviderModels(provider({ type: "google" }), {
        models: [
          {
            displayName: "Gemini 2.5 Flash",
            name: "models/gemini-2.5-flash",
            supportedGenerationMethods: ["generateContent"]
          }
        ]
      })
    ).toEqual([
      {
        capability: "text",
        enabled: true,
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash"
      }
    ]);

    expect(
      parseAiProviderModels(provider({ type: "together" }), [
        { display_name: "Llama 4", id: "meta-llama/Llama-4", type: "chat" }
      ])
    ).toEqual([{ capability: "text", enabled: true, id: "meta-llama/Llama-4", name: "Llama 4" }]);
  });

  it("tests and fetches models through an injected native transport", async () => {
    const transport = vi.fn().mockResolvedValue({
      body: {
        data: [{ id: "gpt-5" }]
      },
      status: 200
    });

    await expect(testAiProviderConnection(provider({ type: "openai" }), transport)).resolves.toEqual({
      message: "Connected",
      ok: true
    });
    await expect(fetchAiProviderModels(provider({ type: "openai" }), transport)).resolves.toEqual([
      { capability: "text", enabled: true, id: "gpt-5", name: "gpt-5" }
    ]);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ url: "https://api.openai.com/v1/models" }));
  });
});
