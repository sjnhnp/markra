import { runDocumentAiAgent, type DocumentAiHistoryMessage } from "./documentAgent";
import type { AiProviderConfig } from "../providers/aiProviders";
import type { ChatMessage } from "./chatAdapters";

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
  it("asks the tool-calling agent to answer in the user's language", async () => {
    const complete = vi.fn().mockImplementationOnce(async (_provider, _model, messages: ChatMessage[]) => {
      expect(messages[0]?.content).toContain("Reply in the user's language");

      return {
        content: "好的，我会按中文回复。",
        finishReason: "stop"
      };
    });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# 草稿",
      documentPath: "/vault/README.md",
      model: "gpt-5.5",
      prompt: "帮我看看这份文档",
      provider: provider(),
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "好的，我会按中文回复。",
      finishReason: "stop",
      preparedPreview: false
    });
  });

  it("passes tool-calling history as transcript messages instead of embedding it in the current prompt", async () => {
    const complete = vi.fn().mockImplementationOnce(async (_provider, _model, messages: ChatMessage[]) => {
      expect(messages.map((message) => message.role)).toEqual(["system", "user", "assistant", "user", "user"]);
      expect(messages[1]?.content).toBe("Earlier synthetic request");
      expect(messages[2]?.content).toContain("Earlier synthetic answer");
      expect(messages[3]?.content).toContain("Document runtime context:");
      expect(messages[4]?.content).toBe("User request:\nCurrent synthetic request");
      expect(messages[4]?.content).not.toContain("Conversation so far:");

      return {
        content: "Current synthetic answer",
        finishReason: "stop"
      };
    });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Section Alpha",
      documentPath: "/vault/example.md",
      history: [
        { role: "user", text: "Earlier synthetic request" },
        { role: "assistant", text: "Earlier synthetic answer" }
      ],
      model: "gpt-5.5",
      prompt: "Current synthetic request",
      provider: provider(),
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "Current synthetic answer",
      finishReason: "stop",
      preparedPreview: false
    });
  });

  it("includes prepared editor preview summaries in tool-calling transcript history", async () => {
    const history: DocumentAiHistoryMessage[] = [
      {
        preview: {
          from: 10,
          original: "old-token",
          replacement: "new-token",
          target: {
            from: 10,
            id: "table:0",
            kind: "table",
            title: "Cost impact",
            to: 19
          },
          to: 19,
          type: "replace"
        },
        role: "assistant",
        text: "The editor change is ready."
      }
    ];

    const complete = vi.fn().mockImplementationOnce(async (_provider, _model, messages: ChatMessage[]) => {
      expect(messages.map((message) => message.role)).toEqual(["system", "assistant", "user", "user"]);
      expect(messages[1]?.content).toContain("Prepared editor preview");
      expect(messages[1]?.content).toContain("Target: table: Cost impact (10-19)");
      expect(messages[1]?.content).toContain("old-token");
      expect(messages[1]?.content).toContain("new-token");
      expect(messages[2]?.content).toContain("Document runtime context:");
      expect(messages[3]?.content).toBe("User request:\nFollow-up synthetic request");

      return {
        content: "Follow-up synthetic answer",
        finishReason: "stop"
      };
    });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Section Alpha",
      documentPath: "/vault/example.md",
      history,
      model: "gpt-5.5",
      prompt: "Follow-up synthetic request",
      provider: provider(),
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "Follow-up synthetic answer",
      finishReason: "stop",
      preparedPreview: false
    });
  });

  it("keeps tool-calling runtime context separate from the current user request", async () => {
    const complete = vi.fn().mockImplementationOnce(async (_provider, _model, messages: ChatMessage[]) => {
      expect(messages.map((message) => message.role)).toEqual(["system", "user", "user"]);
      expect(messages[1]?.content).toContain("Document runtime context:");
      expect(messages[1]?.content).toContain("Current selection snapshot:");
      expect(messages[1]?.content).toContain("Range: 2-13");
      expect(messages[1]?.content).toContain("Synthetic text");
      expect(messages[1]?.content).toContain("Web search mode was requested.");
      expect(messages[2]?.content).toBe("User request:\nRewrite the selected synthetic text");
      expect(messages[2]?.content).not.toContain("Current selection snapshot:");
      expect(messages[2]?.content).not.toContain("Web search mode was requested.");

      return {
        content: "Synthetic response",
        finishReason: "stop"
      };
    });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Section Alpha",
      documentPath: "/vault/example.md",
      model: "gpt-5.5",
      prompt: "Rewrite the selected synthetic text",
      provider: provider(),
      selection: {
        from: 2,
        source: "selection",
        text: "Synthetic text",
        to: 13
      },
      webSearchEnabled: true,
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "Synthetic response",
      finishReason: "stop",
      preparedPreview: false
    });
  });

  it("guides the tool-calling agent to use table-specific replacement for table edits", async () => {
    const complete = vi.fn().mockImplementationOnce(async (_provider, _model, messages: ChatMessage[]) => {
      expect(messages[0]?.content).toContain("replace_table");
      expect(messages[0]?.content).toContain("replace_block");
      expect(messages[0]?.content).toContain("table anchor");

      return {
        content: "I will use the table-specific edit path.",
        finishReason: "stop"
      };
    });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Section Alpha",
      documentPath: "/vault/example.md",
      model: "gpt-5.5",
      prompt: "Update the synthetic table",
      provider: provider(),
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "I will use the table-specific edit path.",
      finishReason: "stop",
      preparedPreview: false
    });
  });

  it("keeps chat-only context and read-only tool output separate from the current user request", async () => {
    const complete = vi.fn().mockImplementationOnce(async (_provider, _model, messages: ChatMessage[]) => {
      expect(messages.map((message) => message.role)).toEqual(["system", "user", "user", "user"]);
      expect(messages[1]?.content).toContain("Document runtime context:");
      expect(messages[1]?.content).toContain("Current cursor snapshot:");
      expect(messages[2]?.content).toContain("Read-only workspace context:");
      expect(messages[2]?.content).toContain("Tool: current_document");
      expect(messages[3]?.content).toBe("User request:\nAnswer with synthetic context");
      expect(messages[3]?.content).not.toContain("Read-only workspace context:");

      return {
        content: "Chat-only synthetic response",
        finishReason: "stop"
      };
    });

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Section Alpha",
      documentPath: "/vault/example.md",
      model: "local-synthetic-model",
      prompt: "Answer with synthetic context",
      provider: provider({
        id: "ollama",
        type: "ollama"
      }),
      selection: {
        cursor: 4,
        from: 4,
        source: "block",
        text: "",
        to: 4
      },
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "Chat-only synthetic response",
      finishReason: "stop"
    });
  });

  it("executes a replace-region tool call and stops for editor confirmation", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_replace_region",
          index: 0,
          nameDelta: "replace_region"
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
      content: "",
      finishReason: "toolUse",
      preparedPreview: true
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("blocks multiple write tool calls in the same assistant turn", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_replace_document",
          index: 0,
          nameDelta: "replace_document"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: JSON.stringify({
            replacement: "# Focused note"
          }),
          index: 0
        });
        options?.onToolCallDelta?.({
          id: "call_insert_markdown",
          index: 1,
          nameDelta: "insert_markdown"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: JSON.stringify({
            content: "Extra note",
            placement: "after_anchor"
          }),
          index: 1
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "I need to choose one editor edit before preparing a preview.",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "# Old note\n\nBody",
      documentEndPosition: 16,
      documentPath: "/vault/README.md",
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Rewrite this and add a note",
      provider: provider(),
      workspaceFiles: []
    });

    expect(onPreviewResult).not.toHaveBeenCalled();
    expect(result).toEqual({
      content: "I need to choose one editor edit before preparing a preview.",
      finishReason: "stop",
      preparedPreview: false
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

  it("stops after preparing an editor write preview", async () => {
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
            anchorId: "document-end",
            content: "# Synthetic comparison title",
            placement: "before_anchor"
          }),
          index: 0
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "This follow-up should not be requested.",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "",
      documentPath: "/vault/example.md",
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Write a comparison",
      provider: provider(),
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: "",
      replacement: "# Synthetic comparison title",
      to: 0,
      type: "insert"
    });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      content: "",
      finishReason: "toolUse",
      preparedPreview: true
    });
  });

  it("uses the last assistant narration when the final agent message has no text", async () => {
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onDelta?.("I inspected the document and found it is empty.");
        options?.onToolCallDelta?.({
          id: "call_get_document",
          index: 0,
          nameDelta: "get_document"
        });

        return {
          content: "I inspected the document and found it is empty.",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent: "",
      documentPath: "/vault/cf.md",
      model: "gpt-5.5",
      prompt: "What is in this document?",
      provider: provider(),
      workspaceFiles: []
    });

    expect(result).toEqual({
      content: "I inspected the document and found it is empty.",
      finishReason: "stop",
      preparedPreview: false
    });
  });

  it("executes a delete-region tool call and stops for editor confirmation", async () => {
    const onPreviewResult = vi.fn();
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_delete_region",
          index: 0,
          nameDelta: "delete_region"
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
      content: "",
      finishReason: "toolUse",
      preparedPreview: true
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("executes a full-document replacement tool call and stops for editor confirmation", async () => {
    const onPreviewResult = vi.fn();
    const documentContent = "# Old title\n\nOld comparison";
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_replace_document",
          index: 0,
          nameDelta: "replace_document"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: JSON.stringify({
            replacement: "# Synthetic focus note\n\nFocused comparison."
          }),
          index: 0
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "This follow-up should not be requested.",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Only keep the synthetic focus note and a comparison",
      provider: provider(),
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: documentContent,
      replacement: "# Synthetic focus note\n\nFocused comparison.",
      to: documentContent.length,
      type: "replace"
    });
    expect(result).toEqual({
      content: "",
      finishReason: "toolUse",
      preparedPreview: true
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("executes a table replacement tool call and stops for editor confirmation", async () => {
    const onPreviewResult = vi.fn();
    const table = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (old-token) |"
    ].join("\n");
    const replacement = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (new-token) |"
    ].join("\n");
    const documentContent = ["### Section Alpha", "", table, "", "### Section Beta"].join("\n");
    const tableStart = documentContent.indexOf(table);
    const complete = vi
      .fn()
      .mockImplementationOnce(async (_provider, _model, _messages, options) => {
        options?.onToolCallDelta?.({
          id: "call_replace_table",
          index: 0,
          nameDelta: "replace_table"
        });
        options?.onToolCallDelta?.({
          argumentsDelta: JSON.stringify({
            anchorId: "table:0",
            replacement
          }),
          index: 0
        });

        return {
          content: "",
          finishReason: "toolUse"
        };
      })
      .mockImplementationOnce(async () => ({
        content: "This follow-up should not be requested.",
        finishReason: "stop"
      }));

    const result = await runDocumentAiAgent({
      complete,
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: 0, level: 3, title: "Section Alpha", to: "### Section Alpha".length },
        { from: documentContent.indexOf("### Section Beta"), level: 3, title: "Section Beta", to: documentContent.length }
      ],
      model: "gpt-5.5",
      onPreviewResult,
      prompt: "Update only the synthetic table",
      provider: provider(),
      workspaceFiles: []
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: tableStart,
      original: table,
      replacement,
      target: {
        from: tableStart,
        id: "table:0",
        kind: "table",
        title: "Section Alpha table",
        to: tableStart + table.length
      },
      to: tableStart + table.length,
      type: "replace"
    });
    expect(result).toEqual({
      content: "",
      finishReason: "toolUse",
      preparedPreview: true
    });
    expect(complete).toHaveBeenCalledTimes(1);
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
      content: "",
      finishReason: "toolUse",
      preparedPreview: true
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
