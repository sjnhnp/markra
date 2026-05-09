import * as matchers from "@testing-library/jest-dom/matchers";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect } from "vitest";

import {
  Badge,
  Button,
  Field,
  IconButton,
  Modal,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  Switch,
  Textarea,
  TextInput,
  ToggleButton
} from ".";

expect.extend(matchers);

describe("base UI components", () => {
  it("renders button variants while preserving native button props", () => {
    const handleClick = vi.fn();

    render(
      <Button aria-label="Save changes" variant="primary" onClick={handleClick}>
        Save
      </Button>
    );

    const button = screen.getByRole("button", { name: "Save changes" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-(--accent)");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders an accessible switch and reports the next checked state", () => {
    const handleChange = vi.fn();

    render(<Switch checked={false} label="Enable web search" onCheckedChange={handleChange} />);

    const switchButton = screen.getByRole("switch", { name: "Enable web search" });
    expect(switchButton).toHaveAttribute("aria-checked", "false");

    fireEvent.click(switchButton);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("renders a modal dialog with header, body, footer, and close action", () => {
    const handleClose = vi.fn();

    render(
      <Modal
        title="Custom headers"
        closeLabel="Close custom headers"
        closeIcon={<span aria-hidden="true">x</span>}
        footer={<Button variant="primary">Save</Button>}
        onClose={handleClose}
      >
        <p>Editor body</p>
      </Modal>
    );

    expect(screen.getByRole("dialog", { name: "Custom headers" })).toBeInTheDocument();
    expect(screen.getByText("Editor body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close custom headers" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders form controls with native change behavior", () => {
    const handleInputChange = vi.fn();
    const handleTextareaChange = vi.fn();
    const handleSelectChange = vi.fn();

    render(
      <>
        <TextInput aria-label="API key" value="secret" onChange={handleInputChange} />
        <Textarea aria-label="Headers JSON" value="{}" onChange={handleTextareaChange} />
        <Select aria-label="Provider" value="openai" onChange={handleSelectChange}>
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
        </Select>
      </>
    );

    fireEvent.change(screen.getByRole("textbox", { name: "API key" }), { target: { value: "updated" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Headers JSON" }), { target: { value: "{\"x\":1}" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Provider" }), { target: { value: "deepseek" } });

    expect(handleInputChange).toHaveBeenCalledTimes(1);
    expect(handleTextareaChange).toHaveBeenCalledTimes(1);
    expect(handleSelectChange).toHaveBeenCalledTimes(1);
  });

  it("renders icon buttons with accessible labels and pressed state", () => {
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

  it("renders badges as non-interactive status text", () => {
    render(<Badge aria-label="Reasoning">R</Badge>);

    const badge = screen.getByLabelText("Reasoning");
    expect(badge).toHaveClass("inline-flex");
    expect(badge).toHaveTextContent("R");
  });

  it("renders fields with labels, descriptions, and errors", () => {
    render(
      <Field label="API address" description="Provider endpoint" error="Invalid URL">
        <TextInput />
      </Field>
    );

    expect(screen.getByLabelText("API address")).toHaveAccessibleDescription("Provider endpoint Invalid URL");
    expect(screen.getByText("Invalid URL")).toHaveAttribute("role", "alert");
  });

  it("renders segmented controls with selectable items", () => {
    const handleLight = vi.fn();

    render(
      <SegmentedControl label="Theme">
        <SegmentedControlItem label="Light" selected={true} onClick={handleLight}>
          Light
        </SegmentedControlItem>
        <SegmentedControlItem label="Dark" selected={false}>
          Dark
        </SegmentedControlItem>
      </SegmentedControl>
    );

    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(handleLight).toHaveBeenCalledTimes(1);
  });

  it("renders pill toggle buttons with pressed state", () => {
    const handleClick = vi.fn();

    render(
      <ToggleButton label="Deep thinking" pressed={false} onClick={handleClick}>
        Deep thinking
      </ToggleButton>
    );

    const button = screen.getByRole("button", { name: "Deep thinking" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveClass("rounded-full");

    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
