import { render, waitFor } from "@testing-library/react";
import { MarkdownExportDocument } from "./MarkdownExportDocument";

describe("MarkdownExportDocument", () => {
  it("renders ordinary Markdown line breaks without explicit br tags", async () => {
    const onRendered = vi.fn();

    render(
      <MarkdownExportDocument
        onRendered={onRendered}
        snapshot={{
          id: 1,
          kind: "html",
          markdown: "First line\nSecond line",
          title: "line-breaks.md"
        }}
      />
    );

    await waitFor(() => expect(onRendered).toHaveBeenCalledTimes(1));

    const bodyHtml = onRendered.mock.calls[0]?.[0].bodyHtml as string;
    expect(bodyHtml).toContain("First line<br");
    expect(bodyHtml).toContain("Second line");
    expect(bodyHtml).not.toContain("&lt;br");
  });

  it("renders inline and display math before exporting HTML", async () => {
    const onRendered = vi.fn();

    render(
      <MarkdownExportDocument
        onRendered={onRendered}
        snapshot={{
          id: 1,
          kind: "pdf",
          markdown: "Inline $x^2$ formula.\n\n$$\n\\int_0^1 x \\, dx\n$$",
          title: "math.md"
        }}
      />
    );

    await waitFor(() => expect(onRendered).toHaveBeenCalledTimes(1));

    const bodyHtml = onRendered.mock.calls[0]?.[0].bodyHtml as string;
    expect(bodyHtml).toContain("markra-math-render-inline");
    expect(bodyHtml).toContain("markra-math-render-display");
    expect(bodyHtml).toContain("katex");
    expect(bodyHtml).not.toContain("language-math");
  });
});
