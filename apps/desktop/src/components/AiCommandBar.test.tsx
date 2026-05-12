import { fireEvent, render, screen } from "@testing-library/react";
import { AiCommandBar } from "./AiCommandBar";

describe("AiCommandBar", () => {
  it("keeps result follow-up input aligned with the pre-generation command UI", () => {
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

    const commandBox = screen.getByRole("textbox", { name: "AI command" }).closest(".ai-command-box");

    expect(screen.queryByText("AI suggestion ready")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "AI command" }).closest(".ai-command-panel")).not.toBeInTheDocument();
    expect(commandBox).toHaveClass("min-h-21", "rounded-lg", "border", "border-(--accent)");
    expect(commandBox).toHaveClass("shadow-(--ai-command-expanded-shadow)");
    expect(screen.queryByText("AI toolkit")).not.toBeInTheDocument();
    expect(screen.queryByText("Original")).not.toBeInTheDocument();
    expect(screen.queryByText("Improved")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("keeps the result follow-up field ready for another instruction", () => {
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
        prompt=""
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "AI command" })).toHaveAttribute(
      "placeholder",
      "Tell AI what else needs to be changed..."
    );
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
    expect(document.querySelector(".ai-command-loading-icon")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "new text" } });
    fireEvent.click(screen.getByRole("button", { name: "Stop AI command" }));

    expect(onPromptChange).not.toHaveBeenCalled();
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it("shows a quiet thinking status while AI is running", () => {
    render(
      <AiCommandBar
        language="zh-CN"
        open
        prompt="rewrite"
        submitting
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const status = screen.getByRole("status");

    expect(status).toHaveTextContent(/^正在思考$/);
    expect(status).toHaveClass("text-(--text-secondary)");
    expect(screen.getByText("正在思考")).toHaveClass("ai-command-thinking-text");
    expect(screen.queryByText("Reading context")).not.toBeInTheDocument();
    expect(screen.queryByText("Generating suggestion")).not.toBeInTheDocument();
  });

  it("shows expanded thinking feedback for an external AI context action before submission starts", () => {
    render(
      <AiCommandBar
        externalActionPending
        language="zh-CN"
        open
        prompt="润色"
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI 命令" });
    const status = screen.getByRole("status");
    const commandBox = input.closest(".ai-command-box");

    expect(input).toHaveAttribute("readonly");
    expect(input).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(/^正在思考$/);
    expect(commandBox).toHaveClass("min-h-21", "rounded-lg", "border-(--accent)");
    expect(commandBox).not.toHaveClass("h-14", "rounded-xl");
  });

  it("submits with Enter instead of inserting a newline", () => {
    const onPromptChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AiCommandBar
        language="en"
        open
        prompt="rewrite"
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: "AI command" }), { key: "Enter" });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onPromptChange).not.toHaveBeenCalled();
  });

  it("does not submit when Enter confirms an IME composition", () => {
    const onPromptChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AiCommandBar
        language="zh-CN"
        open
        prompt="都有什么ai"
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI 命令" });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", nativeEvent: { isComposing: true, keyCode: 229 } });
    fireEvent.compositionEnd(input);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onPromptChange).not.toHaveBeenCalled();
  });

  it("inserts a newline with Ctrl+Enter", () => {
    const onPromptChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AiCommandBar
        language="en"
        open
        prompt="helloworld"
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "AI command" });
    input.setSelectionRange(5, 5);
    fireEvent.keyDown(input, { ctrlKey: true, key: "Enter" });

    expect(onPromptChange).toHaveBeenCalledWith("hello\nworld");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uses quick actions, sends them immediately, and hides the toolkit once the user types", async () => {
    const onPromptChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AiCommandBar
        language="en"
        open
        prompt=""
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI command" });

    fireEvent.click(input);
    expect(await screen.findByText("AI toolkit")).toBeInTheDocument();
    expect(screen.getByLabelText("AI quick actions")).toHaveClass("bottom-[calc(100%+10px)]");

    fireEvent.click(screen.getByRole("button", { name: "Polish" }));

    expect(onPromptChange).toHaveBeenCalledWith("Polish");
    expect(onSubmit).toHaveBeenCalledWith("Polish", "polish");
    expect(screen.queryByText("AI toolkit")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "custom request" } });

    expect(screen.queryByText("AI toolkit")).not.toBeInTheDocument();
  });

  it("keeps quick action generation in the compact input style", async () => {
    const onPromptChange = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <AiCommandBar
        language="zh-CN"
        open
        prompt=""
        submitting={false}
        onClose={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("textbox", { name: "AI 命令" }));
    fireEvent.click(await screen.findByRole("button", { name: "润色" }));

    rerender(
      <AiCommandBar
        language="zh-CN"
        open
        prompt="润色"
        submitting
        onClose={vi.fn()}
        onInterrupt={vi.fn()}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />
    );

    const status = screen.getByRole("status");
    const commandBox = status.closest(".ai-command-box");

    expect(onPromptChange).toHaveBeenCalledWith("润色");
    expect(onSubmit).toHaveBeenCalledWith("润色", "polish");
    expect(status).toHaveTextContent("润色中……");
    expect(screen.getByText("润色中……")).toHaveClass("ai-command-inline-loading-text");
    expect(commandBox).toHaveClass("h-14", "rounded-xl", "border-(--border-default)");
    expect(commandBox).not.toHaveClass("min-h-21", "border-(--accent)");
    expect(screen.queryByRole("combobox", { name: "AI 模型" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中断 AI 命令" })).toBeInTheDocument();
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
            providerName: "OpenAI",
            providerType: "openai"
          },
          {
            id: "claude-sonnet-4-6",
            name: "Claude Sonnet 4.6",
            providerId: "anthropic",
            providerName: "Anthropic",
            providerType: "anthropic"
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
    const modelPicker = screen.getByRole("combobox", { name: "AI model" });
    expect(modelPicker.closest(".ai-command-footer")).toHaveClass("justify-end");
    expect(screen.getByAltText("OpenAI logo")).toBeInTheDocument();
    fireEvent.click(modelPicker);
    expect(screen.getByAltText("Anthropic logo")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("option")[1]!);

    expect(onSelectModel).toHaveBeenCalledWith("anthropic", "claude-sonnet-4-6");
  });

  it("lets DeepSeek commands opt into thinking for a single send", () => {
    const onSubmit = vi.fn();

    render(
      <AiCommandBar
        language="zh-CN"
        open
        prompt="润色"
        selectedProviderId="deepseek"
        submitting={false}
        supportsThinking
        onClose={vi.fn()}
        onPromptChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const input = screen.getByRole("textbox", { name: "AI 命令" });
    fireEvent.click(input);
    fireEvent.click(screen.getByRole("button", { name: "深度思考" }));
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("button", { name: "深度思考" })).toHaveAttribute("aria-pressed", "true");
    expect(onSubmit).toHaveBeenCalledWith(undefined, "custom", { thinkingEnabled: true });
  });
});
