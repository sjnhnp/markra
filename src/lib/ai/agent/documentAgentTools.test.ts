import { createDocumentAgentTools } from "./documentAgentTools";

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
    expect(result?.content[0]?.text).toContain("Workspace file: notes/compare.md");
    expect(result?.content[0]?.text).toContain("Useful context.");
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

    const result = await tool?.execute("tool_read_workspace_file", {
      path: "/vault/../private.md"
    });

    expect(readWorkspaceFile).not.toHaveBeenCalled();
    expect(result?.details).toEqual({
      message:
        "Cannot read that file because it is not in the current Markdown workspace. Call list_workspace_files first and pass an exact relativePath or path."
    });
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

    expect(result?.content[0]?.text).toContain("# Title (0-8)");
    expect(result?.content[0]?.text).toContain("## Section (10-21)");
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

    expect(result?.content[0]?.text).toContain("section:0: Title (0-31)");
    expect(result?.content[0]?.text).toContain("section:1: Section (15-31)");
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
    }).find((item) => item.name === "delete_selection");

    const result = await tool?.execute("tool_delete_selection", {});

    expect(onPreviewResult).toHaveBeenCalledWith({
      from: 0,
      original: "# Title",
      replacement: "",
      to: 7,
      type: "replace"
    });
    expect(result?.content[0]?.text).toContain("Prepared a deletion preview");
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

    expect(result?.content[0]?.text).toContain("current-context");
    expect(result?.content[0]?.text).toContain("heading:1");
    expect(result?.content[0]?.text).toContain("document-end");
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
    }).find((item) => item.name === "delete_selection");

    const result = await tool?.execute("tool_delete_selection", {});

    expect(result?.details).toEqual({
      message:
        "Cannot delete because there is no active selection, current block, or structural anchor available. Inspect the document first and then resolve a region anchor."
    });
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
    expect(result?.content[0]?.text).toContain("Prepared an insertion preview at after_anchor (heading:1).");
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

    const result = await tool?.execute("tool_insert_markdown", {
      anchorId: "heading:99",
      content: "\n\nExtra section",
      placement: "after_anchor"
    });

    expect(result?.details).toEqual({
      message: 'Cannot insert because the anchor "heading:99" was not found.'
    });
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
});
