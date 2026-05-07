import { Agent, type AgentEvent } from "@mariozechner/pi-agent-core";
import type { AiProviderConfig } from "../providers/aiProviders";
import { createNativeChatStreamFn, createPiAgentModel, type InlineAiAgentComplete } from "./agentRuntime";
import { chatCompletionStream } from "./chatCompletion";
import { runReadOnlyAgentTools, type AgentWorkspaceFile } from "./agentTools";
import type { AiHeadingAnchor, AiSelectionContext } from "./inlineAi";
import type { ChatMessage } from "./chatAdapters";
import type { AiDiffResult } from "./inlineAi";
import { getProviderCapabilities } from "./providerCapabilities";
import { createDocumentAgentTools } from "./documentAgentTools";

export type DocumentAiHistoryMessage = {
  role: "assistant" | "user";
  text: string;
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
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
  workspaceFiles?: AgentWorkspaceFile[];
};

export type RunDocumentAiAgentResult = {
  content: string;
  finishReason?: string;
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
  thinkingEnabled,
  webSearchEnabled = false,
  workspaceFiles = []
}: RunDocumentAiAgentInput): Promise<RunDocumentAiAgentResult> {
  const agent = new Agent({
    initialState: {
      model: createPiAgentModel(provider, model),
      systemPrompt: buildDocumentToolCallingSystemPrompt(),
      tools: createDocumentAgentTools({
        documentContent,
        documentEndPosition,
        documentPath,
        headingAnchors,
        onPreviewResult,
        readWorkspaceFile,
        selection,
        workspaceFiles
      })
    },
    streamFn: createNativeChatStreamFn(provider, complete, thinkingEnabled)
  });
  let finalContent = "";
  let finishReason: string | undefined;

  agent.subscribe((event) => {
    onEvent?.(event);

    if (event.type === "message_update" && event.message.role === "assistant") {
      const nextText = assistantTextFromAgentMessage(event.message.content);
      if (nextText) onTextDelta?.(nextText);

      const nextThinking = assistantThinkingFromAgentMessage(event.message.content);
      if (nextThinking) onThinkingDelta?.(nextThinking);
    }

    if (event.type !== "message_end" || event.message.role !== "assistant") return;

    finalContent = assistantTextFromAgentMessage(event.message.content);
    finishReason = event.message.stopReason;
  });

  await agent.prompt(buildDocumentToolCallingPrompt({ prompt, selection, history, webSearchEnabled }));

  return {
    content: finalContent.trim(),
    finishReason
  };
}

function buildDocumentAgentSystemPrompt() {
  return [
    "You are Markra AI Agent, a local-first Markdown writing assistant.",
    "Help with the current document and nearby workspace notes using only the context that is provided in this turn.",
    "Be concise, practical, and explicit about what you know from the provided context.",
    "If the user asks for a rewrite or edit, provide the revised text first, then add a short explanation only when it helps.",
    "Do not claim to have searched the web or read files that were not included in the provided context."
  ].join("\n");
}

function buildDocumentToolCallingSystemPrompt() {
  return [
    "You are Markra AI Agent, a local-first Markdown assistant.",
    "Use the available tools in three stages: inspect, locate, then execute.",
    "Inspect the document and current context first, especially when the user asks you to insert or restructure content.",
    "When the user asks about nearby notes, call list_workspace_files first, then read_workspace_file for the exact Markdown files you need.",
    "Use locate_markdown_region or get_available_anchors before writing whenever the edit position is not trivially obvious.",
    "Use get_document_sections and locate_section when the user asks to rewrite, delete, move, or regenerate an entire section.",
    "When the request targets a whole section, prefer replace_section or delete_section instead of block-level tools.",
    "When the user asks for a document edit, prefer the write tools instead of only describing the edit.",
    "Prefer replace_region, delete_region, and insert_markdown for new work. The legacy selection-only tools remain available for compatibility.",
    "Choose the edit location intentionally: insert_markdown can use the current context or a resolved anchor. Do not ask the user to place the cursor unless no viable anchor can be resolved from the document.",
    "When the target location is ambiguous, inspect the document structure, choose the most semantically appropriate anchor or section, and then execute the edit there.",
    "When there is no active selection, do not stop at that limitation. Inspect the document structure and decide an appropriate location yourself.",
    "When preparing block-level Markdown such as headings, lists, tables, or multi-paragraph sections, pass clean Markdown to the write tool and choose an insertion/replacement location that preserves document structure.",
    "At most one write tool should be used in a single assistant turn.",
    "After a write tool succeeds, briefly tell the user what was prepared and what changed.",
    "Do not claim to have searched the web or read files that were not available through tools."
  ].join("\n");
}

function buildDocumentAgentPrompt({
  prompt,
  selection,
  toolResults,
  webSearchEnabled
}: {
  prompt: string;
  selection: AiSelectionContext | null;
  toolResults: Awaited<ReturnType<typeof runReadOnlyAgentTools>>;
  webSearchEnabled: boolean;
}) {
  const sections = [`User request:\n${prompt.trim()}`];

  const selectionSnapshot = formatSelectionSnapshot(selection);
  if (selectionSnapshot) sections.push(selectionSnapshot);

  if (webSearchEnabled) {
    sections.push(
      "Web search mode was requested. If live browsing is unavailable in this runtime, say so briefly and continue with the provided document context."
    );
  }

  sections.push(
    [
      "Read-only workspace context:",
      ...toolResults.map((result) => [`Tool: ${result.name}`, result.content].join("\n"))
    ].join("\n\n")
  );

  return sections.join("\n\n");
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
      content: message.text,
      role: message.role
    })),
    {
      content: buildDocumentAgentPrompt({ prompt, selection, toolResults, webSearchEnabled }),
      role: "user"
    }
  ];
}

function buildDocumentToolCallingPrompt({
  history,
  prompt,
  selection,
  webSearchEnabled
}: {
  history: DocumentAiHistoryMessage[];
  prompt: string;
  selection: AiSelectionContext | null;
  webSearchEnabled: boolean;
}) {
  return [
    history.length
      ? [
          "Conversation so far:",
          ...history.map((message) => `${message.role.toUpperCase()}: ${message.text}`)
        ].join("\n\n")
      : null,
    `User request:\n${prompt.trim()}`,
    formatSelectionSnapshot(selection) ?? "There is no active cursor or selection snapshot. Use tools if you need to inspect the current block.",
    webSearchEnabled
      ? "Web search mode was requested. If live browsing is unavailable, say so briefly and continue with local document tools."
      : null
  ]
    .filter(Boolean)
    .join("\n\n");
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
