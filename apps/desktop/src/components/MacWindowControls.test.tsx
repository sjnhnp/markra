import { fireEvent, render, screen } from "@testing-library/react";
import { MacWindowControls } from "./MacWindowControls";

describe("MacWindowControls", () => {
  it("renders fixed-size self-drawn macOS window controls", () => {
    const { container } = render(<MacWindowControls />);

    const close = screen.getByRole("button", { name: "Close window" });
    const minimize = screen.getByRole("button", { name: "Minimize window" });
    const zoom = screen.getByRole("button", { name: "Zoom window" });
    const glyphs = container.querySelectorAll(".mac-window-control-glyph");
    const controls = close.closest(".mac-window-controls");

    expect(close).toHaveClass("size-[15px]");
    expect(minimize).toHaveClass("size-[15px]");
    expect(zoom).toHaveClass("size-[15px]");
    expect(close).toHaveClass("relative");
    expect(minimize).toHaveClass("relative");
    expect(zoom).toHaveClass("relative");
    expect(controls).toHaveClass("h-10", "group/window-controls");
    expect(glyphs).toHaveLength(3);
    glyphs.forEach((glyph) => {
      expect(glyph).toHaveAttribute("aria-hidden", "true");
      expect(glyph).toHaveClass(
        "absolute",
        "top-1/2",
        "left-1/2",
        "-translate-x-1/2",
        "-translate-y-1/2",
        "opacity-0",
        "group-hover/window-controls:opacity-70"
      );
    });
    expect(close.querySelector('[data-icon="macos-close"]')).toHaveAttribute("viewBox", "0 0 16 18");
    expect(minimize.querySelector('[data-icon="macos-minimize"]')).toHaveAttribute("viewBox", "0 0 17 6");
    expect(zoom.querySelector('[data-icon="macos-zoom"]')).toHaveAttribute("viewBox", "0 0 16 16");
    expect(zoom.querySelector("g")).toHaveAttribute("transform", "translate(16 0) scale(-1 1)");
    expect(zoom.querySelectorAll("path")).toHaveLength(2);
  });

  it("dispatches the native window actions without letting clicks start dragging", () => {
    const close = vi.fn();
    const minimize = vi.fn();
    const zoom = vi.fn();

    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <MacWindowControls
          onClose={close}
          onMinimize={minimize}
          onZoom={zoom}
        />
      </div>
    );

    fireEvent.click(screen.getByRole("button", { name: "Close window" }));
    fireEvent.click(screen.getByRole("button", { name: "Minimize window" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom window" }));

    expect(close).toHaveBeenCalledTimes(1);
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});
