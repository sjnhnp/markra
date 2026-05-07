import { cancelAgentProcesses, type AiAgentProcessItem, type AiAgentProcessKind, type AiAgentProcessStatus } from "./agentProcessTrace";
import { clampNumber, isRecord } from "../../utils";

export type AiAgentSessionMessage = {
  activities?: AiAgentProcessItem[];
  id: number;
  isError?: boolean;
  role: "assistant" | "user";
  text: string;
  thinking?: string;
};

export type StoredAiAgentSessionState = {
  draft: string;
  messages: AiAgentSessionMessage[];
  panelOpen: boolean;
  panelWidth: number | null;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
};

export type StoredAiAgentSessionSummary = {
  archivedAt: number | null;
  createdAt: number;
  id: string;
  messageCount: number;
  title: string | null;
  titleSource: "ai" | "fallback" | "manual" | null;
  updatedAt: number;
  workspaceKey: string;
};

const storedPanelWidthMin = 320;
const storedPanelWidthMax = 760;
const untitledWorkspaceKey = "__untitled__";

export function createDefaultAiAgentSessionState(): StoredAiAgentSessionState {
  return {
    draft: "",
    messages: [],
    panelOpen: false,
    panelWidth: null,
    thinkingEnabled: false,
    webSearchEnabled: false
  };
}

export function normalizeStoredAiAgentSessionState(value: unknown): StoredAiAgentSessionState {
  if (!isRecord(value)) return createDefaultAiAgentSessionState();

  return {
    draft: typeof value.draft === "string" ? value.draft : "",
    messages: Array.isArray(value.messages)
      ? value.messages.map(normalizeSessionMessage).filter((message): message is AiAgentSessionMessage => message !== null)
      : [],
    panelOpen: value.panelOpen === true,
    panelWidth: clampNumber(value.panelWidth, storedPanelWidthMin, storedPanelWidthMax),
    thinkingEnabled: value.thinkingEnabled === true,
    webSearchEnabled: value.webSearchEnabled === true
  };
}

export function createAiAgentSessionTitle(session: StoredAiAgentSessionState) {
  const titleSource =
    session.messages.find((message) => message.role === "user" && message.text.trim())?.text ??
    session.messages.find((message) => message.role === "assistant" && message.text.trim())?.text ??
    session.draft;

  return normalizeAiAgentSessionTitle(titleSource);
}

export function normalizeAiAgentSessionTitle(value: unknown) {
  if (typeof value !== "string") return null;

  const singleLineTitle = value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!singleLineTitle) return null;

  const normalizedTitle = singleLineTitle
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalizedTitle.length > 0 ? normalizedTitle.slice(0, 72) : null;
}

export function normalizeAiAgentWorkspaceKey(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : untitledWorkspaceKey;
}

export function normalizeStoredAiAgentSessionSummary(value: unknown): StoredAiAgentSessionSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return null;
  if (typeof value.createdAt !== "number" || Number.isNaN(value.createdAt)) return null;
  if (typeof value.updatedAt !== "number" || Number.isNaN(value.updatedAt)) return null;

  return {
    archivedAt: typeof value.archivedAt === "number" && !Number.isNaN(value.archivedAt) ? value.archivedAt : null,
    createdAt: value.createdAt,
    id: value.id,
    messageCount: typeof value.messageCount === "number" && value.messageCount >= 0 ? Math.floor(value.messageCount) : 0,
    title: normalizeAiAgentSessionTitle(value.title),
    titleSource:
      value.titleSource === "ai" || value.titleSource === "fallback" || value.titleSource === "manual"
        ? value.titleSource
        : normalizeAiAgentSessionTitle(value.title)
          ? "fallback"
          : null,
    updatedAt: value.updatedAt,
    workspaceKey: normalizeAiAgentWorkspaceKey(value.workspaceKey)
  };
}

export function normalizeStoredAiAgentSessionSummaries(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeStoredAiAgentSessionSummary)
    .filter((summary): summary is StoredAiAgentSessionSummary => summary !== null)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function normalizeSessionMessage(value: unknown): AiAgentSessionMessage | null {
  if (!isRecord(value) || typeof value.id !== "number") return null;
  if (value.role !== "assistant" && value.role !== "user") return null;
  if (typeof value.text !== "string") return null;

  const activities = Array.isArray(value.activities)
    ? value.activities.map(normalizeProcessItem).filter((item): item is AiAgentProcessItem => item !== null)
    : undefined;

  return {
    activities: activities && activities.length > 0 ? cancelAgentProcesses(activities) : undefined,
    id: value.id,
    isError: value.isError === true,
    role: value.role,
    text: value.text,
    thinking: typeof value.thinking === "string" ? value.thinking : undefined
  };
}

function normalizeProcessItem(value: unknown): AiAgentProcessItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.label !== "string" || typeof value.turn !== "number") return null;
  if (!isProcessKind(value.kind) || !isProcessStatus(value.status)) return null;

  return {
    detail: typeof value.detail === "string" ? value.detail : undefined,
    id: value.id,
    kind: value.kind,
    label: value.label,
    rawLabel: typeof value.rawLabel === "string" ? value.rawLabel : undefined,
    status: value.status,
    turn: value.turn
  };
}

function isProcessKind(value: unknown): value is AiAgentProcessKind {
  return value === "ai_call" || value === "assistant_message" || value === "tool_call";
}

function isProcessStatus(value: unknown): value is AiAgentProcessStatus {
  return value === "cancelled" || value === "completed" || value === "error" || value === "running";
}
