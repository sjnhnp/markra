import { fireEvent, render, screen } from "@testing-library/react";
import { MarkdownFileTreeDrawer } from "./MarkdownFileTreeDrawer";

const markdownFiles = [
  { name: "Untitled.md", path: "/vault/Untitled.md", relativePath: "Untitled.md" },
  { name: "AWS.md", path: "/vault/AWS.md", relativePath: "AWS.md" },
  { name: "deploy.md", path: "/vault/deploy/deploy.md", relativePath: "deploy/deploy.md" }
];

describe("MarkdownFileTreeDrawer", () => {
  it("uses a file-list icon for the launcher", () => {
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath={null}
        files={[]}
        open={false}
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
        onToggle={() => {}}
      />
    );

    const launcher = screen.getByRole("button", { name: "Toggle Markdown files" });

    expect(launcher).toContainElement(container.querySelector(".lucide-list"));
    expect(launcher).not.toContainElement(container.querySelector(".lucide-files"));
  });

  it("keeps the drawer toggle fixed in the lower-left while open", () => {
    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
        onToggle={() => {}}
      />
    );

    const launcher = screen.getByRole("button", { name: "Toggle Markdown files" });

    expect(launcher).toHaveClass("fixed");
    expect(launcher).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a folder-style markdown file tree with folders collapsed by default", () => {
    const openFile = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={openFile}
        onSelectOutlineItem={() => {}}
        onToggle={() => {}}
      />
    );

    const sidebar = screen.getByRole("complementary", { name: "Markdown file tree" });
    const folder = screen.getByRole("button", { name: "deploy" });

    expect(sidebar).toBeInTheDocument();
    expect(sidebar).not.toHaveClass("fixed");
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("Obsidian Vault")).toBeInTheDocument();
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "deploy/deploy.md" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Untitled.md" })).toHaveAttribute("aria-current", "page");
    expect(container.querySelector('[role="tree"]')).toBeInTheDocument();

    fireEvent.click(folder);
    fireEvent.click(screen.getByRole("button", { name: "deploy/deploy.md" }));

    expect(openFile).toHaveBeenCalledWith(markdownFiles[2]);
  });

  it("keeps child branches visually connected when a folder is expanded", () => {
    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
        onToggle={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "deploy" }));

    expect(screen.getByRole("group", { name: "deploy children" })).toHaveClass("border-l");
  });

  it("uses semantic icons when switching between file and outline views", () => {
    const selectOutlineItem = vi.fn();
    const { container } = render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[
          { level: 1, title: "Intro" },
          { level: 2, title: "Details" }
        ]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={selectOutlineItem}
        onToggle={() => {}}
      />
    );

    const outlineSwitch = screen.getByRole("button", { name: "Show outline" });

    expect(outlineSwitch).toContainElement(container.querySelector(".lucide-table-of-contents"));

    fireEvent.click(outlineSwitch);

    const filesSwitch = screen.getByRole("button", { name: "Show files" });

    expect(filesSwitch).toContainElement(container.querySelector(".lucide-folder-tree"));
    expect(screen.getByText("大纲")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Document outline" })).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.queryByText("Obsidian Vault")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(selectOutlineItem).toHaveBeenCalledWith({ level: 2, title: "Details" }, 1);
  });

  it("uses the drawer top-left button to switch between file and outline views", () => {
    const selectOutlineItem = vi.fn();

    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[
          { level: 1, title: "Intro" },
          { level: 2, title: "Details" }
        ]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={selectOutlineItem}
        onToggle={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByText("大纲")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Document outline" })).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show files" })).toBeInTheDocument();
    expect(screen.queryByText("Obsidian Vault")).not.toBeInTheDocument();
    expect(selectOutlineItem).toHaveBeenCalledWith({ level: 2, title: "Details" }, 1);
  });

  it("keeps outline clicks from stealing focus before navigation runs", () => {
    render(
      <MarkdownFileTreeDrawer
        currentPath="/vault/Untitled.md"
        files={markdownFiles}
        open
        outlineItems={[{ level: 1, title: "A" }]}
        rootName="Obsidian Vault"
        onOpenFile={() => {}}
        onSelectOutlineItem={() => {}}
        onToggle={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Show outline" }));

    const mouseDown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    screen.getByRole("button", { name: "A" }).dispatchEvent(mouseDown);

    expect(mouseDown.defaultPrevented).toBe(true);
  });
});
