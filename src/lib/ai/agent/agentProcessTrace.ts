import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { I18nKey } from "../../i18n";

export type AiAgentProcessKind = "ai_call" | "assistant_message" | "tool_call";
export type AiAgentProcessStatus = "cancelled" | "completed" | "error" | "running";

export type AiAgentProcessItem = {
  detail?: string;
  id: string;
  kind: AiAgentProcessKind;
  label: string;
  rawLabel?: string;
  status: AiAgentProcessStatus;
  turn: number;
};

type Translate = (key: I18nKey) => string;

export function createInitialAgentProcesses(translate: Translate) {
  return [
    {
      id: "call:1",
      kind: "ai_call" as const,
      label: `${translate("app.aiAgentTraceCall")} 1`,
      status: "running" as const,
      turn: 1
    }
  ] satisfies AiAgentProcessItem[];
}

export function applyAgentEventToProcesses(
  currentProcesses: AiAgentProcessItem[],
  event: AgentEvent,
  translate: Translate
): AiAgentProcessItem[] {
  if (event.type === "turn_start") {
    const nextTurn = nextTurnNumber(currentProcesses);
    if (nextTurn === 2 && hasOnlyInitialAiCall(currentProcesses)) return currentProcesses;

    return [
      ...currentProcesses,
      {
        id: `call:${nextTurn}`,
        kind: "ai_call",
        label: `${translate("app.aiAgentTraceCall")} ${nextTurn}`,
        status: "running",
        turn: nextTurn
      }
    ];
  }

  if (event.type === "tool_execution_start") {
    const turn = currentTurnNumber(currentProcesses);
    return upsertProcess(currentProcesses, {
      detail: formatToolArgs(event.args),
      id: `tool:${event.toolCallId}`,
      kind: "tool_call",
      label: toolLabelForName(event.toolName, translate),
      rawLabel: event.toolName,
      status: "running",
      turn
    });
  }

  if (event.type === "tool_execution_end") {
    const turn = existingTurnForTool(currentProcesses, event.toolCallId) ?? currentTurnNumber(currentProcesses);
    return upsertProcess(currentProcesses, {
      detail: formatToolResult(event),
      id: `tool:${event.toolCallId}`,
      kind: "tool_call",
      label: toolLabelForName(event.toolName, translate),
      rawLabel: event.toolName,
      status: event.isError ? "error" : "completed",
      turn
    });
  }

  if (event.type === "message_end" && event.message.role === "assistant") {
    const nextProcesses = completeLatestAiCall(currentProcesses, event.message.stopReason, translate);
    const assistantMessage = assistantTextFromMessageContent(event.message.content);
    if (event.message.stopReason !== "toolUse" || !assistantMessage) return nextProcesses;

    return upsertProcess(nextProcesses, {
      id: `assistant:${currentTurnNumber(nextProcesses)}`,
      kind: "assistant_message",
      label: assistantMessage,
      status: "completed",
      turn: currentTurnNumber(nextProcesses)
    });
  }

  if (event.type === "agent_end") {
    return markRunningProcesses(currentProcesses, "completed");
  }

  return currentProcesses;
}

export function finalizeAgentProcesses(
  currentProcesses: AiAgentProcessItem[],
  translate: Translate,
  hasAssistantContent: boolean
) {
  if (!currentProcesses.length && hasAssistantContent) {
    return [
      {
        id: "call:1",
        kind: "ai_call" as const,
        label: `${translate("app.aiAgentTraceCall")} 1`,
        status: "completed" as const,
        turn: 1
      }
    ];
  }

  return markRunningProcesses(currentProcesses, "completed");
}

export function failAgentProcesses(currentProcesses: AiAgentProcessItem[]) {
  return markRunningProcesses(currentProcesses, "error");
}

export function cancelAgentProcesses(currentProcesses: AiAgentProcessItem[]) {
  return markRunningProcesses(currentProcesses, "cancelled");
}

