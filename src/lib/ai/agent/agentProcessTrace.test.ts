import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { applyAgentEventToProcesses, createInitialAgentProcesses } from "./agentProcessTrace";
import type { I18nKey } from "../../i18n";

const translate = (key: I18nKey) => key;

describe("agentProcessTrace", () => {
  it("labels workspace file reads with the file path and length", () => {
    const initialProcesses = createInitialAgentProcesses(translate);
    const nextProcesses = applyAgentEventToProcesses(
      initialProcesses,
      {
        isError: false,
        result: {
          details: {
            length: 128,
            relativePath: "notes/context.md"
          }
        },
        toolCallId: "call_read_workspace_file",
        toolName: "read_workspace_file",
        type: "tool_execution_end"
      } as AgentEvent,
      translate
    );

    expect(nextProcesses).toContainEqual(expect.objectContaining({
      detail: "notes/context.md · 128 chars",
      id: "tool:call_read_workspace_file",
      label: "app.aiAgentProcessReadWorkspaceFile",
      rawLabel: "read_workspace_file",
      status: "completed"
    }));
  });

  it("shows the located section title and reason in the process detail", () => {
    const initialProcesses = createInitialAgentProcesses(translate);
    const nextProcesses = applyAgentEventToProcesses(
      initialProcesses,
      {
        isError: false,
        result: {
          details: {
            anchorId: "section:2",
            candidates: [
              {
                anchorId: "section:2",
                description: "Section 11. Follow-ups",
                reason: 'Exact heading match for "11. Follow-ups".',
                score: 20
              }
            ],
            reason: 'Exact heading match for "11. Follow-ups".'
          }
        },
        toolCallId: "call_locate_section",
        toolName: "locate_section",
        type: "tool_execution_end"
      } as AgentEvent,
      translate
    );

    expect(nextProcesses).toContainEqual(expect.objectContaining({
      detail: expect.stringContaining("Section 11. Follow-ups"),
      id: "tool:call_locate_section",
      label: "app.aiAgentProcessLocateSection",
      status: "completed"
    }));
    expect(nextProcesses).toContainEqual(expect.objectContaining({
      detail: expect.stringContaining("Exact heading match")
    }));
  });
});
