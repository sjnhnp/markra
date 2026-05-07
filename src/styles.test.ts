import { readFileSync } from "node:fs";

describe("editor stylesheet", () => {
  it("includes readable Markdown table styles", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain('@import "@milkdown/kit/prose/tables/style/tables.css"');
    expect(styles).toContain(".markdown-paper table");
    expect(styles).toContain(".markdown-paper th");
    expect(styles).toContain(".markdown-paper td");
    expect(styles).toContain(".markdown-paper tbody tr:nth-child(even)");
  });

  it("lets AI insert previews inherit the current Markdown block typography", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain(".markdown-paper .markra-ai-preview-insert");
    expect(styles).toContain("font-size: inherit");
    expect(styles).toContain("font-weight: inherit");
  });

  it("keeps AI diff action controls visually quiet until interaction", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain(".markdown-paper .markra-ai-preview-actions-quiet");
    expect(styles).toContain("opacity: 0.58");
    expect(styles).not.toContain("opacity-0");
    expect(styles).toContain(".markdown-paper .markra-ai-preview-widget:hover .markra-ai-preview-actions-quiet");
    expect(styles).toContain(".markdown-paper .markra-ai-preview-widget:focus-within .markra-ai-preview-actions-quiet");
  });

  it("includes the inline AI loading shimmer used by compact quick actions", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain("@keyframes markra-ai-inline-shimmer");
    expect(styles).toContain(".ai-command-inline-loading-text");
    expect(styles).toContain(".ai-command-inline-loading-text::after");
  });

  it("draws the running AI agent composer border with a pseudo element", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain(".ai-agent-composer-running::before");
    expect(styles).toContain("animation: markra-ai-agent-border-run");
    expect(styles).toContain("mask-composite: exclude");
  });
});
