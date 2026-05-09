import { fireEvent, render, screen } from "@testing-library/react";

import { Select } from "./Select";

describe("Select", () => {
  it("preserves native select change behavior", () => {
    const handleChange = vi.fn();

    render(
      <Select aria-label="Provider" value="openai" onChange={handleChange}>
        <option value="openai">OpenAI</option>
        <option value="deepseek">DeepSeek</option>
      </Select>
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), { target: { value: "deepseek" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});
