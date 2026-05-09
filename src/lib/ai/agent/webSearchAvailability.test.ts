import { aiAgentWebSearchAvailable } from "./webSearchAvailability";
import type { AiProviderConfig, AiProviderModel } from "../providers/aiProviders";

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

function model(overrides: Partial<AiProviderModel>): AiProviderModel {
  return {
    capabilities: ["text"],
    enabled: true,
    id: "model",
    name: "Model",
    ...overrides
  };
}

describe("AI agent web search availability", () => {
  it("allows native web search providers without requiring custom search settings", () => {
    expect(aiAgentWebSearchAvailable({
      model: model({ capabilities: ["text", "web"], id: "gemini-3.1-flash-lite-preview" }),
      provider: provider({ type: "google" }),
      settings: null,
      settingsLoading: false
    })).toBe(true);
    expect(aiAgentWebSearchAvailable({
      model: model({ capabilities: ["text", "web"], id: "groq/compound" }),
      provider: provider({ type: "groq" }),
      settings: null,
      settingsLoading: false
    })).toBe(true);
    expect(aiAgentWebSearchAvailable({
      model: model({ capabilities: ["text", "web"], id: "openrouter/auto" }),
      provider: provider({ type: "openrouter" }),
      settings: null,
      settingsLoading: false
    })).toBe(true);
    expect(aiAgentWebSearchAvailable({
      model: model({ capabilities: ["text", "web"], id: "gpt-5.4" }),
      provider: provider({ type: "azure-openai" }),
      settings: null,
      settingsLoading: false
    })).toBe(true);
  });

  it("allows the Cherry-style tool only when the model supports tools and custom settings are usable", () => {
    expect(aiAgentWebSearchAvailable({
      model: model({ capabilities: ["text", "tools"], id: "writer-tools" }),
      provider: provider({ type: "openai-compatible" }),
      settings: {
        contentMaxChars: 12000,
        enabled: true,
        maxResults: 5,
        providerId: "local-bing",
        searxngApiHost: ""
      },
      settingsLoading: false
    })).toBe(true);
    expect(aiAgentWebSearchAvailable({
      model: model({ capabilities: ["text"], id: "writer-text" }),
      provider: provider({ type: "openai-compatible" }),
      settings: null,
      settingsLoading: false
    })).toBe(false);
  });
});
