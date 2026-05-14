import { render, screen } from "@testing-library/react";
import { MarkdownTabsBar } from "./MarkdownTabsBar";

describe("MarkdownTabsBar", () => {
  it("marks titlebar tab empty space as a window drag region", () => {
    const { container } = render(
      <MarkdownTabsBar
        activeTabId="tab-a"
        placement="titlebar"
        tabs={[
          {
            dirty: false,
            id: "tab-a",
            name: "Alpha.md",
            path: "/synthetic/alpha.md"
          }
        ]}
        onCloseTab={() => {}}
        onNewTab={() => {}}
        onSelectTab={() => {}}
      />
    );

    expect(screen.getByRole("tablist", { name: "Open documents" })).toBeInTheDocument();
    expect(container.querySelector(".document-tabs-titlebar")).toHaveAttribute("data-tauri-drag-region");
    expect(container.querySelector(".document-tabs-drag-spacer")).toHaveAttribute("data-tauri-drag-region");
  });
});
