import { fireEvent, render, screen } from "@testing-library/react";
import { defaultAiQuickActionPrompts } from "../lib/ai-actions";
import { AiSelectionToolbar } from "./AiSelectionToolbar";

const anchor = {
  bottom: 180,
  left: 240,
  right: 420,
  top: 148
};

describe("AiSelectionToolbar", () => {
  it("renders built-in AI presets at the selected text anchor", () => {
    render(
      <AiSelectionToolbar
        anchor={anchor}
        language="en"
        open
        onOpenCommand={vi.fn()}
        onRunAction={vi.fn()}
      />
    );

    const toolbar = screen.getByRole("toolbar", { name: "AI quick actions" });

    expect(toolbar).toHaveStyle({
      left: "330px",
      top: "136px"
    });
    expect(screen.getByRole("button", { name: "AI command" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Polish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rewrite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue writing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Summarize" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Translate" })).toBeInTheDocument();
  });

  it("runs preset prompts through the existing inline AI action flow", () => {
    const onRunAction = vi.fn();

    render(
      <AiSelectionToolbar
        anchor={anchor}
        language="zh-CN"
        open
        onOpenCommand={vi.fn()}
        onRunAction={onRunAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "润色" }));

    expect(onRunAction).toHaveBeenCalledWith("polish", defaultAiQuickActionPrompts.polish);
  });

  it("uses configured prompt text while keeping the localized button label", () => {
    const onRunAction = vi.fn();

    render(
      <AiSelectionToolbar
        anchor={anchor}
        language="zh-CN"
        open
        quickActionPrompts={{
          ...defaultAiQuickActionPrompts,
          polish: "让选中的内容更清晰"
        }}
        onOpenCommand={vi.fn()}
        onRunAction={onRunAction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "润色" }));

    expect(onRunAction).toHaveBeenCalledWith("polish", "让选中的内容更清晰");
  });

  it("opens the full command input for a custom instruction", () => {
    const onOpenCommand = vi.fn();

    render(
      <AiSelectionToolbar
        anchor={anchor}
        language="en"
        open
        onOpenCommand={onOpenCommand}
        onRunAction={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "AI command" }));

    expect(onOpenCommand).toHaveBeenCalledTimes(1);
  });

  it("does not render when there is no selected text anchor", () => {
    render(
      <AiSelectionToolbar
        anchor={null}
        language="en"
        open
        onOpenCommand={vi.fn()}
        onRunAction={vi.fn()}
      />
    );

    expect(screen.queryByRole("toolbar", { name: "AI quick actions" })).not.toBeInTheDocument();
  });
});
