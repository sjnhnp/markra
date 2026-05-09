import { runReadOnlyAgentTools } from "./read-only-tools";

describe("read-only AI agent tools", () => {
  it("collects current document and workspace Markdown file context", async () => {
    const results = await runReadOnlyAgentTools({
      documentContent: "# Market Scanner\n\nCurrent document body.",
      documentPath: "/vault/README.md",
      workspaceFiles: [
        { name: "README.md", path: "/vault/README.md", relativePath: "README.md" },
        { name: "DATA_FLOW.md", path: "/vault/DATA_FLOW.md", relativePath: "docs/DATA_FLOW.md" }
      ]
    });

    expect(results).toEqual([
      {
        content: expect.stringContaining("# Market Scanner"),
        name: "current_document"
      },
      {
        content: expect.stringContaining("docs/DATA_FLOW.md"),
        name: "workspace_markdown_files"
      }
    ]);
  });

  it("truncates large document context before it enters the prompt", async () => {
    const results = await runReadOnlyAgentTools({
      documentContent: `${"a".repeat(12_000)}tail`,
      documentPath: "/vault/large.md",
      workspaceFiles: []
    });

    expect(results[0]?.content).toContain("truncated");
    expect(results[0]?.content).not.toContain("tail");
  });
});
