import { fireEvent, render, screen } from "@testing-library/react";

import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("renders an accessible label and optional pressed state", () => {
    const handleClick = vi.fn();

    render(
      <IconButton label="Toggle sidebar" pressed={true} onClick={handleClick}>
        <span aria-hidden="true">S</span>
      </IconButton>
    );

    const button = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
