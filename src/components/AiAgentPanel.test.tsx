import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    function Harness() {
      const [draft, setDraft] = useState("");
      const [messages, setMessages] = useState<{ id: number; role: "assistant" | "user"; text: string }[]>([]);

      return (
        <AiAgentPanel
          draft={draft}
          language="en"
          messages={messages}
          modelName="GPT-5.5"
          open
          providerName="OpenAI"
          onClose={() => {}}
          onDraftChange={setDraft}
          onSubmit={(promptOverride) => {
            const text = (promptOverride ?? draft).trim();
            if (!text) return;

            setMessages((currentMessages) => [
              ...currentMessages,
              { id: currentMessages.length + 1, role: "user", text },
              { id: currentMessages.length + 2, role: "assistant", text: "Ready for the next step." }
            ]);
            setDraft("");
          }}
        />
      );
    }

    render(
      <Harness />
    );

    const input = screen.getByRole("textbox", { name: "Agent message" });
    fireEvent.change(input, { target: { value: "Summarize this note" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Summarize this note")).toBeInTheDocument();
    expect(screen.getByText("Ready for the next step.")).toBeInTheDocument();
    expect(screen.getByText("Summarize this note").closest("li")).toHaveClass("ml-auto", "max-w-[82%]", "rounded-lg");
    expect(screen.getByText("Ready for the next step.").closest("li")).toHaveClass("mr-auto", "max-w-[86%]");
    expect(input).toHaveValue("");
  });

  it("does not send when Enter confirms an IME composition", () => {
    function Harness() {
      const [draft, setDraft] = useState("都有什么ai");
      const [messages, setMessages] = useState<{ id: number; role: "assistant" | "user"; text: string }[]>([]);

      return (
        <AiAgentPanel
          draft={draft}
          language="zh-CN"
          messages={messages}
          open
          onClose={() => {}}
          onDraftChange={setDraft}
          onSubmit={(promptOverride) => {
            const text = (promptOverride ?? draft).trim();
            if (!text) return;

            setMessages((currentMessages) => [...currentMessages, { id: currentMessages.length + 1, role: "user", text }]);
            setDraft("");
          }}
        />
      );
    }

    render(<Harness />);

    const input = screen.getByRole("textbox", { name: "Agent 消息" });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: "Enter", nativeEvent: { isComposing: true, keyCode: 229 } });
    fireEvent.compositionEnd(input);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(input).toHaveValue("都有什么ai");
  });

  it("keeps the transcript scrolled to the newest streamed message", async () => {
    const initialMessage = {
      id: 1,
      role: "assistant" as const,
      text: "First chunk"
    };
    const { rerender } = render(
      <AiAgentPanel
        language="en"
        messages={[initialMessage]}
        open
        status="streaming"
        onClose={() => {}}
      />
    );
    const transcript = screen.getByRole("log", { name: "AI Agent" });

    Object.defineProperty(transcript, "scrollHeight", {
      configurable: true,
      value: 640
    });
    transcript.scrollTop = 12;

    rerender(
      <AiAgentPanel
        language="en"
        messages={[
          {
            ...initialMessage,
            text: "First chunk plus the streamed ending"
          }
        ]}
        open
        status="streaming"
        onClose={() => {}}
      />
    );

    await waitFor(() => expect(transcript.scrollTop).toBe(640));
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

  it("lets the right-side agent panel be resized from its left edge", () => {
    const resize = vi.fn();
    const resizeEnd = vi.fn();
    const resizeStart = vi.fn();
    render(
      <AiAgentPanel
        language="en"
        maxWidth={640}
        minWidth={320}
        modelName="GPT-5.5"
        open
        providerName="OpenAI"
        width={420}
        onClose={() => {}}
        onResize={resize}
        onResizeEnd={resizeEnd}
        onResizeStart={resizeStart}
      />
    );

    const handle = screen.getByRole("separator", { name: "Resize AI Agent" });

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 20 });
    fireEvent.pointerMove(window, { clientX: -400 });
    fireEvent.pointerMove(window, { clientX: 260 });
    fireEvent.pointerUp(window);

    expect(resizeStart).toHaveBeenCalledTimes(1);
    expect(resize).toHaveBeenNthCalledWith(1, 500);
    expect(resize).toHaveBeenNthCalledWith(2, 640);
    expect(resize).toHaveBeenNthCalledWith(3, 320);
    expect(resizeEnd).toHaveBeenCalledTimes(1);
    expect(handle).toHaveAttribute("aria-valuemin", "320");
    expect(handle).toHaveAttribute("aria-valuemax", "640");
    expect(handle).toHaveAttribute("aria-valuenow", "420");
  });

  it("switches models and toggles supported agent modes", () => {
    const selectModel = vi.fn();
    function Harness() {
      const [thinkingEnabled, setThinkingEnabled] = useState(false);
      const [webSearchEnabled, setWebSearchEnabled] = useState(false);

      return (
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
          thinkingEnabled={thinkingEnabled}
          webSearchEnabled={webSearchEnabled}
          onClose={() => {}}
          onSelectModel={selectModel}
          onToggleThinking={() => setThinkingEnabled((enabled) => !enabled)}
          onToggleWebSearch={() => setWebSearchEnabled((enabled) => !enabled)}
        />
      );
    }

    render(
      <Harness />
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

  it("renders assistant chat bubbles as markdown", () => {
    render(
      <AiAgentPanel
        language="en"
        messages={[
          {
            id: 1,
            role: "assistant",
            text: "**Bold**\n\n- First item"
          }
        ]}
        open
        onClose={() => {}}
      />
    );

    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getByText("First item").closest("ul")).toBeInTheDocument();
  });

  it("renders visible process steps for assistant messages", () => {
    render(
      <AiAgentPanel
        language="en"
        messages={[
          {
            activities: [
              {
                detail: "Requested tool calls",
                id: "call:1",
                kind: "ai_call",
                label: "AI call 1",
                status: "completed",
                turn: 1
              },
              {
                id: "assistant:1",
                kind: "assistant_message",
                label: "I'll inspect the current document first.",
                status: "completed",
                turn: 1
              },
              {
                detail: "42 chars",
                id: "tool:1",
                kind: "tool_call",
                label: "Read current document",
                rawLabel: "get_document",
                status: "running",
                turn: 1
              },
              {
                id: "call:2",
                kind: "ai_call",
                label: "AI call 2",
                status: "running",
                turn: 2
              }
            ],
            id: 1,
            role: "assistant",
            text: "Ready."
          }
        ]}
        open
        onClose={() => {}}
      />
    );

    expect(screen.queryByText("AI call 1")).not.toBeInTheDocument();
    expect(screen.queryByText("AI call 2")).not.toBeInTheDocument();
    expect(screen.queryByText("Requested tool calls")).not.toBeInTheDocument();
    expect(screen.getByText("I'll inspect the current document first.")).toBeInTheDocument();
    expect(screen.getByText("Read current document")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("get_document")).not.toBeInTheDocument();
    expect(screen.queryByText("42 chars")).not.toBeInTheDocument();
    expect(screen.getByText("Ready.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Read current document/i }));

    expect(screen.getByText("get_document")).toBeInTheDocument();
    expect(screen.getByText("42 chars")).toBeInTheDocument();
  });

  it("collapses completed process flow and allows expanding it later", () => {
    render(
      <AiAgentPanel
        language="en"
        messages={[
          {
            activities: [
              {
                id: "assistant:1",
                kind: "assistant_message",
                label: "I checked the document first.",
                status: "completed",
                turn: 1
              },
              {
                detail: "42 chars",
                id: "tool:1",
                kind: "tool_call",
                label: "Read current document",
                rawLabel: "get_document",
                status: "completed",
                turn: 1
              }
            ],
            id: 1,
            role: "assistant",
            text: "Ready."
          }
        ]}
        open
        onClose={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /2 steps/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("I checked the document first.")).not.toBeInTheDocument();
    expect(screen.queryByText("Read current document")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /2 steps/i }));

    expect(screen.getByRole("button", { name: /2 steps/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("I checked the document first.")).toBeInTheDocument();
    expect(screen.getByText("Read current document")).toBeInTheDocument();
  });

  it("keeps process flow open while running and collapses it when the run completes", async () => {
    const runningMessage = {
      activities: [
        {
          id: "assistant:1",
          kind: "assistant_message" as const,
          label: "I am checking the current document.",
          status: "completed" as const,
          turn: 1
        },
        {
          id: "tool:1",
          kind: "tool_call" as const,
          label: "Read current document",
          status: "running" as const,
          turn: 1
        }
      ],
      id: 1,
      role: "assistant" as const,
      text: "Ready."
    };
    const completedMessage = {
      ...runningMessage,
      activities: runningMessage.activities.map((activity) => ({ ...activity, status: "completed" as const }))
    };
    const { rerender } = render(
      <AiAgentPanel
        language="en"
        messages={[runningMessage]}
        open
        onClose={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: /2 steps/i })).not.toBeInTheDocument();
    expect(screen.getByText("I am checking the current document.")).toBeInTheDocument();
    expect(screen.getByText("Read current document")).toBeInTheDocument();

    rerender(
      <AiAgentPanel
        language="en"
        messages={[completedMessage]}
        open
        onClose={() => {}}
      />
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /2 steps/i })).toHaveAttribute("aria-expanded", "false"));
    expect(screen.queryByText("I am checking the current document.")).not.toBeInTheDocument();
    expect(screen.queryByText("Read current document")).not.toBeInTheDocument();
  });

  it("keeps process flow open until every hidden AI call has completed", () => {
    render(
      <AiAgentPanel
        language="en"
        messages={[
          {
            activities: [
              {
                id: "call:1",
                kind: "ai_call",
                label: "AI call 1",
                status: "completed",
                turn: 1
              },
              {
                id: "assistant:1",
                kind: "assistant_message",
                label: "I inspected the section.",
                status: "completed",
                turn: 1
              },
              {
                detail: "section:2",
                id: "tool:1",
                kind: "tool_call",
                label: "Locate section",
                status: "completed",
                turn: 1
              },
              {
                id: "call:2",
                kind: "ai_call",
                label: "AI call 2",
                status: "running",
                turn: 2
              }
            ],
            id: 1,
            role: "assistant",
            text: ""
          }
        ]}
        open
        onClose={() => {}}
      />
    );

    expect(screen.queryByRole("button", { name: /2 steps/i })).not.toBeInTheDocument();
    expect(screen.getByText("I inspected the section.")).toBeInTheDocument();
    expect(screen.getByText("Locate section")).toBeInTheDocument();
  });
});
