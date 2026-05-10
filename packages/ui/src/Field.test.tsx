import { render, screen } from "@testing-library/react";

import { Field } from "./Field";
import { TextInput } from "./TextInput";

describe("Field", () => {
  it("connects labels, descriptions, and errors to the control", () => {
    render(
      <Field label="API address" description="Provider endpoint" error="Invalid URL">
        <TextInput />
      </Field>
    );

    expect(screen.getByLabelText("API address")).toHaveAccessibleDescription("Provider endpoint Invalid URL");
    expect(screen.getByText("Invalid URL")).toHaveAttribute("role", "alert");
  });
});
