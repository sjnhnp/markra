import { fireEvent, render, screen } from "@testing-library/react";
import { AiCommandBar } from "./AiCommandBar";

describe("AiCommandBar", () => {
  it("keeps result details and actions out of the bottom command surface", () => {
    render(
      <AiCommandBar
        aiResult={{
          from: 1,
          original: "Original",
          replacement: "Improved",
          to: 9,
          type: "replace"
        }}
        language="en"
        open
        prompt="rewrite"
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("AI suggestion ready")).toBeInTheDocument();
    expect(screen.queryByText("AI toolkit")).not.toBeInTheDocument();
    expect(screen.queryByText("Original")).not.toBeInTheDocument();
    expect(screen.queryByText("Improved")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "AI command" }).closest(".ai-command-panel")).toBeInTheDocument();
  });

  it("locks the input and shows an interrupt control while AI is running", () => {
    const onInterrupt = vi.fn();
    const onPromptChange = vi.fn();

    render(
      <AiCommandBar
        language="en"
        open
        prompt="rewrite"
        submitting
        onClose={vi.fn()}
        onInterrupt={onInterrupt}
        onPromptChange={onPromptChange}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI command" });

    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("AI is writing...")).not.toBeInTheDocument();
    expect(document.querySelector(".ai-command-loading-icon")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "new text" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop AI command" }));

    expect(onPromptChange).not.toHaveBeenCalled();
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it("uses quick actions and hides the toolkit once the user types", async () => {
    const onPromptChange = vi.fn();

    render(
      <AiCommandBar
        language="en"
        open
        prompt=""
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI command" });

    fireEvent.click(input);
    expect(await screen.findByText("AI toolkit")).toBeInTheDocument();
    expect(screen.getByLabelText("AI quick actions")).toHaveClass("bottom-[calc(100%+10px)]");

    fireEvent.click(screen.getByRole("button", { name: "Polish" }));

    expect(onPromptChange).toHaveBeenCalledWith("Polish");
    expect(screen.queryByText("AI toolkit")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "custom request" } });

    expect(screen.queryByText("AI toolkit")).not.toBeInTheDocument();
  });

  it("keeps the compact command input vertically centered", () => {
    render(
      <AiCommandBar
        language="en"
        open
        prompt=""
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI command" });

    expect(input.closest("div")).toHaveClass("items-center");
    expect(input).toHaveClass("h-10", "leading-10");
  });

  it("lets the editor choose the AI model used by the command", () => {
    const onSelectModel = vi.fn();

    render(
      <AiCommandBar
        availableModels={[
          {
            id: "gpt-5.5",
            name: "GPT-5.5",
            providerId: "openai",
            providerName: "OpenAI"
          },
          {
            id: "claude-sonnet-4-6",
            name: "Claude Sonnet 4.6",
            providerId: "anthropic",
            providerName: "Anthropic"
          }
        ]}
        editorLeftInset="18rem"
        language="en"
        open
        prompt="rewrite"
        selectedModelId="gpt-5.5"
        selectedProviderId="openai"
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSelectModel={onSelectModel}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI command" });
    fireEvent.click(input);
    expect(screen.getByRole("dialog", { name: "AI writing command" })).toHaveStyle({
      left: "18rem",
      right: "0px"
    });
    expect(screen.getByRole("combobox", { name: "AI model" }).closest(".ai-command-footer")).toHaveClass("justify-end");
    fireEvent.change(screen.getByRole("combobox", { name: "AI model" }), {
      target: { value: "anthropic::claude-sonnet-4-6" }
    });

    expect(onSelectModel).toHaveBeenCalledWith("anthropic", "claude-sonnet-4-6");
  });
});
