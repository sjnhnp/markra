import { fireEvent, render, screen } from "@testing-library/react";
import { NativeTitleBar } from "./NativeTitleBar";

describe("NativeTitleBar", () => {
  it("renders centered title and file actions inside the drag region", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="light"
        onToggleAiAgent={() => {}}
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
    expect(screen.getByRole("button", { name: "Toggle AI Agent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toBeInTheDocument();
    expect(titlebar).toHaveClass("grid-cols-[164px_minmax(0,1fr)_164px]");
    expect(titlebar).toHaveClass("h-10");
    expect(container.querySelector(".document-actions")).toHaveClass("h-10");
  });

  it("toggles the right-side AI Agent panel from the file action area", () => {
    const toggleAiAgent = vi.fn();
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen
        aiAgentWidth={512}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="light"
        onToggleAiAgent={toggleAiAgent}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: "Toggle AI Agent" });

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toContainElement(container.querySelector(".lucide-bot"));
    expect(container.querySelector(".document-actions")).toHaveStyle({ transform: "translateX(-512px)" });

    fireEvent.click(button);

    expect(toggleAiAgent).toHaveBeenCalledTimes(1);
  });

  it("centers the document title inside the editor area when the AI Agent panel is open", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen
        aiAgentWidth={512}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(container.querySelector(".native-title")).toHaveStyle({ transform: "translateX(-256px)" });
    expect(container.querySelector(".document-actions")).toHaveStyle({ transform: "translateX(-512px)" });
  });

  it("centers the document title inside the editor area when the markdown files sidebar is resized", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen
        markdownFilesWidth={220}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(container.querySelector(".native-title")).toHaveStyle({ transform: "translateX(110px)" });
  });

  it("balances the document title between the markdown files sidebar and AI Agent panel", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen
        aiAgentWidth={512}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen
        markdownFilesWidth={288}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(container.querySelector(".native-title")).toHaveStyle({ transform: "translateX(-112px)" });
  });

  it("keeps file actions synced immediately while the AI Agent panel is resizing", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen
        aiAgentResizing
        aiAgentWidth={448}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(container.querySelector(".document-actions")).toHaveClass("transition-none");
    expect(container.querySelector(".document-actions")).toHaveStyle({ transform: "translateX(-448px)" });
    expect(container.querySelector(".native-title")).toHaveStyle({ transform: "translateX(-224px)" });
  });

  it("keeps the document title synced immediately while the markdown files sidebar is resizing", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen
        markdownFilesResizing
        markdownFilesWidth={440}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(container.querySelector(".native-title")).toHaveClass("transition-none");
    expect(container.querySelector(".native-title")).toHaveStyle({ transform: "translateX(220px)" });
  });

  it("places the markdown files toggle in the traffic-light side of the titlebar", () => {
    const toggleMarkdownFiles = vi.fn();
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={toggleMarkdownFiles}
        onToggleTheme={() => {}}
      />
    );

    const toggle = screen.getByRole("button", { name: "Toggle Markdown files" });

    expect(toggle.closest(".titlebar-spacer")).toHaveClass("pl-22");
    expect(toggle.closest(".titlebar-spacer")).toHaveClass("h-10");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toContainElement(container.querySelector(".lucide-panel-left"));

    fireEvent.click(toggle);

    expect(toggleMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it("shows a quick new file button next to the markdown files toggle when the sidebar is collapsed", () => {
    const createMarkdownFile = vi.fn();
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        quickCreateMarkdownFileVisible
        theme="light"
        onCreateMarkdownFile={createMarkdownFile}
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    const button = screen.getByRole("button", { name: "New file" });

    expect(button.closest(".titlebar-spacer")).toHaveClass("gap-1");
    expect(button).toContainElement(container.querySelector(".lucide-square-pen"));

    fireEvent.click(button);

    expect(createMarkdownFile).toHaveBeenCalledTimes(1);
  });

  it("hides the quick new file button while the markdown files sidebar is open", () => {
    render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen
        quickCreateMarkdownFileVisible
        theme="light"
        onCreateMarkdownFile={() => {}}
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: "New file" })).not.toBeInTheDocument();
  });

  it("keeps the markdown files toggle above the shifted title hit area", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen
        aiAgentWidth={512}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(container.querySelector(".titlebar-spacer")).toHaveClass("relative", "z-20");
    expect(container.querySelector(".native-title")).toHaveClass("pointer-events-none");
  });

  it("shows the inverse theme action", () => {
    const toggleTheme = vi.fn();
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        theme="dark"
        onToggleAiAgent={() => {}}
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
