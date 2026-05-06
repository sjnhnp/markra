import { act, renderHook, waitFor } from "@testing-library/react";
import { runDocumentAiAgent } from "../lib/ai/agent/documentAgent";
import { useAiAgentSession } from "./useAiAgentSession";

vi.mock("../lib/ai/agent/documentAgent", () => ({
  runDocumentAiAgent: vi.fn()
}));

const mockedRunDocumentAiAgent = vi.mocked(runDocumentAiAgent);

describe("useAiAgentSession", () => {
  beforeEach(() => {
    mockedRunDocumentAiAgent.mockReset();
  });

  it("streams an assistant reply into the transcript", async () => {
    mockedRunDocumentAiAgent.mockImplementation(async ({ onTextDelta }) => {
      onTextDelta?.("Hello");

      return { content: "Hello", finishReason: "stop" };
    });

    const { result } = renderHook(() =>
      useAiAgentSession({
        documentPath: "/vault/README.md",
        getDocumentContent: () => "# Draft",
        model: "gpt-5.5",
        provider: {
          apiKey: "secret",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-5.5",
          enabled: true,
          id: "openai",
          models: [],
          name: "OpenAI",
          type: "openai"
        },
        settingsLoading: false,
        translate: (key) => key,
        workspaceFiles: []
      })
    );

    await act(async () => {
      await result.current.submit("Summarize this");
    });

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(result.current.messages).toEqual([
      { id: expect.any(Number), role: "user", text: "Summarize this" },
      {
        activities: [
          {
            id: "call:1",
            kind: "ai_call",
            label: "app.aiAgentTraceCall 1",
            status: "completed",
            turn: 1
          }
        ],
        id: expect.any(Number),
        role: "assistant",
        text: "Hello",
        thinking: ""
      }
    ]);
  });

  it("surfaces provider configuration errors without calling the runtime", async () => {
    const { result } = renderHook(() =>
      useAiAgentSession({
        getDocumentContent: () => "",
        model: null,
        provider: null,
        settingsLoading: false,
        translate: (key) => (key === "app.aiMissingProvider" ? "Missing provider" : key)
      })
    );

    await act(async () => {
      await result.current.submit("Hello");
    });

    expect(mockedRunDocumentAiAgent).not.toHaveBeenCalled();
    expect(result.current.messages.at(-1)).toEqual({
      id: expect.any(Number),
      isError: true,
      role: "assistant",
      text: "Missing provider"
    });
    expect(result.current.status).toBe("error");
  });

  it("forwards document edit tool results into the editor preview flow", async () => {
    const onAiResult = vi.fn();
    mockedRunDocumentAiAgent.mockImplementation(async ({ onPreviewResult }) => {
      onPreviewResult?.({
        from: 4,
        original: "Draft",
        replacement: "Polished draft",
        to: 9,
        type: "replace"
      });

      return {
        content: "I prepared a polished replacement for the current selection.",
        finishReason: "stop"
      };
    });

    const { result } = renderHook(() =>
      useAiAgentSession({
        documentPath: "/vault/README.md",
        getDocumentContent: () => "# Draft",
        getSelection: () => ({
          from: 4,
          source: "selection",
          text: "Draft",
          to: 9
        }),
        model: "gpt-5.5",
        onAiResult,
        provider: {
          apiKey: "secret",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-5.5",
          enabled: true,
          id: "openai",
          models: [],
          name: "OpenAI",
          type: "openai"
        },
        settingsLoading: false,
        translate: (key) => key,
        workspaceFiles: []
      })
    );

    await act(async () => {
      await result.current.submit("Polish this");
    });

    expect(onAiResult).toHaveBeenCalledWith({
      from: 4,
      original: "Draft",
      replacement: "Polished draft",
      to: 9,
      type: "replace"
    });
  });

  it("records visible agent process steps from runtime events", async () => {
    mockedRunDocumentAiAgent.mockImplementation(async ({ onEvent, onTextDelta }) => {
      onEvent?.({ type: "agent_start" });
      onEvent?.({ type: "turn_start" });
      onEvent?.({
        args: {},
        toolCallId: "tool-1",
        toolName: "get_document",
        type: "tool_execution_start"
      });
      onEvent?.({
        isError: false,
        result: {
          details: {
            length: 42
          }
        },
        toolCallId: "tool-1",
        toolName: "get_document",
        type: "tool_execution_end"
      });
      onEvent?.({
        message: {
          content: [{ text: "Done", type: "text" }],
          role: "assistant",
          stopReason: "toolUse"
        },
        type: "message_end"
      } as Parameters<NonNullable<typeof onEvent>>[0]);
      onEvent?.({ type: "turn_start" });
      onTextDelta?.("Done");
      onEvent?.({
        message: {
          content: [{ text: "Done", type: "text" }],
          role: "assistant",
          stopReason: "stop"
        },
        type: "message_end"
      } as Parameters<NonNullable<typeof onEvent>>[0]);
      onEvent?.({ messages: [], type: "agent_end" });

      return {
        content: "Done",
        finishReason: "stop"
      };
    });

    const { result } = renderHook(() =>
      useAiAgentSession({
        documentPath: "/vault/README.md",
        getDocumentContent: () => "# Draft",
        model: "gpt-5.5",
        provider: {
          apiKey: "secret",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-5.5",
          enabled: true,
          id: "openai",
          models: [],
          name: "OpenAI",
          type: "openai"
        },
        settingsLoading: false,
        translate: (key) =>
          ({
            "app.aiAgentTraceCall": "AI call",
            "app.aiAgentTraceRequestedTools": "Requested tool calls",
            "app.aiAgentProcessReadDocument": "Read current document"
          })[key] ?? key,
        workspaceFiles: []
      })
    );

    await act(async () => {
      await result.current.submit("Check this");
    });

    expect(result.current.messages[1]).toMatchObject({
      activities: [
        {
          detail: "Requested tool calls",
          id: "call:1",
          kind: "ai_call",
          label: "AI call 1",
          status: "completed"
        },
        {
          detail: "42 chars",
          id: "tool:tool-1",
          kind: "tool_call",
          label: "Read current document",
          rawLabel: "get_document",
          status: "completed"
        },
        {
          id: "assistant:1",
          kind: "assistant_message",
          label: "Done",
          status: "completed"
        },
        {
          id: "call:2",
          kind: "ai_call",
          label: "AI call 2",
          status: "completed"
        }
      ],
      role: "assistant",
      text: "Done"
    });
  });
});
