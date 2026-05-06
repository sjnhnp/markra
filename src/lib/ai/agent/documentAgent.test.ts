import { runDocumentAiAgent } from "./documentAgent";
import type { AiProviderConfig } from "../providers/aiProviders";

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

describe("document AI agent", () => {
  it("executes a replace-selection tool call and returns the follow-up assistant reply", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_replace_selection",
          index: 0,
          nameDelta: "replace_selection"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: "{\"replacement\":\"Polished draft\"}",
          index: 0
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onDelta?.("I prepared a polished replacement for the current selection.");

        return {
          content: "I prepared a polished replacement for the current selection.",
          finishReason: "stop"
        };
      });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Draft",
      documentPath: "/vault/README.md",
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Polish this selection",
      provider: provider(),
      selection: {
        from: 3,
        source: "selection",
        text: "Draft",
        to: 8
      },
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 3,
      original: "Draft",
      replacement: "Polished draft",
      to: 8,
      type: "replace"
    });
    expect(result).toEqual({
      content: "I prepared a polished replacement for the current selection.",
      finishReason: "stop"
    });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("lets the agent choose where to insert markdown around the current context", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_insert_markdown",
          index: 0,
          nameDelta: "insert_markdown"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: JSON.stringify({
            content: "## Follow-up\n\nMore detail.",
            placement: "after_selection"
          }),
          index: 0
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "I prepared the follow-up after the current block.",
        finishReason: "stop"
      }));

    await runDocumentAiAgent({
      complete,
      documentContent: "# Draft\n\nBody",
      documentPath: "/vault/README.md",
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Add a follow-up section after this block",
      provider: provider(),
      selection: {
        cursor: 3,
        from: 3,
        source: "block",
        text: "Draft",
        to: 8
      },
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 8,
      original: "",
      replacement: "## Follow-up\n\nMore detail.",
      to: 8,
      type: "insert"
    });
  });

  it("executes a delete-selection tool call and returns the follow-up assistant reply", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_delete_selection",
          index: 0,
          nameDelta: "delete_selection"
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "I prepared a deletion preview for the selected title.",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Draft\n\nBody",
      documentPath: "/vault/README.md",
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Delete this heading",
      provider: provider(),
      selection: {
        from: 0,
        source: "selection",
        text: "# Draft",
        to: 7
      },
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: "# Draft",
      replacement: "",
      to: 7,
      type: "replace"
    });
    expect(result).toEqual({
      content: "I prepared a deletion preview for the selected title.",
      finishReason: "stop"
    });
  });

  it("uses a section-level delete tool when the user asks to remove a whole section", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_delete_section",
          index: 0,
          nameDelta: "delete_section"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: JSON.stringify({
            anchorId: "section:2"
          }),
          index: 0
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "I prepared a deletion preview for the whole section.",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Intro\n\n## 10. Current\n\nBody\n\n## 11. Follow-ups\n\nMore body",
      documentEndPosition: 61,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Intro", to: 8 },
        { from: 9, level: 2, title: "10. Current", to: 23 },
        { from: 30, level: 2, title: "11. Follow-ups", to: 46 }
      ],
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Delete section 11",
      provider: provider(),
      selection: {
        cursor: 55,
        from: 49,
        source: "block",
        text: "More body",
        to: 58
      },
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith(expect.objectContaining({
      from: 30,
      replacement: "",
      to: 61,
      type: "replace"
    }));
    expect(result).toEqual({
      content: "I prepared a deletion preview for the whole section.",
      finishReason: "stop"
    });
  });
});
