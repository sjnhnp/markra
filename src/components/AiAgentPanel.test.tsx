import { fireEvent, render, screen } from "@testing-library/react";
import { AiAgentPanel } from "./AiAgentPanel";

describe("AiAgentPanel", () => {
  it("renders a focused right-side agent workspace", () => {
    const close = vi.fn();
    const { container } = render(
      <AiAgentPanel
        language="en"
        modelName="GPT-5.5"
        open
        providerName="OpenAI"
        onClose={close}
      />
    );

    expect(screen.getByRole("complementary", { name: "AI Agent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI Agent" })).toBeInTheDocument();
    expect(screen.getByText("OpenAI · GPT-5.5")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Agent message" })).toHaveAttribute("placeholder", "Ask the agent...");
    expect(screen.getByRole("button", { name: "Close AI Agent" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close AI Agent" })).toHaveClass("z-30");
    expect(container.querySelector(".ai-agent-panel")).toHaveClass("border-l");
    expect(container.querySelector(".ai-agent-panel")).toHaveClass("z-20");

    fireEvent.click(screen.getByRole("button", { name: "Close AI Agent" }));

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps typed messages in the agent transcript", () => {
    render(
      <AiAgentPanel
        language="en"
        modelName="GPT-5.5"
        open
        providerName="OpenAI"
        onClose={() => {}}
      />
    );

    const input = screen.getByRole("textbox", { name: "Agent message" });
    fireEvent.change(input, { target: { value: "Summarize this note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Summarize this note")).toBeInTheDocument();
    expect(screen.getByText("Ready for the next step.")).toBeInTheDocument();
    expect(screen.getByText("Summarize this note")).toHaveClass("ml-auto", "max-w-[82%]", "rounded-lg");
    expect(screen.getByText("Ready for the next step.")).toHaveClass("mr-auto", "max-w-[86%]", "rounded-lg");
    expect(input).toHaveValue("");
  });

  it("keeps the composer text aligned without a leading icon column", () => {
    const { container } = render(
      <AiAgentPanel
        language="en"
        modelName="GPT-5.5"
        open
        providerName="OpenAI"
        onClose={() => {}}
      />
    );

    const input = screen.getByRole("textbox", { name: "Agent message" });
    const sendButton = screen.getByRole("button", { name: "Send message" });

    expect(input).toHaveClass("w-full");
    expect(input).not.toHaveClass("pr-10");
    expect(sendButton).not.toHaveClass("absolute");
    expect(container.querySelector("form .lucide-sparkles")).not.toBeInTheDocument();
  });

  it("switches models and toggles supported agent modes", () => {
    const selectModel = vi.fn();
    render(
      <AiAgentPanel
        availableModels={[
          {
            capabilities: ["text", "reasoning", "web"],
            id: "gpt-5.5",
            name: "GPT-5.5",
            providerId: "openai",
            providerName: "OpenAI",
            providerType: "openai"
          },
          {
            capabilities: ["text"],
            id: "claude-sonnet-4-6",
            name: "Claude Sonnet 4.6",
            providerId: "anthropic",
            providerName: "Anthropic",
            providerType: "anthropic"
          }
        ]}
        language="en"
        open
        selectedModelId="gpt-5.5"
        selectedProviderId="openai"
        onClose={() => {}}
        onSelectModel={selectModel}
      />
    );

    const deepThinking = screen.getByRole("button", { name: "Deep thinking" });
    const webSearch = screen.getByRole("button", { name: "Web search" });
    const modelSelector = screen.getByRole("combobox", { name: "AI model" });

    fireEvent.click(deepThinking);
    fireEvent.click(webSearch);
    fireEvent.click(modelSelector);
    expect(screen.getByAltText("Anthropic logo")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("option")[1]!);

    expect(deepThinking).toHaveAttribute("aria-pressed", "true");
    expect(webSearch).toHaveAttribute("aria-pressed", "true");
    expect(selectModel).toHaveBeenCalledWith("anthropic", "claude-sonnet-4-6");
  });

  it("disables agent modes that the selected model does not support", () => {
    render(
      <AiAgentPanel
        availableModels={[
          {
            capabilities: ["text"],
            id: "llama3.3",
            name: "Llama 3.3",
            providerId: "ollama",
            providerName: "Ollama",
            providerType: "ollama"
          }
        ]}
        language="en"
        open
        selectedModelId="llama3.3"
        selectedProviderId="ollama"
        onClose={() => {}}
        onSelectModel={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Deep thinking" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Web search" })).toBeDisabled();
  });
});
