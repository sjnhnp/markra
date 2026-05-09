import { runInlineAiAgent } from "./runtime";
import { messagesFromPiContext } from "./runtime/messages";
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

describe("inline AI agent runtime", () => {
  it("runs read-only context tools before requesting the final inline edit", async () => {
    const complete = vi.fn().mockResolvedValue({ content: "Better body", finishReason: "stop" });

    await expect(
      runInlineAiAgent({
        complete,
        documentContent: "# Draft\n\nOriginal body",
        documentPath: "/vault/README.md",
        model: "gpt-5.5",
        prompt: "make it clearer",
        provider: provider(),
        target: {
          from: 9,
          original: "Original body",
          promptText: "Original body",
          to: 22,
          type: "replace"
        },
        workspaceFiles: [{ name: "README.md", path: "/vault/README.md", relativePath: "README.md" }]
      })
    ).resolves.toEqual({ content: "Better body", finishReason: "stop" });

    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "openai" }),
      "gpt-5.5",
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("Read-only agent tool context")
        }),
        expect.objectContaining({
          content: expect.stringContaining("workspace_markdown_files")
        })
      ]),
      expect.objectContaining({
        onDelta: expect.any(Function)
      })
    );
  });

  it("emits agent lifecycle and assistant update events while producing the inline edit", async () => {
    const events: string[] = [];
    const complete = vi.fn().mockResolvedValue({ content: "Better body", finishReason: "stop" });

    await runInlineAiAgent({
      complete,
      documentContent: "# Draft\n\nOriginal body",
      documentPath: "/vault/README.md",
      model: "gpt-5.5",
      onEvent: (event) => {
        events.push(event.type);
      },
      prompt: "make it clearer",
      provider: provider(),
      target: {
        from: 9,
        original: "Original body",
        promptText: "Original body",
        to: 22,
        type: "replace"
      }
    });

    expect(events).toEqual(expect.arrayContaining(["agent_start", "message_update", "agent_end"]));
  });

  it("forwards streaming deltas into pi-agent message update events", async () => {
    const deltas: string[] = [];
    const thinkingDeltas: string[] = [];
    const complete = vi.fn(async (_provider, _model, _messages, options) => {
      options?.onThinkingDelta?.("Checking context");
      options?.onDelta?.("Better ");
      options?.onDelta?.("body");

      return { content: "Better body", finishReason: "stop" };
    });

    await expect(
      runInlineAiAgent({
        complete,
        documentContent: "# Draft\n\nOriginal body",
        documentPath: "/vault/README.md",
        model: "gpt-5.5",
        onEvent: (event) => {
          if (event.type === "message_update" && event.assistantMessageEvent.type === "thinking_delta") {
            thinkingDeltas.push(event.assistantMessageEvent.delta);
          }
          if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
            deltas.push(event.assistantMessageEvent.delta);
          }
        },
        prompt: "make it clearer",
        provider: provider(),
        target: {
          from: 9,
          original: "Original body",
          promptText: "Original body",
          to: 22,
          type: "replace"
        }
      })
    ).resolves.toEqual({ content: "Better body", finishReason: "stop" });

    expect(thinkingDeltas).toEqual(["Checking context"]);
    expect(deltas).toEqual(["Better ", "body"]);
  });

  it("preserves assistant thinking blocks when replaying tool-calling context", () => {
    expect(messagesFromPiContext({
      messages: [
        {
          content: [
            { thinking: "Need to inspect the document first.", type: "thinking" },
            { arguments: {}, id: "call_get_document", name: "get_document", type: "toolCall" }
          ],
          role: "assistant"
        }
      ],
      systemPrompt: ""
    } as never)).toEqual([
      {
        content: "",
        role: "assistant",
        thinking: "Need to inspect the document first.",
        toolCalls: [
          {
            arguments: {},
            id: "call_get_document",
            name: "get_document"
          }
        ]
      }
    ]);
  });
});
