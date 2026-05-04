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
});