function nextTurnNumber(currentProcesses: AiAgentProcessItem[]) {
  return currentProcesses.filter((process) => process.kind === "ai_call").length + 1;
}

function hasOnlyInitialAiCall(currentProcesses: AiAgentProcessItem[]) {
  return currentProcesses.length === 1 && currentProcesses[0]?.id === "call:1" && currentProcesses[0]?.status === "running";
}

function currentTurnNumber(currentProcesses: AiAgentProcessItem[]) {
  const aiCalls = currentProcesses.filter((process) => process.kind === "ai_call");
  return aiCalls.at(-1)?.turn ?? 1;
}

function existingTurnForTool(currentProcesses: AiAgentProcessItem[], toolCallId: string) {
  return currentProcesses.find((process) => process.id === `tool:${toolCallId}`)?.turn;
}

function upsertProcess(currentProcesses: AiAgentProcessItem[], nextProcess: AiAgentProcessItem) {
  const processIndex = currentProcesses.findIndex((process) => process.id === nextProcess.id);
  if (processIndex < 0) return [...currentProcesses, nextProcess];

  return currentProcesses.map((process, index) =>
    index === processIndex
      ? {
          ...process,
          ...nextProcess,
          detail: nextProcess.detail ?? process.detail,
          rawLabel: nextProcess.rawLabel ?? process.rawLabel
        }
      : process
  );
}

function completeLatestAiCall(currentProcesses: AiAgentProcessItem[], stopReason: string | undefined, translate: Translate) {
  const aiCalls = currentProcesses.filter((process) => process.kind === "ai_call");
  const latestAiCall = [...aiCalls].reverse().find((process) => process.status === "running") ?? aiCalls.at(-1);
  if (!latestAiCall) return currentProcesses;

  return currentProcesses.map((process) =>
    process.id === latestAiCall.id
      ? {
          ...process,
          detail: stopReason === "toolUse" ? translateAiCallDetail(stopReason, process.detail, translate) : process.detail,
          status: "completed" as const
        }
      : process
  );
}

function markRunningProcesses(currentProcesses: AiAgentProcessItem[], status: Exclude<AiAgentProcessStatus, "running">) {
  return currentProcesses.map((process) =>
    process.status === "running"
      ? {
          ...process,
          status
        }
      : process
  );
}

function formatToolArgs(args: unknown) {
  if (!args || typeof args !== "object") return undefined;

  const entries = Object.entries(args as Record<string, unknown>).filter(([, value]) => typeof value === "string");
  if (!entries.length) return undefined;

  const [key, value] = entries[0]!;
  return summarizeValue(`${key}: ${String(value)}`);
}

function formatToolResult(event: Extract<AgentEvent, { type: "tool_execution_end" }>) {
  if (event.isError) return undefined;
  if (event.toolName === "list_workspace_files" && typeof event.result?.details?.count === "number") {
    return `${event.result.details.count} files`;
  }
  if (event.toolName === "get_document" && typeof event.result?.details?.length === "number") {
    return `${event.result.details.length} chars`;
  }
  if (event.toolName === "get_available_anchors" && typeof event.result?.details?.count === "number") {
    return `${event.result.details.count} anchors`;
  }
  if (event.toolName === "get_document_sections" && typeof event.result?.details?.count === "number") {
    return `${event.result.details.count} sections`;
  }
  if (event.toolName === "get_selection" && typeof event.result?.details?.text === "string") {
    return `${event.result.details.text.length} chars`;
  }
  if (event.toolName === "get_document_outline" && typeof event.result?.details?.count === "number") {
    return `${event.result.details.count} headings`;
  }
  if (event.toolName === "locate_markdown_region" && typeof event.result?.details?.anchorId === "string") {
    return formatLocatedAnchorDetail(event.result.details);
  }
  if (event.toolName === "locate_section" && typeof event.result?.details?.anchorId === "string") {
    return formatLocatedAnchorDetail(event.result.details);
  }
  if (event.toolName === "replace_region" && typeof event.result?.details?.original === "string") {
    return `${event.result.details.original.length} chars`;
  }
  if (event.toolName === "replace_section" && typeof event.result?.details?.original === "string") {
    return `${event.result.details.original.length} chars`;
  }
  if (event.toolName === "delete_region" && typeof event.result?.details?.original === "string") {
    return `${event.result.details.original.length} chars`;
  }
  if (event.toolName === "delete_section" && typeof event.result?.details?.original === "string") {
    return `${event.result.details.original.length} chars`;
  }
  if (event.toolName === "delete_selection" && typeof event.result?.details?.original === "string") {
    return `${event.result.details.original.length} chars`;
  }

  return undefined;
}

