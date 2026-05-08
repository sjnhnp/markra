import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { createDocumentAgentTools } from "./documentAgentTools";

function toolText(result: AgentToolResult<unknown> | undefined) {
  const content = result?.content[0];

  return content?.type === "text" ? content.text : "";
}

describe("documentAgentTools", () => {
  it("reads a workspace Markdown file by exact relative path", async () => {
    const readWorkspaceFile = vi.fn(async () => "# Nearby note\n\nUseful context.");
    const context = {
      documentContent: "# Current",
      documentEndPosition: 9,
      documentPath: "/vault/current.md",
      readWorkspaceFile,
      selection: null,
      workspaceFiles: [
        {
          name: "compare.md",
          path: "/vault/notes/compare.md",
          relativePath: "notes/compare.md"
        }
      ]
    };
    const tool = createDocumentAgentTools(context).find((item) => item.name === "read_workspace_file");

    const result = await tool?.execute("tool_read_workspace_file", {
      relativePath: "notes/compare.md"
    });

    expect(readWorkspaceFile).toHaveBeenCalledWith("/vault/notes/compare.md");
    expect(toolText(result)).toContain("Workspace file: notes/compare.md");
    expect(toolText(result)).toContain("Useful context.");
  });

  it("rejects workspace file reads outside the known Markdown tree", async () => {
    const readWorkspaceFile = vi.fn(async () => "secret");
    const context = {
      documentContent: "# Current",
      documentEndPosition: 9,
      documentPath: "/vault/current.md",
      readWorkspaceFile,
      selection: null,
      workspaceFiles: [
        {
          name: "compare.md",
          path: "/vault/notes/compare.md",
          relativePath: "notes/compare.md"
        }
      ]
    };
    const tool = createDocumentAgentTools(context).find((item) => item.name === "read_workspace_file");

    await expect(tool?.execute("tool_read_workspace_file", {
      path: "/vault/../private.md"
    })).rejects.toThrow(
      "Cannot read that file because it is not in the current Markdown workspace."
    );
    expect(readWorkspaceFile).not.toHaveBeenCalled();
  });

  it("returns the current heading outline with editor anchors", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\n## Section\n\nBody",
      documentEndPosition: 24,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Title", to: 8 },
        { from: 10, level: 2, title: "Section", to: 21 }
      ],
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "get_document_outline");

    const result = await tool?.execute("tool_get_document_outline", {});

    expect(toolText(result)).toContain("# Title (0-8)");
    expect(toolText(result)).toContain("## Section (10-21)");
  });

  it("returns section anchors derived from headings", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\nIntro\n\n## Section\n\nBody",
      documentEndPosition: 31,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Title", to: 8 },
        { from: 15, level: 2, title: "Section", to: 26 }
      ],
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "get_document_sections");

    const result = await tool?.execute("tool_get_document_sections", {});

    expect(toolText(result)).toContain("section:0: Title (0-31)");
    expect(toolText(result)).toContain("section:1: Section (15-31)");
  });

  it("prepares a delete preview for the current selection", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\nBody",
      documentEndPosition: 14,
      documentPath: "/vault/README.md",
      onPreviewResult,
      selection: {
        from: 0,
        source: "selection",
        text: "# Title",
        to: 7
      },
      workspaceFiles: []
    }).find((item) => item.name === "delete_region");

    const result = await tool?.execute("tool_delete_region", {});

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: "# Title",
      replacement: "",
      to: 7,
      type: "replace"
    });
    expect(toolText(result)).toContain("Prepared a deletion preview");
  });

  it("prepares a full-document replacement preview", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\nOld body",
      documentEndPosition: 17,
      documentPath: "/vault/README.md",
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_document");

    const result = await tool?.execute("tool_replace_document", {
      replacement: "# Focused note\n\nOnly the important part."
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: "# Title\n\nOld body",
      replacement: "# Focused note\n\nOnly the important part.",
      to: 17,
      type: "replace"
    });
    expect(toolText(result)).toContain("Prepared a full-document replacement preview");
  });

  it("returns available anchors for the current editing context", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\n## Section\n\nBody",
      documentEndPosition: 24,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Title", to: 8 },
        { from: 10, level: 2, title: "Section", to: 21 }
      ],
      selection: {
        cursor: 16,
        from: 10,
        source: "block",
        text: "Section",
        to: 17
      },
      workspaceFiles: []
    }).find((item) => item.name === "get_available_anchors");

    const result = await tool?.execute("tool_get_available_anchors", {});

    expect(toolText(result)).toContain("current-context");
    expect(toolText(result)).toContain("whole-document");
    expect(toolText(result)).toContain("heading:1");
    expect(toolText(result)).toContain("document-end");
  });

  it("locates the most appropriate region before insertion", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\n## Section\n\nBody",
      documentEndPosition: 24,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Title", to: 8 },
        { from: 10, level: 2, title: "Section", to: 21 }
      ],
      selection: {
        cursor: 16,
        from: 10,
        source: "block",
        text: "Section",
        to: 17
      },
      workspaceFiles: []
    }).find((item) => item.name === "locate_markdown_region");

    const result = await tool?.execute("tool_locate_markdown_region", {
      goal: "Insert the follow-up section after Section"
    });

    expect(result?.details).toEqual(expect.objectContaining({
      anchorId: "heading:1",
      operation: "insert"
    }));
  });

  it("locates a Markdown table instead of the owning heading for table edits", async () => {
    const documentContent = [
      "### Section Alpha",
      "",
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (old-token) |",
      "",
      "### Section Beta",
      "",
      "Body"
    ].join("\n");
    const firstHeading = "### Section Alpha";
    const secondHeading = "### Section Beta";
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: documentContent.indexOf(firstHeading), level: 3, title: "Section Alpha", to: documentContent.indexOf(firstHeading) + firstHeading.length },
        { from: documentContent.indexOf(secondHeading), level: 3, title: "Section Beta", to: documentContent.indexOf(secondHeading) + secondHeading.length }
      ],
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "locate_markdown_region");

    const result = await tool?.execute("tool_locate_markdown_region", {
      goal: "replace only the table under Section Alpha and change old-token to new-token",
      operation: "replace"
    });

    expect(result?.details).toEqual(expect.objectContaining({
      anchorId: "table:0"
    }));
    expect(toolText(result)).toContain("table:0");
  });

  it("uses enum schemas for bounded tool arguments", () => {
    const tools = createDocumentAgentTools({
      documentContent: "# Title",
      documentEndPosition: 7,
      documentPath: "/vault/README.md",
      selection: null,
      workspaceFiles: []
    });
    const insertMarkdown = tools.find((item) => item.name === "insert_markdown");
    const locateMarkdownRegion = tools.find((item) => item.name === "locate_markdown_region");

    expect(insertMarkdown?.parameters).toEqual(expect.objectContaining({
      properties: expect.objectContaining({
        placement: expect.objectContaining({
          anyOf: expect.arrayContaining([
            expect.objectContaining({ const: "after_anchor" }),
            expect.objectContaining({ const: "before_anchor" }),
            expect.objectContaining({ const: "cursor" })
          ])
        })
      })
    }));
    expect(locateMarkdownRegion?.parameters).toEqual(expect.objectContaining({
      properties: expect.objectContaining({
        operation: expect.objectContaining({
          anyOf: expect.arrayContaining([
            expect.objectContaining({ const: "delete" }),
            expect.objectContaining({ const: "insert" }),
            expect.objectContaining({ const: "replace" })
          ])
        })
      })
    }));
  });

  it("locates the most appropriate section by heading title", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "# Intro\n\n## 10. Current\n\nBody\n\n## 11. Follow-ups\n\nMore body",
      documentEndPosition: 61,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Intro", to: 8 },
        { from: 9, level: 2, title: "10. Current", to: 23 },
        { from: 30, level: 2, title: "11. Follow-ups", to: 46 }
      ],
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "locate_section");

    const result = await tool?.execute("tool_locate_section", {
      headingTitle: "11. Follow-ups"
    });

    expect(result?.details).toEqual(expect.objectContaining({
      anchorId: "section:2"
    }));
  });

  it("rejects delete requests when there is no editable selection or block", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "",
      documentEndPosition: 0,
      documentPath: null,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "delete_region");

    await expect(tool?.execute("tool_delete_region", {})).rejects.toThrow(
      "Cannot delete because there is no active selection, current block, or structural anchor available."
    );
  });

  it("prepares an insertion preview after a resolved heading anchor", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\n## Section\n\nBody",
      documentEndPosition: 24,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Title", to: 8 },
        { from: 10, level: 2, title: "Section", to: 21 }
      ],
      onPreviewResult,
      selection: {
        cursor: 2,
        from: 0,
        source: "block",
        text: "Title",
        to: 5
      },
      workspaceFiles: []
    }).find((item) => item.name === "insert_markdown");

    const result = await tool?.execute("tool_insert_markdown", {
      anchorId: "heading:1",
      content: "\n\n### Follow-up\n\nMore details.",
      placement: "after_anchor"
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 21,
      original: "",
      replacement: "\n\n### Follow-up\n\nMore details.",
      to: 21,
      type: "insert"
    });
    expect(toolText(result)).toContain("Prepared an insertion preview at after_anchor (heading:1).");
  });

  it("rejects anchor-based insertion when the anchor is missing", async () => {
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\nBody",
      documentEndPosition: 14,
      documentPath: "/vault/README.md",
      headingAnchors: [{ from: 0, level: 1, title: "Title", to: 8 }],
      selection: {
        cursor: 2,
        from: 0,
        source: "block",
        text: "Title",
        to: 5
      },
      workspaceFiles: []
    }).find((item) => item.name === "insert_markdown");

    await expect(
      tool?.execute("tool_insert_markdown", {
        anchorId: "heading:99",
        content: "\n\nExtra section",
        placement: "after_anchor"
      })
    ).rejects.toThrow('Cannot insert because the anchor "heading:99" was not found.');
  });

  it("replaces a resolved region anchor", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\n## Section\n\nBody",
      documentEndPosition: 24,
      documentPath: "/vault/README.md",
      headingAnchors: [{ from: 10, level: 2, title: "Section", to: 21 }],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_region");

    await tool?.execute("tool_replace_region", {
      anchorId: "heading:0",
      replacement: "## Better Section"
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 10,
      original: "Section",
      replacement: "## Better Section",
      to: 21,
      type: "replace"
    });
  });

  it("prepares a block replacement preview for the current editor block", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "# Title\n\nOld synthetic paragraph",
      documentEndPosition: 32,
      documentPath: "/vault/README.md",
      onPreviewResult,
      selection: {
        cursor: 12,
        from: 9,
        source: "block",
        text: "Old synthetic paragraph",
        to: 32
      },
      workspaceFiles: []
    }).find((item) => item.name === "replace_block");

    expect(tool).toBeDefined();
    const result = await tool?.execute("tool_replace_block", {
      replacement: "New synthetic paragraph"
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 9,
      original: "Old synthetic paragraph",
      replacement: "New synthetic paragraph",
      target: {
        from: 9,
        id: "current-context",
        kind: "current_block",
        title: "Old synthetic paragraph",
        to: 32
      },
      to: 32,
      type: "replace"
    });
    expect(toolText(result)).toContain("Prepared a block replacement preview");
  });

  it("rejects table anchors through replace_block", async () => {
    const table = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token |"
    ].join("\n");
    const tool = createDocumentAgentTools({
      documentContent: table,
      documentEndPosition: table.length,
      documentPath: "/vault/example.md",
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_block");

    await expect(tool?.execute("tool_replace_block", {
      anchorId: "table:0",
      replacement: "Synthetic paragraph"
    })).rejects.toThrow("Cannot replace a table anchor with replace_block. Use replace_table with a table anchor.");
  });

  it("rejects inline selections through replace_block", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "Alpha beta gamma",
      documentEndPosition: 16,
      documentPath: "/vault/example.md",
      onPreviewResult,
      selection: {
        from: 7,
        source: "selection",
        text: "beta",
        to: 11
      },
      workspaceFiles: []
    }).find((item) => item.name === "replace_block");

    await expect(tool?.execute("tool_replace_block", {
      replacement: "delta"
    })).rejects.toThrow("Cannot replace a block because the current editor context is an inline selection.");
    expect(onPreviewResult).not.toHaveBeenCalled();
  });

  it("prepares a replacement preview for a resolved Markdown table anchor", async () => {
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
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: 0, level: 3, title: "Section Alpha", to: "### Section Alpha".length },
        { from: documentContent.indexOf("### Section Beta"), level: 3, title: "Section Beta", to: documentContent.length }
      ],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_region");

    await tool?.execute("tool_replace_region", {
      anchorId: "table:0",
      replacement
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
  });

  it("prepares a table replacement preview with the dedicated table tool", async () => {
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
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: 0, level: 3, title: "Section Alpha", to: "### Section Alpha".length },
        { from: documentContent.indexOf("### Section Beta"), level: 3, title: "Section Beta", to: documentContent.length }
      ],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_table");

    expect(tool).toBeDefined();
    const result = await tool?.execute("tool_replace_table", {
      anchorId: "table:0",
      replacement
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
    expect(toolText(result)).toContain("Prepared a table replacement preview");
  });

  it("prepares a table replacement preview by heading title without requiring an anchor id", async () => {
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
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: 0, level: 3, title: "Section Alpha", to: "### Section Alpha".length },
        { from: documentContent.indexOf("### Section Beta"), level: 3, title: "Section Beta", to: documentContent.length }
      ],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_table_by_heading");

    expect(tool).toBeDefined();
    const result = await tool?.execute("tool_replace_table_by_heading", {
      headingTitle: "Section Alpha",
      replacement
    });

    expect(onPreviewResult).toHaveBeenCalledWith(expect.objectContaining({
      from: tableStart,
      original: table,
      replacement,
      target: expect.objectContaining({
        id: "table:0",
        kind: "table",
        title: "Section Alpha table"
      }),
      to: tableStart + table.length,
      type: "replace"
    }));
    expect(toolText(result)).toContain("Prepared a table replacement preview for Section Alpha table");
  });

  it("prepares a block replacement preview by matching existing text", async () => {
    const onPreviewResult = vi.fn();
    const documentContent = "# Title\n\nAlpha paragraph.\n\nBeta paragraph.";
    const original = "Beta paragraph.";
    const from = documentContent.indexOf(original);
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_block_by_text");

    expect(tool).toBeDefined();
    const result = await tool?.execute("tool_replace_block_by_text", {
      originalText: original,
      replacement: "Gamma paragraph."
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from,
      original,
      replacement: "Gamma paragraph.",
      target: {
        from,
        id: "text-match",
        kind: "current_block",
        title: original,
        to: from + original.length
      },
      to: from + original.length,
      type: "replace"
    });
    expect(toolText(result)).toContain("Prepared a block replacement preview for matched text.");
  });

  it("prepares a table replacement preview when the document has no headings", async () => {
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
    const tool = createDocumentAgentTools({
      documentContent: table,
      documentEndPosition: table.length,
      documentPath: "/vault/example.md",
      headingAnchors: [],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_table");

    await tool?.execute("tool_replace_table", {
      anchorId: "table:0",
      replacement
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: table,
      replacement,
      target: {
        from: 0,
        id: "table:0",
        kind: "table",
        title: "Table: Field / Variant One / Variant Two",
        to: table.length
      },
      to: table.length,
      type: "replace"
    });
  });

  it("uses provided editor table anchor positions for table replacement previews", async () => {
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
    const documentContent = ["### Section Alpha", "", table, "", "Tail"].join("\n");
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: 200,
      documentPath: "/vault/example.md",
      headingAnchors: [],
      onPreviewResult,
      selection: null,
      tableAnchors: [
        {
          description: "Markdown table Section Alpha table: Field / Variant One / Variant Two",
          from: 42,
          id: "table:0",
          kind: "table",
          text: table,
          title: "Section Alpha table",
          to: 91
        }
      ],
      workspaceFiles: []
    }).find((item) => item.name === "replace_table");

    await tool?.execute("tool_replace_table", {
      anchorId: "table:0",
      replacement
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 42,
      original: table,
      replacement,
      target: {
        from: 42,
        id: "table:0",
        kind: "table",
        title: "Section Alpha table",
        to: 91
      },
      to: 91,
      type: "replace"
    });
  });

  it("rejects Markdown table replacements through replace_region unless the target is a complete table anchor", async () => {
    const onPreviewResult = vi.fn();
    const tableReplacement = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (new-token) |"
    ].join("\n");
    const documentContent = ["### Section Alpha", "", "Synthetic paragraph"].join("\n");
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: 0, level: 3, title: "Section Alpha", to: "### Section Alpha".length }
      ],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_region");

    await expect(tool?.execute("tool_replace_region", {
      anchorId: "heading:0",
      replacement: tableReplacement
    })).rejects.toThrow(
      "Cannot replace this region with a Markdown table because the target is not a complete table anchor. Use replace_table with a table anchor."
    );
    expect(onPreviewResult).not.toHaveBeenCalled();
  });

  it("rejects fenced Markdown table replacements through replace_region unless the target is a complete table anchor", async () => {
    const onPreviewResult = vi.fn();
    const tableReplacement = [
      "```markdown",
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (new-token) |",
      "```"
    ].join("\n");
    const documentContent = ["### Section Alpha", "", "Synthetic paragraph"].join("\n");
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      headingAnchors: [
        { from: 0, level: 3, title: "Section Alpha", to: "### Section Alpha".length }
      ],
      onPreviewResult,
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_region");

    await expect(tool?.execute("tool_replace_region", {
      anchorId: "heading:0",
      replacement: tableReplacement
    })).rejects.toThrow(
      "Cannot replace this region with a Markdown table because the target is not a complete table anchor. Use replace_table with a table anchor."
    );
    expect(onPreviewResult).not.toHaveBeenCalled();
  });

  it("rejects block markdown replacements for inline selections", async () => {
    const onPreviewResult = vi.fn();
    const documentContent = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (old-token) |"
    ].join("\n");
    const selectedText = "old-token";
    const selectedFrom = documentContent.indexOf(selectedText);
    const tool = createDocumentAgentTools({
      documentContent,
      documentEndPosition: documentContent.length,
      documentPath: "/vault/example.md",
      onPreviewResult,
      selection: {
        from: selectedFrom,
        source: "selection",
        text: selectedText,
        to: selectedFrom + selectedText.length
      },
      workspaceFiles: []
    }).find((item) => item.name === "replace_region");

    await expect(tool?.execute("tool_replace_region", {
      replacement: [
        "| Field | Variant One | Variant Two |",
        "| ----- | ----------- | ----------- |",
        "| Sync note | None | Needs source token |"
      ].join("\n")
    })).rejects.toThrow("Cannot replace an inline selection with block-level Markdown");
    expect(onPreviewResult).not.toHaveBeenCalled();
  });

  it("prepares a section deletion preview for a full section anchor", async () => {
    const onPreviewResult = vi.fn();
    const tool = createDocumentAgentTools({
      documentContent: "# Intro\n\n## 10. Current\n\nBody\n\n## 11. Follow-ups\n\nMore body",
      documentEndPosition: 61,
      documentPath: "/vault/README.md",
      headingAnchors: [
        { from: 0, level: 1, title: "Intro", to: 8 },
        { from: 9, level: 2, title: "10. Current", to: 23 },
        { from: 30, level: 2, title: "11. Follow-ups", to: 46 }
      ],
      onPreviewResult,
      selection: {
        cursor: 55,
        from: 49,
        source: "block",
        text: "More body",
        to: 58
      },
      workspaceFiles: []
    }).find((item) => item.name === "delete_section");

    await tool?.execute("tool_delete_section", {
      anchorId: "section:2"
    });

    expect(onPreviewResult).toHaveBeenCalledWith(expect.objectContaining({
      from: 30,
      replacement: "",
      to: 61,
      type: "replace"
    }));
  });

  it("uses provided editor section anchor text and positions for section replacement previews", async () => {
    const onPreviewResult = vi.fn();
    const replacement = "## Section Alpha\n\nNew synthetic body";
    const sectionText = "Section Alpha\n\nOld synthetic body";
    const tool = createDocumentAgentTools({
      documentContent: "# Section Alpha\n\nOld synthetic body",
      documentEndPosition: 120,
      documentPath: "/vault/example.md",
      headingAnchors: [],
      onPreviewResult,
      sectionAnchors: [
        {
          description: "Section Section Alpha",
          from: 42,
          id: "section:0",
          kind: "section",
          text: sectionText,
          title: "Section Alpha",
          to: 91
        }
      ],
      selection: null,
      workspaceFiles: []
    }).find((item) => item.name === "replace_section");

    await tool?.execute("tool_replace_section", {
      anchorId: "section:0",
      replacement
    });

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 42,
      original: sectionText,
      replacement,
      to: 91,
      type: "replace"
    });
  });

  it("does not expose legacy selection-only write tools", () => {
    const toolNames = createDocumentAgentTools({
      documentContent: "# Title",
      documentEndPosition: 7,
      documentPath: "/vault/README.md",
      selection: {
        from: 0,
        source: "selection",
        text: "# Title",
        to: 7
      },
      workspaceFiles: []
    }).map((tool) => tool.name);

    expect(toolNames).not.toContain("replace_selection");
    expect(toolNames).not.toContain("delete_selection");
    expect(toolNames).not.toContain("insert_after_selection");
  });
});
