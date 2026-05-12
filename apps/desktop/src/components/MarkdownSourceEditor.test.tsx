import { fireEvent, render, screen } from "@testing-library/react";
import { MarkdownSourceEditor } from "./MarkdownSourceEditor";

describe("MarkdownSourceEditor", () => {
  it("renders editable markdown with source highlighting", () => {
    const content = [
      "# Title",
      "",
      "```ts",
      "const answer = 42;",
      "```",
      "- Item"
    ].join("\n");
    const handleChange = vi.fn();

    const { container } = render(
      <MarkdownSourceEditor
        content={content}
        onChange={handleChange}
      />
    );

    expect(screen.getByRole("textbox", { name: "Markdown source" })).toHaveValue(content);
    expect(container.querySelector(".markdown-source-highlight")).toHaveTextContent("const answer = 42;");
    expect(container.querySelector(".markdown-source-token-heading-marker")).toHaveTextContent("#");
    expect(container.querySelector(".markdown-source-token-code-fence")).toHaveTextContent("```");
    expect(container.querySelector(".markdown-source-token-code")).toHaveTextContent("const answer = 42;");
    expect(container.querySelector(".markdown-source-token-list-marker")).toHaveTextContent("-");

    fireEvent.change(screen.getByRole("textbox", { name: "Markdown source" }), {
      target: {
        value: "# Changed"
      }
    });

    expect(handleChange).toHaveBeenCalledWith("# Changed");
  });
});