function assistantTextFromMessageContent(content: unknown) {
  if (!Array.isArray(content)) return "";

  return content
    .map((part) =>
      typeof part === "object" && part !== null && "type" in part && "text" in part && part.type === "text"
        ? String(part.text)
        : ""
    )
    .join("")
    .trim();
}

function toolLabelForName(toolName: string, translate: Translate) {
  if (toolName === "get_document") return translate("app.aiAgentProcessReadDocument");
  if (toolName === "get_available_anchors") return translate("app.aiAgentProcessReadAnchors");
  if (toolName === "get_document_outline") return translate("app.aiAgentProcessReadDocumentOutline");
  if (toolName === "get_document_sections") return translate("app.aiAgentProcessReadSections");
  if (toolName === "locate_markdown_region") return translate("app.aiAgentProcessLocateRegion");
  if (toolName === "locate_section") return translate("app.aiAgentProcessLocateSection");
  if (toolName === "get_selection") return translate("app.aiAgentProcessReadSelection");
  if (toolName === "list_workspace_files") return translate("app.aiAgentProcessListWorkspaceFiles");
  if (toolName === "replace_region") return translate("app.aiAgentProcessReplaceRegion");
  if (toolName === "replace_section") return translate("app.aiAgentProcessReplaceSection");
  if (toolName === "replace_selection") return translate("app.aiAgentProcessReplaceSelection");
  if (toolName === "insert_after_selection") return translate("app.aiAgentProcessInsertAfterSelection");
  if (toolName === "insert_markdown") return translate("app.aiAgentProcessInsertMarkdown");
  if (toolName === "delete_region") return translate("app.aiAgentProcessDeleteRegion");
  if (toolName === "delete_section") return translate("app.aiAgentProcessDeleteSection");
  if (toolName === "delete_selection") return translate("app.aiAgentProcessDeleteSelection");

  return translate("app.aiAgentProcessRunTool");
}

function formatLocatedAnchorDetail(details: unknown) {
  if (!details || typeof details !== "object") return undefined;

  const locatedDetails = details as {
    anchorId?: unknown;
    candidates?: unknown;
    reason?: unknown;
  };
  if (typeof locatedDetails.anchorId !== "string") return undefined;

  const candidates = Array.isArray(locatedDetails.candidates) ? locatedDetails.candidates : [];
  const selectedCandidate = candidates.find((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;

    return (candidate as { anchorId?: unknown }).anchorId === locatedDetails.anchorId;
  });
  const selectedDescription =
    selectedCandidate && typeof selectedCandidate === "object"
      ? (selectedCandidate as { description?: unknown }).description
      : undefined;
  const description = typeof selectedDescription === "string" ? selectedDescription : locatedDetails.anchorId;
  const reason = typeof locatedDetails.reason === "string" ? locatedDetails.reason : undefined;

  return summarizeValue(reason ? `${description} · ${reason}` : description);
}

function translateAiCallDetail(stopReason: string, currentDetail: string | undefined, translate: Translate) {
  if (currentDetail && currentDetail !== "toolUse") return currentDetail;
  if (stopReason === "toolUse") return translate("app.aiAgentTraceRequestedTools");

  return currentDetail;
}

function summarizeValue(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 56) return normalized;

  return `${normalized.slice(0, 53)}...`;
}
