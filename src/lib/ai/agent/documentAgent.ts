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
import { webSearchSettingsAreUsable, type WebSearchSettings } from "../../web/webSearch";
import { providerSupportsNativeWebSearch } from "./nativeWebSearch";

export type DocumentAiHistoryMessage = {
  preview?: DocumentAiHistoryPreview;
  previews?: DocumentAiHistoryPreview[];
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
  onPreviewResult?: (result: AiDiffResult, previewId?: string) => unknown;
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
  webSearchSettings?: WebSearchSettings | null;
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
  stopReasonCode?: "repeated_multi_write";
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
  webSearchSettings = null,
  workspaceFiles = []
}: RunDocumentAiAgentInput): Promise<RunDocumentAiAgentResult> {
  const capabilities = getProviderCapabilities(provider.id, provider.type);
  if (capabilities.toolCalling && supportsDocumentToolCalling(provider.type) && modelSupportsTools(provider, model)) {
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
      readDocumentImage: modelSupportsVision(provider, model) ? readDocumentImage : undefined,
      readWorkspaceFile,
      sectionAnchors,
      selection,
      tableAnchors,
      thinkingEnabled,
      webSearchEnabled,
      webSearchSettings,
      workspaceFiles
    });
  }

  const documentImages = await readPromptedDocumentImages({
    complete,
    documentContent,
    model,
    prompt,
    provider,
    readDocumentImage
  });
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
    webSearchSettings,
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
  webSearchSettings = null,
  workspaceFiles = []
}: RunDocumentAiAgentRuntimeInput): Promise<RunDocumentAiAgentResult> {
  const toolResults = await runReadOnlyAgentTools({
    documentContent,
    documentPath,
    workspaceFiles
  });
  const nativeWebSearchEnabled = webSearchEnabled && providerSupportsNativeWebSearch(provider, model);
  const messages = buildDocumentAgentMessages({
    documentImages,
    history,
    prompt,
    selection,
    toolResults,
    webSearchMode: nativeWebSearchEnabled ? "native" : "none"
  });
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
    thinkingEnabled,
    webSearchEnabled: nativeWebSearchEnabled
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
  readDocumentImage,
  readWorkspaceFile,
  sectionAnchors,
  selection = null,
  tableAnchors,
  thinkingEnabled,
  webSearchEnabled = false,
  webSearchSettings = null,
  workspaceFiles = []
}: RunDocumentAiAgentRuntimeInput): Promise<RunDocumentAiAgentResult> {
  let preparedPreview = false;
  const piAgentModel = createPiAgentModel(provider, model);
  const nativeWebSearchEnabled = webSearchEnabled && providerSupportsNativeWebSearch(provider, model);
  const activeWebSearchSettings =
    webSearchEnabled && !nativeWebSearchEnabled && webSearchSettingsAreUsable(webSearchSettings) ? webSearchSettings : null;
  const agent = new Agent({
    initialState: {
      messages: buildDocumentToolCallingHistoryMessages({ history, model, provider }),
      model: piAgentModel,
      systemPrompt: buildDocumentToolCallingSystemPrompt(
        nativeWebSearchEnabled ? "native" : activeWebSearchSettings ? "custom" : "none"
      ),
      tools: createDocumentAgentTools({
        documentContent,
        documentEndPosition,
        documentPath,
        headingAnchors,
        onPreviewResult: (result, previewId) => {
          preparedPreview = true;
          onPreviewResult?.(result, previewId);
        },
        readDocumentImage,
        readWorkspaceFile,
        sectionAnchors,
        selection,
        tableAnchors,
        webSearch: activeWebSearchSettings ? { settings: activeWebSearchSettings } : undefined,
        workspaceFiles
      })
    },
    streamFn: createNativeChatStreamFn(provider, complete, thinkingEnabled, nativeWebSearchEnabled)
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

  await agent.prompt(buildDocumentToolCallingTurnMessages({
    documentImages: [],
    prompt,
    selection,
    webSearchMode: nativeWebSearchEnabled ? "native" : activeWebSearchSettings ? "custom" : "none"
  }));

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

type DocumentToolCallingWebSearchMode = "custom" | "native" | "none";

function buildDocumentToolCallingSystemPrompt(webSearchMode: DocumentToolCallingWebSearchMode) {
  return [
    "You are Markra AI, a local-first Markdown assistant.",
    "Use the available tools in three stages: inspect, locate, then execute.",
    "Inspect the document and current context first, especially when the user asks you to insert or restructure content.",
    "Reply in the user's language unless the user asks for another language.",
    "When the user asks about nearby notes, call list_workspace_files first, then read_workspace_file for the exact Markdown files you need.",
    "When the user asks about images in the document and image tools are available, call list_document_images first, then view_document_image for the exact src you need.",
    "Do not guess image contents from alt text or filenames when view_document_image is available.",
    ...documentToolCallingWebSearchInstructions(webSearchMode),
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
    "After a write tool succeeds, briefly tell the user what was prepared and what changed.",
    "Do not claim to have searched the web or read files that were not available through tools."
  ].join("\n");
}

function documentToolCallingWebSearchInstructions(webSearchMode: DocumentToolCallingWebSearchMode) {
  if (webSearchMode === "custom") {
    return [
      "When the user asks for current or external web information and builtin_web_search is available, use builtin_web_search and cite sources with [1], [2], etc."
    ];
  }
  if (webSearchMode === "native") {
    return [
      "When the user asks for current or external web information, use the provider's native web search capability and cite sources when the provider returns them."
    ];
  }

  return [];
}

async function readPromptedDocumentImages({
  complete,
  documentContent,
  model,
  prompt,
  provider,
  readDocumentImage
}: {
  complete: InlineAiAgentComplete;
  documentContent: string;
  model: string;
  prompt: string;
  provider: AiProviderConfig;
  readDocumentImage?: (src: string) => Promise<DocumentAiImage | null>;
}) {
  if (!readDocumentImage || !modelSupportsVision(provider, model)) {
    return [];
  }

  const references = extractMarkdownImageReferences(documentContent).slice(0, 4);
  if (!references.length) return [];

  const shouldAttachImages = await classifyDocumentImageIntent({
    complete,
    model,
    prompt,
    provider,
    references
  });
  if (!shouldAttachImages) return [];

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

function modelSupportsTools(provider: AiProviderConfig, model: string) {
  return provider.models.some((item) => item.id === model && item.enabled && item.capabilities.includes("tools"));
}

async function classifyDocumentImageIntent({
  complete,
  model,
  prompt,
  provider,
  references
}: {
  complete: InlineAiAgentComplete;
  model: string;
  prompt: string;
  provider: AiProviderConfig;
  references: MarkdownImageReference[];
}) {
  try {
    const response = await complete(provider, model, buildDocumentImageIntentMessages({ prompt, references }), {
      thinkingEnabled: false
    });

    return imageIntentResponseIsPositive(response.content);
  } catch {
    return false;
  }
}

function buildDocumentImageIntentMessages({
  prompt,
  references
}: {
  prompt: string;
  references: MarkdownImageReference[];
}): ChatMessage[] {
  return [
    {
      content: [
        "Decide whether the user's latest request requires visual understanding of image pixels from the current Markdown document.",
        "Understand the request in any language.",
        "Return exactly YES or NO.",
        "Return YES only when the visual content of one or more listed Markdown images is needed.",
        "Return NO for text-only editing, rewriting, translation, or summarization that does not ask about image contents."
      ].join("\n"),
      role: "system"
    },
    {
      content: [
        "User request:",
        prompt.trim(),
        "",
        "Markdown image references:",
        ...references.map((reference, index) => `${index + 1}. alt=${reference.alt || "(empty)"} src=${reference.src}`)
      ].join("\n"),
      role: "user"
    }
  ];
}

function imageIntentResponseIsPositive(content: string) {
  return /^\s*yes\b/iu.test(content);
}

type MarkdownImageReference = {
  alt: string;
  src: string;
};

function extractMarkdownImageReferences(markdown: string): MarkdownImageReference[] {
  const references: MarkdownImageReference[] = [];
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
  webSearchMode
}: {
  documentImages: ChatImageAttachment[];
  history: DocumentAiHistoryMessage[];
  prompt: string;
  selection: AiSelectionContext | null;
  toolResults: Awaited<ReturnType<typeof runReadOnlyAgentTools>>;
  webSearchMode: DocumentToolCallingWebSearchMode;
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
        webSearchMode
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
  webSearchMode
}: {
  documentImages: ChatImageAttachment[];
  prompt: string;
  selection: AiSelectionContext | null;
  webSearchMode: DocumentToolCallingWebSearchMode;
}): AgentMessage[] {
  return [
    createAgentUserMessage(
      buildDocumentRuntimeContext({
        selection,
        toolCallingEnabled: true,
        webSearchMode
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
  webSearchMode
}: {
  selection: AiSelectionContext | null;
  toolCallingEnabled: boolean;
  webSearchMode: DocumentToolCallingWebSearchMode;
}) {
  const sections = ["Document runtime context:"];

  sections.push(formatSelectionSnapshot(selection) ?? "There is no active cursor or selection snapshot.");

  sections.push(
    toolCallingEnabled
      ? "Document tools are available. Use them to inspect authoritative document content before editing when the location or scope is ambiguous."
      : "No document write tools are available in this provider path. Use the read-only workspace context and answer with text."
  );

  sections.push(...documentRuntimeWebSearchInstructions({ toolCallingEnabled, webSearchMode }));

  return sections.join("\n\n");
}

function documentRuntimeWebSearchInstructions({
  toolCallingEnabled,
  webSearchMode
}: {
  toolCallingEnabled: boolean;
  webSearchMode: DocumentToolCallingWebSearchMode;
}) {
  if (webSearchMode === "native") {
    return [
      "Native web search is enabled for this request. Use the provider's built-in web search for current or external web information, and cite sources when the provider returns them.",
      "Do not say live browsing is unavailable merely because no local browser tool is listed."
    ];
  }
  if (webSearchMode === "custom") {
    return [
      toolCallingEnabled
        ? "Use builtin_web_search for live web information."
        : "Web search was requested, but no live search tool is available on this provider path. Say so briefly and continue with the provided document context."
    ];
  }

  return [];
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
  const previews = message.previews?.length ? message.previews : (message.preview ? [message.preview] : []);
  previews.forEach((preview) => {
    const previewSummary = formatHistoryPreviewSummary(preview);
    if (previewSummary) parts.push(previewSummary);
  });

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
