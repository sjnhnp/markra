import { getMarkdownOutline, getWordCount } from "./markdown";

describe("markdown helpers", () => {
  it("counts words in mixed prose", () => {
    expect(getWordCount("Markra writes 本地 Markdown 123")).toBe(5);
  });

  it("extracts a simple markdown heading outline", () => {
    expect(getMarkdownOutline("# Intro\n\nBody\n\n### Details\n\n```\n# ignored\n```\n\n## Next")).toEqual([
      { level: 1, title: "Intro" },
      { level: 3, title: "Details" },
      { level: 2, title: "Next" }
    ]);
  });
});
