import {
  buildInlineAiMessages,
  getChatAdapter,
  type ChatMessage
} from "./chatAdapters";
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

const messages: ChatMessage[] = [
  { content: "You edit Markdown.", role: "system" },
  { content: "Rewrite this.", role: "user" }
];

const multimodalMessages: ChatMessage[] = [
  { content: "You inspect Markdown images.", role: "system" },
  {
    content: "User request:\n这张截图里有什么？",
    images: [
      {
        dataUrl: "data:image/png;base64,aGVsbG8=",
        mimeType: "image/png",
      }
    ],
    role: "user"
  }
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

  it("disables DeepSeek thinking by default so inline edits stream final content quickly", () => {
    const request = getChatAdapter("deepseek").buildRequest(
      provider({ baseUrl: "https://api.deepseek.com", type: "deepseek" }),
      "deepseek-v4-flash",
      messages,
      { stream: true }
    );

    expect(request.body).toEqual({
      messages,
      model: "deepseek-v4-flash",
      stream: true,
      temperature: 0.7,
      thinking: { type: "disabled" }
    });
  });

  it("can enable DeepSeek thinking when the command requests it", () => {
    const request = getChatAdapter("deepseek").buildRequest(
      provider({ baseUrl: "https://api.deepseek.com", type: "deepseek" }),
      "deepseek-v4-flash",
      messages,
      { stream: true, thinkingEnabled: true }
    );

    expect(request.body).toMatchObject({
      thinking: { type: "enabled" }
    });
  });

  it("parses DeepSeek reasoning stream fields separately from final text", () => {
    const adapter = getChatAdapter("deepseek");

    expect(
      adapter.parseStreamEvent({
        choices: [{ delta: { reasoning_content: "checking context" } }]
      })
    ).toEqual({ thinkingDelta: "checking context" });
    expect(
      adapter.parseStreamEvent({
        choices: [{ delta: { reasoning: "double checking" } }]
      })
    ).toEqual({ thinkingDelta: "double checking" });
    expect(
      adapter.parseStreamEvent({
        choices: [{ delta: { reasoning_text: "one more pass" } }]
      })
    ).toEqual({ thinkingDelta: "one more pass" });
    expect(
      adapter.parseStreamEvent({
        choices: [{ delta: { content: "Final answer" }, finish_reason: "stop" }]
      })
    ).toEqual({ contentDelta: "Final answer", finishReason: "stop" });
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

  it("builds multimodal image parts for supported chat APIs", () => {
    expect(
      getChatAdapter("openai").buildRequest(provider({ baseUrl: "https://api.openai.com/v1", type: "openai" }), "gpt-5.5", multimodalMessages)
        .body
    ).toMatchObject({
      messages: [
        { content: "You inspect Markdown images.", role: "system" },
        {
          content: [
            { text: "User request:\n这张截图里有什么？", type: "text" },
            { image_url: { url: "data:image/png;base64,aGVsbG8=" }, type: "image_url" }
          ],
          role: "user"
        }
      ]
    });

    expect(getChatAdapter("anthropic").buildRequest(provider({ type: "anthropic" }), "claude-opus-4-7", multimodalMessages).body)
      .toMatchObject({
        messages: [
          {
            content: [
              { text: "User request:\n这张截图里有什么？", type: "text" },
              {
                source: { data: "aGVsbG8=", media_type: "image/png", type: "base64" },
                type: "image"
              }
            ],
            role: "user"
          }
        ]
      });

    expect(
      getChatAdapter("google").buildRequest(provider({ baseUrl: "https://generativelanguage.googleapis.com/v1beta", type: "google" }), "gemini", multimodalMessages)
        .body
    ).toMatchObject({
      contents: [
        {
          parts: [
            { text: "User request:\n这张截图里有什么？" },
            { inlineData: { data: "aGVsbG8=", mimeType: "image/png" } }
          ],
          role: "user"
        }
      ]
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
    expect(
      buildInlineAiMessages({
        documentContent: "# Title\n\nSelected text",
        prompt: "make it concise",
        targetText: "Selected text"
      })
    ).toEqual([
      expect.objectContaining({ role: "system" }),
      {
        content: expect.stringContaining("User instruction:\nmake it concise"),
        role: "user"
      }
    ]);
    expect(
      buildInlineAiMessages({
        documentContent: "# Title",
        prompt: "continue",
        targetScope: "block",
        targetText: "# Title"
      })[1]?.content
    ).toContain("Current Markdown block");
  });
});
