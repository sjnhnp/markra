import { Agent, type AgentEvent, type AgentMessage } from "@mariozechner/pi-agent-core";
import type { AiProviderConfig } from "../providers/aiProviders";
import { createNativeChatStreamFn, createPiAgentModel, type InlineAiAgentComplete } from "./agentRuntime";
import { chatCompletionStream } from "./chatCompletion";
import { runReadOnlyAgentTools, type AgentWorkspaceFile } from "./agentTools";
import type { AiDiffTarget, AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "./inlineAi";
import type { ChatImageAttachment, ChatMessage } from "./chatAdapters";
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
  target?: AiDiffTarget;
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
  readDocumentImage?: (src: string) => Promise<DocumentAiImage | null>;
  readWorkspaceFile?: (path: string) => Promise<string>;
  sectionAnchors?: AiDocumentAnchor[];
  selection?: AiSelectionContext | null;
  tableAnchors?: AiDocumentAnchor[];
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
  workspaceFiles?: AgentWorkspaceFile[];
};

export type DocumentAiImage = ChatImageAttachment & {
  alt?: string;
  path?: string;
  src: string;
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
  readDocumentImage,
  readWorkspaceFile,
  sectionAnchors,
  selection = null,
  tableAnchors,
  thinkingEnabled,
  webSearchEnabled = false,
  workspaceFiles = []
}: RunDocumentAiAgentInput): Promise<RunDocumentAiAgentResult> {
  const documentImages = await readPromptedDocumentImages({
    documentContent,
    model,
    prompt,
    provider,
    readDocumentImage
  });
  const capabilities = getProviderCapabilities(provider.id, provider.type);
  if (capabilities.toolCalling && supportsDocumentToolCalling(provider.type)) {
    return runDocumentToolCallingAgent({
      complete,
      documentContent,
      documentEndPosition,
      documentPath,
      documentImages,
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
      sectionAnchors,
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
    documentImages,
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

type RunDocumentAiAgentRuntimeInput = RunDocumentAiAgentInput & {
  documentImages?: ChatImageAttachment[];
};

async function runDocumentChatOnlyAgent({
  complete = chatCompletionStream,
  documentContent,
  documentPath,
  documentImages = [],
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
}: RunDocumentAiAgentRuntimeInput): Promise<RunDocumentAiAgentResult> {
  const toolResults = await runReadOnlyAgentTools({
    documentContent,
    documentPath,
    workspaceFiles
  });
  const messages = buildDocumentAgentMessages({ documentImages, history, prompt, selection, toolResults, webSearchEnabled });
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
  documentImages = [],
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
  sectionAnchors,
  selection = null,
  tableAnchors,
  thinkingEnabled,
  webSearchEnabled = false,
  workspaceFiles = []
}: RunDocumentAiAgentRuntimeInput): Promise<RunDocumentAiAgentResult> {
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
        sectionAnchors,
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

  await agent.prompt(buildDocumentToolCallingTurnMessages({ documentImages, prompt, selection, webSearchEnabled }));

  return {
    content: preparedPreview ? "" : (finalContent || latestAssistantText).trim(),
    finishReason,
    preparedPreview
  };
}

function buildDocumentAgentSystemPrompt() {
  return [
    "You are Markra AI, a local-first Markdown writing assistant.",
    "Help with the current document and nearby workspace notes using only the context that is provided in this turn.",
    "Be concise, practical, and explicit about what you know from the provided context.",
    "Reply in the user's language unless the user asks for another language.",
    "If the user asks for a rewrite or edit, provide the revised text first, then add a short explanation only when it helps.",
    "Do not claim to have searched the web or read files that were not included in the provided context."
  ].join("\n");
}

function buildDocumentToolCallingSystemPrompt() {
  return [
    "You are Markra AI, a local-first Markdown assistant.",
    "Use the available tools in three stages: inspect, locate, then execute.",
    "Inspect the document and current context first, especially when the user asks you to insert or restructure content.",
    "Reply in the user's language unless the user asks for another language.",
    "When the user asks about nearby notes, call list_workspace_files first, then read_workspace_file for the exact Markdown files you need.",
    "Use locate_markdown_region or get_available_anchors before writing whenever the edit position is not trivially obvious.",
    "When the user asks to rewrite, compress, clean up, or keep only part of the whole document, use replace_document.",
    "Use get_document_sections and locate_section when the user asks to rewrite, delete, move, or regenerate an entire section.",
    "When the request targets a whole section, prefer replace_section or delete_section instead of block-level tools.",
    "When the request targets a Markdown table, locate the table anchor and prefer replace_table instead of replacing a heading, cell, or nearby block.",
    "When the request targets exactly one paragraph, heading, list item, or non-table block, prefer replace_block instead of guessing a character range with replace_region.",
    "When the user asks for a document edit, prefer the write tools instead of only describing the edit.",
    "Prefer replace_document for whole-document edits; prefer replace_section for section edits; prefer replace_table for table edits; prefer replace_block for single-block edits; use replace_region only for inline selections or unusual ranges.",
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
    "replace_block",
    "replace_region",
    "replace_table",
    "replace_section"
  ].includes(toolName);
}

async function readPromptedDocumentImages({
  documentContent,
  model,
  prompt,
  provider,
  readDocumentImage
}: {
  documentContent: string;
  model: string;
  prompt: string;
  provider: AiProviderConfig;
  readDocumentImage?: (src: string) => Promise<DocumentAiImage | null>;
}) {
  if (!readDocumentImage || !shouldAttachDocumentImages(prompt) || !modelSupportsVision(provider, model)) {
    return [];
  }

  const references = extractMarkdownImageReferences(documentContent).slice(0, 4);
  const images: ChatImageAttachment[] = [];

  for (const reference of references) {
    try {
      const image = await readDocumentImage(reference.src);
      if (image) {
        images.push({
          dataUrl: image.dataUrl,
          mimeType: image.mimeType
        });
      }
    } catch {
      // Missing local images should not block the text-only AI turn.
    }
  }

  return images;
}

function modelSupportsVision(provider: AiProviderConfig, model: string) {
  return provider.models.some((item) => item.id === model && item.enabled && item.capabilities.includes("vision"));
}

function shouldAttachDocumentImages(prompt: string) {
  return /图片|图像|截图|照片|图表|这张图|这幅图|看图|识别|image|screenshot|photo|picture|figure|diagram|chart|visual/iu.test(prompt);
}

function extractMarkdownImageReferences(markdown: string) {
  const references: Array<{ alt: string; src: string }> = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/gu;
  let match: RegExpExecArray | null = imagePattern.exec(markdown);

  while (match) {
    const src = normalizeMarkdownImageSrc(match[2] ?? "");
    if (src) references.push({ alt: match[1] ?? "", src });
    match = imagePattern.exec(markdown);
  }

  return references;
}

function normalizeMarkdownImageSrc(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end > 0 ? trimmed.slice(1, end).trim() : "";
  }

  return trimmed.split(/\s+/u)[0] ?? "";
}

function buildDocumentAgentMessages({
  documentImages,
  history,
  prompt,
  selection,
  toolResults,
  webSearchEnabled
}: {
  documentImages: ChatImageAttachment[];
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
      ...(documentImages.length ? { images: documentImages } : {}),
      role: "user"
    }
  ];
}

function buildDocumentToolCallingTurnMessages({
  documentImages,
  prompt,
  selection,
  webSearchEnabled
}: {
  documentImages: ChatImageAttachment[];
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
    createAgentUserMessage(buildCurrentUserRequest(prompt), documentImages)
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

function createAgentUserMessage(content: string, images: ChatImageAttachment[] = []): AgentMessage {
  return {
    content: images.length
      ? [
          { text: content, type: "text" },
          ...images.map((image) => ({
            data: image.dataUrl,
            mimeType: image.mimeType,
            type: "image" as const
          }))
        ]
      : content,
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
  const target = formatHistoryPreviewTarget(preview.target);

  return [
    "Prepared editor preview:",
    `Type: ${preview.type}`,
    ...(target ? [`Target: ${target}`] : []),
    `Range: ${range}`,
    `Original excerpt: ${formatHistoryPreviewExcerpt(preview.original)}`,
    `Replacement excerpt: ${formatHistoryPreviewExcerpt(preview.replacement)}`
  ].join("\n");
}

function formatHistoryPreviewTarget(target: AiDiffTarget | undefined) {
  if (!target) return null;

  const title = target.title?.trim() || target.id?.trim();
  const label = title ? `${target.kind}: ${title}` : target.kind;
  const range = target.from === undefined || target.to === undefined ? null : `${target.from}-${target.to}`;

  return range ? `${label} (${range})` : label;
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
