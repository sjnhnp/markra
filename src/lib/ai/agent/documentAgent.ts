import { Agent, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core";
import type { AiProviderConfig } from "../providers/aiProviders";
import { createNativeChatStreamFn, createPiAgentModel, type InlineAiAgentComplete } from "./agentRuntime";
import { chatCompletionStream } from "./chatCompletion";
import { runReadOnlyAgentTools, type AgentWorkspaceFile } from "./agentTools";
import type { AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "./inlineAi";
import type { ChatMessage } from "./chatAdapters";
import type { AiDiffResult } from "./inlineAi";
import { getProviderCapabilities } from "./providerCapabilities";
import { createDocumentAgentTools } from "./documentAgentTools";

export type DocumentAiHistoryMessage = {
  preview?: DocumentAiHistoryPreview;
  role: "assistant" | "user";
  text: string;
};

export type DocumentAiHistoryPreview = {
  from?: number;
  original: string;
  replacement: string;
  to?: number;
  type: "insert" | "replace";
};

export type RunDocumentAiAgentInput = {
  complete?: InlineAiAgentComplete;
  documentContent: string;
  documentEndPosition?: number;
  documentPath: string | null;
  history?: DocumentAiHistoryMessage[];
  headingAnchors?: AiHeadingAnchor[];
  model: string;
  onEvent?: (event: AgentEvent) => unknown;
  onPreviewResult?: (result: AiDiffResult) => unknown;
  onTextDelta?: (content: string) => unknown;
  onThinkingDelta?: (thinking: string) => unknown;
  prompt: string;
  provider: AiProviderConfig;
  readWorkspaceFile?: (path: string) => Promise<string>;
  selection?: AiSelectionContext | null;
  tableAnchors?: AiDocumentAnchor[];
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
  workspaceFiles?: AgentWorkspaceFile[];
};

export type RunDocumentAiAgentResult = {
  content: string;
  finishReason?: string;
  preparedPreview?: boolean;
};

export async function runDocumentAiAgent({
  complete = chatCompletionStream,
  documentContent,
  documentEndPosition = 0,
  documentPath,
  history = [],
  headingAnchors = [],
  model,
  onEvent,
  onPreviewResult,
  onTextDelta,
  onThinkingDelta,
  prompt,
  provider,
  readWorkspaceFile,
  selection = null,
  tableAnchors,
  thinkingEnabled,
  webSearchEnabled = false,
  workspaceFiles = []
}: RunDocumentAiAgentInput): Promise<RunDocumentAiAgentResult> {
  const capabilities = getProviderCapabilities(provider.id, provider.type);
  if (capabilities.toolCalling && supportsDocumentToolCalling(provider.type)) {
    return runDocumentToolCallingAgent({
      complete,
      documentContent,
      documentEndPosition,
      documentPath,
      headingAnchors,
      history,
      model,
      onEvent,
      onPreviewResult,
      onTextDelta,
      onThinkingDelta,
      prompt,
      provider,
      readWorkspaceFile,
      selection,
      tableAnchors,
      thinkingEnabled,
      webSearchEnabled,
      workspaceFiles
    });
  }

  return runDocumentChatOnlyAgent({
    complete,
    documentContent,
    documentPath,
    history,
    model,
    onTextDelta,
    onThinkingDelta,
    prompt,
    provider,
    selection,
    thinkingEnabled,
    webSearchEnabled,
    workspaceFiles
  });
}

async function runDocumentChatOnlyAgent({
  complete = chatCompletionStream,
  documentContent,
  documentPath,
  history = [],
  model,
  onTextDelta,
  onThinkingDelta,
  prompt,
  provider,
  selection = null,
  thinkingEnabled,
  webSearchEnabled = false,
  workspaceFiles = []
}: RunDocumentAiAgentInput): Promise<RunDocumentAiAgentResult> {
  const toolResults = await runReadOnlyAgentTools({
    documentContent,
    documentPath,
    workspaceFiles
  });
  const messages = buildDocumentAgentMessages({ history, prompt, selection, toolResults, webSearchEnabled });
  let streamedContent = "";
  let streamedThinking = "";
  const response = await complete(provider, model, messages, {
    onDelta: (delta) => {
      streamedContent += delta;
      onTextDelta?.(streamedContent);
    },
    onThinkingDelta: (delta) => {
      streamedThinking += delta;
      onThinkingDelta?.(streamedThinking);
    },
    thinkingEnabled
  });

  return {
    content: (response.content || streamedContent).trim(),
    finishReason: response.finishReason
  };
}

function supportsDocumentToolCalling(
  providerType: AiProviderConfig["type"]
) {
  return [
    "anthropic",
    "azure-openai",
    "deepseek",
    "groq",
    "mistral",
    "openai",
    "openai-compatible",
    "openrouter",
    "together",
    "xai"
  ].includes(providerType);
}

async function runDocumentToolCallingAgent({
  complete = chatCompletionStream,
  documentContent,
  documentEndPosition = 0,
  documentPath,
  history = [],
  headingAnchors = [],
  model,
  onEvent,
  onPreviewResult,
  onTextDelta,
  onThinkingDelta,
  prompt,
  provider,
  readWorkspaceFile,
  selection = null,
  tableAnchors,
  thinkingEnabled,
  webSearchEnabled = false,
  workspaceFiles = []
}: RunDocumentAiAgentInput): Promise<RunDocumentAiAgentResult> {
  let preparedPreview = false;
  const piAgentModel = createPiAgentModel(provider, model);
  const agent = new Agent({
    beforeToolCall: async ({ assistantMessage, toolCall }) => {
      if (!isDocumentWriteToolName(toolCall.name)) return undefined;

      const writeToolCallCount = assistantMessage.content.filter(
        (content) => content.type === "toolCall" && isDocumentWriteToolName(content.name)
      ).length;
      if (writeToolCallCount <= 1) return undefined;

      return {
        block: true,
        reason: "Only one editor write tool can run in a single assistant turn. Choose exactly one edit operation, then call that write tool again."
      };
    },
    initialState: {
      messages: buildDocumentToolCallingHistoryMessages({ history, model, provider }),
      model: piAgentModel,
      systemPrompt: buildDocumentToolCallingSystemPrompt(),
      tools: createDocumentAgentTools({
        documentContent,
        documentEndPosition,
        documentPath,
        headingAnchors,
        onPreviewResult: (result) => {
          preparedPreview = true;
          onPreviewResult?.(result);
        },
        readWorkspaceFile,
        selection,
        tableAnchors,
        workspaceFiles
      })
    },
    streamFn: createNativeChatStreamFn(provider, complete, thinkingEnabled)
  });
  let finalContent = "";
  let finishReason: string | undefined;
  let latestAssistantText = "";

  agent.subscribe((event) => {
    onEvent?.(event);

    if (event.type === "message_update" && event.message.role === "assistant") {
      const nextText = assistantTextFromAgentMessage(event.message.content);
      if (nextText) {
        latestAssistantText = nextText;
        onTextDelta?.(nextText);
      }

      const nextThinking = assistantThinkingFromAgentMessage(event.message.content);
      if (nextThinking) onThinkingDelta?.(nextThinking);
    }

    if (event.type !== "message_end" || event.message.role !== "assistant") return;

    finalContent = assistantTextFromAgentMessage(event.message.content);
    if (finalContent.trim()) latestAssistantText = finalContent;
    finishReason = event.message.stopReason;
  });

  await agent.prompt(buildDocumentToolCallingTurnMessages({ prompt, selection, webSearchEnabled }));

  return {
    content: preparedPreview ? "" : (finalContent || latestAssistantText).trim(),
    finishReason,
    preparedPreview
  };
}

function buildDocumentAgentSystemPrompt() {
  return [
    "You are Markra AI Agent, a local-first Markdown writing assistant.",
    "Help with the current document and nearby workspace notes using only the context that is provided in this turn.",
    "Be concise, practical, and explicit about what you know from the provided context.",
    "Reply in the user's language unless the user asks for another language.",
    "If the user asks for a rewrite or edit, provide the revised text first, then add a short explanation only when it helps.",
    "Do not claim to have searched the web or read files that were not included in the provided context."
  ].join("\n");
}

function buildDocumentToolCallingSystemPrompt() {
  return [
    "You are Markra AI Agent, a local-first Markdown assistant.",
    "Use the available tools in three stages: inspect, locate, then execute.",
    "Inspect the document and current context first, especially when the user asks you to insert or restructure content.",
    "Reply in the user's language unless the user asks for another language.",
    "When the user asks about nearby notes, call list_workspace_files first, then read_workspace_file for the exact Markdown files you need.",
    "Use locate_markdown_region or get_available_anchors before writing whenever the edit position is not trivially obvious.",
    "When the user asks to rewrite, compress, clean up, or keep only part of the whole document, use replace_document.",
    "Use get_document_sections and locate_section when the user asks to rewrite, delete, move, or regenerate an entire section.",
    "When the request targets a whole section, prefer replace_section or delete_section instead of block-level tools.",
    "When the request targets a Markdown table, locate the table anchor and prefer replace_table instead of replacing a heading, cell, or nearby block.",
    "When the user asks for a document edit, prefer the write tools instead of only describing the edit.",
    "Prefer replace_document for whole-document edits; prefer replace_table for table edits; prefer replace_region, delete_region, and insert_markdown for focused block edits.",
    "Choose the edit location intentionally: insert_markdown can use the current context or a resolved anchor. Do not ask the user to place the cursor unless no viable anchor can be resolved from the document.",
    "When the target location is ambiguous, inspect the document structure, choose the most semantically appropriate anchor or section, and then execute the edit there.",
    "When there is no active selection, do not stop at that limitation. Inspect the document structure and decide an appropriate location yourself.",
    "When preparing block-level Markdown such as headings, lists, tables, or multi-paragraph sections, pass clean Markdown to the write tool and choose an insertion/replacement location that preserves document structure.",
    "At most one write tool should be used in a single assistant turn.",
    "After a write tool succeeds, briefly tell the user what was prepared and what changed.",
    "Do not claim to have searched the web or read files that were not available through tools."
  ].join("\n");
}

function isDocumentWriteToolName(toolName: string) {
  return [
    "delete_region",
    "delete_section",
    "insert_markdown",
    "replace_document",
    "replace_region",
    "replace_table",
    "replace_section"
  ].includes(toolName);
}

function buildDocumentAgentMessages({
  history,
  prompt,
  selection,
  toolResults,
  webSearchEnabled
}: {
  history: DocumentAiHistoryMessage[];
  prompt: string;
  selection: AiSelectionContext | null;
  toolResults: Awaited<ReturnType<typeof runReadOnlyAgentTools>>;
  webSearchEnabled: boolean;
}): ChatMessage[] {
  return [
    {
      content: buildDocumentAgentSystemPrompt(),
      role: "system"
    },
    ...history.map((message) => ({
      content: formatHistoryMessageText(message),
      role: message.role
    })),
    {
      content: buildDocumentRuntimeContext({
        selection,
        toolCallingEnabled: false,
        webSearchEnabled
      }),
      role: "user"
    },
    {
      content: buildReadOnlyWorkspaceContext(toolResults),
      role: "user"
    },
    {
      content: buildCurrentUserRequest(prompt),
      role: "user"
    }
  ];
}

function buildDocumentToolCallingTurnMessages({
  prompt,
  selection,
  webSearchEnabled
}: {
  prompt: string;
  selection: AiSelectionContext | null;
  webSearchEnabled: boolean;
}): AgentMessage[] {
  return [
    createAgentUserMessage(
      buildDocumentRuntimeContext({
        selection,
        toolCallingEnabled: true,
        webSearchEnabled
      })
    ),
    createAgentUserMessage(buildCurrentUserRequest(prompt))
  ];
}

function buildCurrentUserRequest(prompt: string) {
  return `User request:\n${prompt.trim()}`;
}

function buildDocumentRuntimeContext({
  selection,
  toolCallingEnabled,
  webSearchEnabled
}: {
  selection: AiSelectionContext | null;
  toolCallingEnabled: boolean;
  webSearchEnabled: boolean;
}) {
  const sections = ["Document runtime context:"];

  sections.push(formatSelectionSnapshot(selection) ?? "There is no active cursor or selection snapshot.");

  sections.push(
    toolCallingEnabled
      ? "Document tools are available. Use them to inspect authoritative document content before editing when the location or scope is ambiguous."
      : "No document write tools are available in this provider path. Use the read-only workspace context and answer with text."
  );

  if (webSearchEnabled) {
    sections.push(
      toolCallingEnabled
        ? "Web search mode was requested. If live browsing is unavailable, say so briefly and continue with local document tools."
        : "Web search mode was requested. If live browsing is unavailable in this runtime, say so briefly and continue with the provided document context."
    );
  }

  return sections.join("\n\n");
}

function buildReadOnlyWorkspaceContext(toolResults: Awaited<ReturnType<typeof runReadOnlyAgentTools>>) {
  return [
    "Read-only workspace context:",
    ...toolResults.map((result) => [`Tool: ${result.name}`, result.content].join("\n"))
  ].join("\n\n");
}

function buildDocumentToolCallingHistoryMessages({
  history,
  model,
  provider
}: {
  history: DocumentAiHistoryMessage[];
  model: string;
  provider: AiProviderConfig;
}): AgentMessage[] {
  return history
    .map((message): AgentMessage | null => {
      const content = formatHistoryMessageText(message);
      if (!content.trim()) return null;

      if (message.role === "user") {
        return createAgentUserMessage(content);
      }

      return {
        api: "markra-native-chat",
        content: [{ text: content, type: "text" }],
        model,
        provider: provider.id,
        role: "assistant",
        stopReason: "stop",
        timestamp: Date.now(),
        usage: emptyAgentUsage()
      };
    })
    .filter((message): message is AgentMessage => message !== null);
}

function createAgentUserMessage(content: string): AgentMessage {
  return {
    content,
    role: "user",
    timestamp: Date.now()
  };
}

function formatHistoryMessageText(message: DocumentAiHistoryMessage) {
  const parts = [message.text.trim()];
  const previewSummary = message.preview ? formatHistoryPreviewSummary(message.preview) : null;
  if (previewSummary) parts.push(previewSummary);

  return parts.filter((part) => part.length > 0).join("\n\n");
}

function formatHistoryPreviewSummary(preview: DocumentAiHistoryPreview) {
  const range = preview.from === undefined || preview.to === undefined ? "unknown range" : `${preview.from}-${preview.to}`;

  return [
    "Prepared editor preview:",
    `Type: ${preview.type}`,
    `Range: ${range}`,
    `Original excerpt: ${formatHistoryPreviewExcerpt(preview.original)}`,
    `Replacement excerpt: ${formatHistoryPreviewExcerpt(preview.replacement)}`
  ].join("\n");
}

function formatHistoryPreviewExcerpt(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "(empty)";

  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

function emptyAgentUsage() {
  return {
    cacheRead: 0,
    cacheWrite: 0,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0,
      total: 0
    },
    input: 0,
    output: 0,
    totalTokens: 0
  };
}

function formatSelectionSnapshot(selection: AiSelectionContext | null) {
  if (!selection) return null;

  if (!selection.text.trim()) {
    return [
      "Current cursor snapshot:",
      `Cursor: ${selection.cursor ?? selection.from}`,
      `Range: ${selection.from}-${selection.to}`
    ].join("\n");
  }

  return [
    "Current selection snapshot:",
    `Range: ${selection.from}-${selection.to}`,
    `Cursor: ${selection.cursor ?? selection.to}`,
    `Source: ${selection.source ?? "selection"}`,
    selection.text
  ].join("\n");
}

function assistantTextFromAgentMessage(content: AgentAssistantContent[]) {
  return content
    .map((part) => ("text" in part && part.type === "text" ? part.text : ""))
    .join("");
}

function assistantThinkingFromAgentMessage(content: AgentAssistantContent[]) {
  return content
    .map((part) => ("thinking" in part && part.type === "thinking" ? part.thinking : ""))
    .join("");
}

type AgentAssistantContent =
  | {
      text: string;
      type: "text";
    }
  | {
      thinking: string;
      type: "thinking";
    }
  | {
      arguments: Record<string, unknown>;
      id: string;
      name: string;
      type: "toolCall";
    };
