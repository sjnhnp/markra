import {
  buildInlineAiMessages,
  getChatAdapter,
  type ChatMessage
} from "./chatAdapters";
import type { AiProviderConfig } from "../aiProviders";

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

const messages: ChatMessage[] = [
  { content: "You edit Markdown.", role: "system" },
  { content: "Rewrite this.", role: "user" }
];

describe("AI chat adapters", () => {
  it("builds OpenAI-compatible chat completion requests with JSON headers", () => {
    const request = getChatAdapter("openai-compatible").buildRequest(
      provider({ baseUrl: "https://proxy.example.test/v1", type: "openai-compatible" }),
      "writer-model",
      messages
    );

    expect(request).toEqual({
      body: {
        messages,
        model: "writer-model",
        temperature: 0.7
      },
      headers: {
        Authorization: "Bearer secret",
        "content-type": "application/json"
      },
      url: "https://proxy.example.test/v1/chat/completions"
    });
  });

  it("builds provider-specific chat requests for Anthropic, Google, and Azure", () => {
    expect(getChatAdapter("anthropic").buildRequest(provider({ type: "anthropic" }), "claude-opus-4-7", messages)).toMatchObject({
      body: {
        max_tokens: 4096,
        messages: [{ content: "Rewrite this.", role: "user" }],
        model: "claude-opus-4-7",
        system: "You edit Markdown."
      },
      headers: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "x-api-key": "secret"
      },
      url: "https://api.anthropic.com/v1/messages"
    });
    expect(
      getChatAdapter("google").buildRequest(
        provider({ baseUrl: "https://generativelanguage.googleapis.com/v1beta", type: "google" }),
        "gemini-3.1-pro-preview",
        messages
      )
    ).toMatchObject({
      body: {
        contents: [{ parts: [{ text: "Rewrite this." }], role: "user" }],
        generationConfig: { temperature: 0.7 },
        systemInstruction: { parts: [{ text: "You edit Markdown." }] }
      },
      headers: { "content-type": "application/json" },
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=secret"
    });
    expect(
      getChatAdapter("azure-openai").buildRequest(
        provider({ baseUrl: "https://markra.openai.azure.com", type: "azure-openai" }),
        "writer-deployment",
        messages
      )
    ).toMatchObject({
      body: {
        messages,
        temperature: 0.7
      },
      headers: {
        "api-key": "secret",
        "content-type": "application/json"
      },
      url: "https://markra.openai.azure.com/openai/deployments/writer-deployment/chat/completions?api-version=2024-10-21"
    });
  });

  it("parses common chat response shapes", () => {
    expect(
      getChatAdapter("openai").parseResponse({
        choices: [{ finish_reason: "stop", message: { content: "OpenAI response" } }]
      })
    ).toEqual({ content: "OpenAI response", finishReason: "stop" });
    expect(
      getChatAdapter("anthropic").parseResponse({
        content: [{ text: "Claude response", type: "text" }],
        stop_reason: "end_turn"
      })
    ).toEqual({ content: "Claude response", finishReason: "end_turn" });
    expect(
      getChatAdapter("google").parseResponse({
        candidates: [{ content: { parts: [{ text: "Gemini " }, { text: "response" }] } }]
      })
    ).toEqual({ content: "Gemini response" });
  });

  it("builds inline AI messages from selection and document context", () => {
    expect(buildInlineAiMessages("make it concise", "Selected text", "# Title\n\nSelected text")).toEqual([
      expect.objectContaining({ role: "system" }),
      {
        content: expect.stringContaining("Instruction:\nmake it concise"),
        role: "user"
      }
    ]);
    expect(buildInlineAiMessages("continue", "", "# Title")[1]?.content).toContain("No text is selected");
  });
});
