import { chatCompletion, chatCompletionStream } from "./chat-completion";
import type { AiProviderConfig } from "../providers/providers";

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

  it("streams provider SSE chunks through the native transport", async () => {
    const onDelta = vi.fn();
    const onThinkingDelta = vi.fn();
    const streamTransport = vi.fn(async (_request, onChunk) => {
      onChunk('data: {"choices":[{"delta":{"reasoning_content":"Thinking"}}]}\n\n');
      onChunk('data: {"choices":[{"delta":{"content":"Better "}}]}\n\n');
      onChunk('data: {"choices":[{"delta":{"content":"text"},"finish_reason":"stop"}]}\n\n');
      onChunk("data: [DONE]\n\n");

      return { status: 200 };
    });

    await expect(
      chatCompletionStream(provider(), "gpt-5.5", [{ content: "Hi", role: "user" }], {
        onDelta,
        onThinkingDelta,
        streamTransport
      })
    ).resolves.toEqual({
      content: "Better text",
      finishReason: "stop"
    });

    expect(streamTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ content: "Hi", role: "user" }],
          model: "gpt-5.5",
          stream: true,
          temperature: 0.7
        })
      }),
      expect.any(Function)
    );
    expect(onThinkingDelta).toHaveBeenCalledWith("Thinking");
    expect(onDelta).toHaveBeenNthCalledWith(1, "Better ");
    expect(onDelta).toHaveBeenNthCalledWith(2, "text");
  });

  it("extracts inline thinking tags from streamed content when thinking is enabled", async () => {
    const onDelta = vi.fn();
    const onThinkingDelta = vi.fn();
    const streamTransport = vi.fn(async (_request, onChunk) => {
      onChunk('data: {"choices":[{"delta":{"content":"<think>checking "}}]}\n\n');
      onChunk('data: {"choices":[{"delta":{"content":"the note</think>Final "}}]}\n\n');
      onChunk('data: {"choices":[{"delta":{"content":"answer"},"finish_reason":"stop"}]}\n\n');
      onChunk("data: [DONE]\n\n");

      return { status: 200 };
    });

    await expect(
      chatCompletionStream(provider(), "gpt-5.5", [{ content: "Hi", role: "user" }], {
        onDelta,
        onThinkingDelta,
        streamTransport,
        thinkingEnabled: true
      })
    ).resolves.toEqual({
      content: "Final answer",
      finishReason: "stop"
    });

    expect(onThinkingDelta).toHaveBeenNthCalledWith(1, "checking ");
    expect(onThinkingDelta).toHaveBeenNthCalledWith(2, "the note");
    expect(onDelta).toHaveBeenNthCalledWith(1, "Final ");
    expect(onDelta).toHaveBeenNthCalledWith(2, "answer");
  });

  it("reconstructs Responses API tool calls from function_call_arguments.done events", async () => {
    const onToolCallDelta = vi.fn();
    const streamTransport = vi.fn(async (_request, onChunk) => {
      onChunk('data: {"type":"response.function_call_arguments.done","output_index":0,"call_id":"call_read_document","name":"get_document","arguments":"{\\"path\\":\\"README.md\\"}"}\n\n');
      onChunk('data: {"type":"response.completed"}\n\n');
      onChunk("data: [DONE]\n\n");

      return { status: 200 };
    });

    await expect(
      chatCompletionStream(
        provider({
          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          id: "aliyun-bailian",
          type: "openai-compatible"
        }),
        "qwen3.6-plus",
        [{ content: "Read the document.", role: "user" }],
        {
          onToolCallDelta,
          streamTransport,
          tools: [
            {
              description: "Read the document.",
              name: "get_document",
              parameters: {
                additionalProperties: false,
                properties: {},
                type: "object"
              }
            }
          ],
          webSearchEnabled: true
        }
      )
    ).resolves.toEqual({
      content: "",
      finishReason: "stop",
      toolCalls: [
        {
          arguments: { path: "README.md" },
          id: "call_read_document",
          name: "get_document"
        }
      ]
    });

    expect(onToolCallDelta).toHaveBeenCalledWith({
      argumentsDelta: "{\"path\":\"README.md\"}",
      id: "call_read_document",
      index: 0,
      nameDelta: "get_document",
      replaceArguments: true,
      replaceName: true
    });
  });
});
