import { fireEvent, render, screen } from "@testing-library/react";
import { NativeTitleBar } from "./NativeTitleBar";

describe("NativeTitleBar", () => {
  it("renders centered title and file actions inside the drag region", () => {
    const { container } = render(
      <NativeTitleBar
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="light"
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );
    const titlebar = container.querySelector(".native-titlebar");

    expect(screen.getByLabelText("Window drag region")).toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("heading", { name: "Draft.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Markdown or Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toBeInTheDocument();
    expect(titlebar).toHaveClass("grid-cols-[132px_minmax(0,1fr)_132px]");
    expect(titlebar).toHaveClass("h-10");
    expect(container.querySelector(".document-actions")).toHaveClass("h-10");
  });

  it("places the markdown files toggle in the traffic-light side of the titlebar", () => {
    const toggleMarkdownFiles = vi.fn();
    const { container } = render(
      <NativeTitleBar
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen
        theme="light"
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={toggleMarkdownFiles}
        onToggleTheme={() => {}}
      />
    );

    const toggle = screen.getByRole("button", { name: "Toggle Markdown files" });

    expect(toggle.closest(".titlebar-spacer")).toHaveClass("pl-24");
    expect(toggle.closest(".titlebar-spacer")).toHaveClass("h-10");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toContainElement(container.querySelector(".lucide-panel-left"));

    fireEvent.click(toggle);

    expect(toggleMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it("shows the inverse theme action", () => {
    const toggleTheme = vi.fn();
    const { container } = render(
      <NativeTitleBar
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="dark"
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={toggleTheme}
      />
    );

    const button = screen.getByRole("button", { name: "Switch to light theme" });

    expect(button).toContainElement(container.querySelector(".lucide-sun"));

    fireEvent.click(button);

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});
