import { chatCompletion } from "./chatCompletion";
import type { AiProviderConfig } from "../aiProviders";

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

describe("chatCompletion", () => {
  it("sends a native POST request and parses the provider response", async () => {
    const transport = vi.fn().mockResolvedValue({
      body: {
        choices: [{ finish_reason: "stop", message: { content: "Improved text" } }]
      },
      status: 200
    });

    await expect(chatCompletion(provider(), "gpt-5.5", [{ content: "Hi", role: "user" }], transport)).resolves.toEqual({
      content: "Improved text",
      finishReason: "stop"
    });
    expect(transport).toHaveBeenCalledWith({
      body: JSON.stringify({
        messages: [{ content: "Hi", role: "user" }],
        model: "gpt-5.5",
        temperature: 0.7
      }),
      headers: {
        Authorization: "Bearer secret",
        "content-type": "application/json"
      },
      url: "https://api.openai.com/v1/chat/completions"
    });
  });

  it("throws readable errors for failed native responses", async () => {
    const transport = vi.fn().mockResolvedValue({
      body: { error: { message: "Invalid API key" } },
      status: 401
    });

    await expect(chatCompletion(provider(), "gpt-5.5", [{ content: "Hi", role: "user" }], transport)).rejects.toThrow(
      "Invalid API key"
    );
  });
});
