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

  it("keeps table add controls hidden until table hover or focus", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");
    const tableControlStart = styles.indexOf(".markdown-paper .markra-table-control {");
    const tableControlEnd = styles.indexOf(".markdown-paper .markra-table-add-column");
    const tableControlStyles = styles.slice(tableControlStart, tableControlEnd);

    expect(styles).toContain(".markdown-paper .markra-table-controls-wrapper");
    expect(styles).toContain("@apply relative overflow-visible pt-7 pr-9 pb-9");
    expect(styles).toContain(".markdown-paper .markra-table-control");
    expect(styles).toContain("opacity: 0");
    expect(styles).toContain(".markdown-paper .markra-table-controls-wrapper:hover .markra-table-control");
    expect(styles).toContain(".markdown-paper .markra-table-controls-wrapper:focus-within .markra-table-control");
    expect(styles).toContain(".markdown-paper .markra-table-add-column");
    expect(styles).toContain(".markdown-paper .markra-table-add-row");
    expect(styles).toContain(".markdown-paper .markra-table-align-controls");
    expect(styles).toContain(".markdown-paper .markra-table-size-controls");
    expect(styles).toContain(".markdown-paper .markra-table-size-button[aria-expanded=\"true\"]");
    expect(styles).toContain(".markdown-paper .markra-table-size-popover");
    expect(styles).toContain(".markdown-paper .markra-table-size-grid");
    expect(styles).toContain("grid-template-columns: repeat(8, 0.875rem)");
    expect(styles).toContain(".markdown-paper .markra-table-size-cell-active");
    expect(styles).toContain(".markdown-paper .markra-table-size-input");
    expect(styles).toContain(".markdown-paper .markra-table-align-button[aria-pressed=\"true\"]");
    expect(styles).toContain(".markdown-paper .markra-table-align-icon-left");
    expect(styles).toContain(".markdown-paper .markra-table-align-icon-center");
    expect(styles).toContain(".markdown-paper .markra-table-align-icon-right");
    expect(styles).toContain(".markdown-paper .markra-table-delete-control");
    expect(styles).toContain(".markdown-paper .markra-table-delete-column");
    expect(styles).toContain(".markdown-paper .markra-table-delete-row");
    expect(tableControlStyles).not.toContain("--accent");
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

  it("keeps AI preview action controls above nearby Markdown content", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain("isolation: isolate");
    expect(styles).toContain("z-index: 30");
    expect(styles).toContain("z-index: 60");
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

  it("keeps editor links selectable without generated drag artifacts", () => {
    const styles = readFileSync(`${process.cwd()}/src/styles.css`, "utf8");

    expect(styles).toContain(".markdown-paper a[href]::after");
    expect(styles).toContain(".markdown-paper .markra-live-link-label::after");
    expect(styles).toContain("content: none !important");
    expect(styles).toContain(".markdown-paper .markra-live-link-icon::before");
    expect(styles).toContain("content: \"↗\"");
    expect(styles).toContain(".markdown-paper .markra-live-link-icon + .markra-live-link-icon");
    expect(styles).toContain("-webkit-user-drag: none");
    expect(styles).toContain("user-select: text");
    expect(styles).toContain("@apply cursor-text text-(--accent-hover) underline underline-offset-2");
    expect(styles).toContain(".markdown-paper .ProseMirror.markra-link-open-modifier-active a");
    expect(styles).toContain(".markdown-paper .ProseMirror.markra-link-open-modifier-active .markra-live-link-label");
    expect(styles).toContain("cursor: pointer");
  });
});
