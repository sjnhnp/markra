import { fireEvent, render, screen } from "@testing-library/react";
import { NativeTitleBar } from "./NativeTitleBar";

describe("NativeTitleBar", () => {
  it("renders centered title and file actions inside the drag region", () => {
    const { container } = render(
      <NativeTitleBar
        dirty={false}
        documentName="Draft.md"
        theme="light"
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleTheme={() => {}}
      />
    );
    const titlebar = container.querySelector(".native-titlebar");

    expect(screen.getByLabelText("Window drag region")).toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByRole("heading", { name: "Draft.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Markdown or Folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Markdown Folder" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(titlebar).toHaveClass("grid-cols-[110px_minmax(0,1fr)_110px]");
  });

  it("shows the inverse theme action", () => {
    const toggleTheme = vi.fn();
    const { container } = render(
      <NativeTitleBar
        dirty={false}
        documentName="Draft.md"
        theme="dark"
        onOpenMarkdown={() => {}}
        onSaveMarkdown={() => {}}
        onToggleTheme={toggleTheme}
      />
    );

    const button = screen.getByRole("button", { name: "Switch to light theme" });

    expect(button).toContainElement(container.querySelector(".lucide-sun"));

    fireEvent.click(button);

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });
});
