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
    expect(screen.getByRole("button", { name: "Toggle Markra AI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle file list" })).toBeInTheDocument();
    expect(titlebar).toHaveClass("grid-cols-[164px_minmax(0,1fr)_164px]");
    expect(titlebar).toHaveClass("h-10");
    expect(container.querySelector(".document-actions")).toHaveClass("h-10");
  });

  it("toggles the right-side Markra AI panel from the file action area", () => {
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

    const button = screen.getByRole("button", { name: "Toggle Markra AI" });

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toContainElement(container.querySelector(".lucide-bot"));
    expect(container.querySelector(".document-actions")).toHaveStyle({ transform: "translateX(-512px)" });

    fireEvent.click(button);

    expect(toggleAiAgent).toHaveBeenCalledTimes(1);
  });

  it("uses separate source and visual editor mode action buttons", () => {
    const toggleSourceMode = vi.fn();
    const visualModeCase = render(
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
        onToggleSourceMode={toggleSourceMode}
        onToggleTheme={() => {}}
      />
    );

    const sourceButton = screen.getByRole("button", { name: "Switch to source mode" });
    expect(sourceButton).toContainElement(visualModeCase.container.querySelector(".lucide-code-xml"));
    expect(sourceButton).not.toHaveAttribute("aria-pressed");
    expect(screen.queryByRole("button", { name: "Switch to visual mode" })).not.toBeInTheDocument();

    fireEvent.click(sourceButton);

    expect(toggleSourceMode).toHaveBeenCalledTimes(1);

    visualModeCase.unmount();

    const sourceModeCase = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentName="Draft.md"
        markdownFilesOpen={false}
        sourceMode
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleSourceMode={toggleSourceMode}
        onToggleTheme={() => {}}
      />
    );

    const visualButton = screen.getByRole("button", { name: "Switch to visual mode" });
    expect(visualButton).toContainElement(sourceModeCase.container.querySelector(".lucide-eye"));
    expect(visualButton).not.toHaveAttribute("aria-pressed");
    expect(screen.queryByRole("button", { name: "Switch to source mode" })).not.toBeInTheDocument();
    expect(sourceModeCase.container.querySelector(".lucide-code-xml")).not.toBeInTheDocument();
  });

  it("centers the document title inside the editor area when the Markra AI panel is open", () => {
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

  it("balances the document title between the markdown files sidebar and Markra AI panel", () => {
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

  it("keeps file actions synced immediately while the Markra AI panel is resizing", () => {
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

    const toggle = screen.getByRole("button", { name: "Toggle file list" });
    const controls = container.querySelector(".mac-window-controls");

    expect(controls).toBeInTheDocument();
    expect(toggle.closest(".titlebar-spacer")).not.toHaveClass("pl-22");
    expect(toggle.closest(".titlebar-spacer")).toHaveClass("h-10");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toContainElement(container.querySelector(".lucide-panel-left"));

    fireEvent.click(toggle);

    expect(toggleMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it("keeps only right-aligned file actions on Windows", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen
        aiAgentWidth={384}
        dirty
        documentName="Draft.md"
        markdownFilesOpen={false}
        quickCreateMarkdownFileVisible
        theme="light"
        platform="windows"
        onCreateMarkdownFile={() => {}}
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    const titlebar = container.querySelector(".native-titlebar");

    expect(screen.getByLabelText("Window drag region")).toBeInTheDocument();
    expect(titlebar).toHaveClass("fixed", "right-3.5", "w-auto");
    expect(titlebar).not.toHaveClass("inset-x-0");
    expect(titlebar).not.toHaveClass("grid-cols-[164px_minmax(0,1fr)_164px]");
    expect(container.querySelector(".mac-window-controls")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Draft.md" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle file list" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New file" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Markdown or Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markra AI" })).toBeInTheDocument();
    expect(container.querySelector(".document-actions")).toHaveClass("relative");
    expect(container.querySelector(".document-actions")).not.toHaveStyle({ transform: "translateX(-384px)" });
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
    const toggle = screen.getByRole("button", { name: "Toggle file list" });

    expect(toggle).toContainElement(container.querySelector(".lucide-panel-right"));
    expect(button.closest(".titlebar-spacer")).toHaveClass("gap-1");
    expect(button).toContainElement(container.querySelector(".lucide-square-pen"));

    fireEvent.click(button);

    expect(createMarkdownFile).toHaveBeenCalledTimes(1);
  });

  it("uses an image icon for image preview titles", () => {
    const { container } = render(
      <NativeTitleBar
        aiAgentOpen={false}
        dirty={false}
        documentKind="image"
        documentName="pasted-image.png"
        markdownFilesOpen={false}
        theme="light"
        onToggleAiAgent={() => {}}
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleMarkdownFiles={() => {}}
        onToggleTheme={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "pasted-image.png" })).toBeInTheDocument();
    expect(container.querySelector(".native-title")).toContainElement(container.querySelector(".lucide-image"));
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
