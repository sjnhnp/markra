import { Agent, type AgentEvent, type StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context,
  type ImageContent,
  type Message,
  type Model,
  type StopReason,
  type ThinkingContent,
  type TextContent,
  type Tool,
  type ToolCall
} from "@mariozechner/pi-ai";
import type { AiProviderConfig } from "../providers/aiProviders";
import { chatCompletionStream, type ChatCompletionStreamOptions } from "./chatCompletion";
import type { ChatMessage, ChatResponse } from "./chatAdapters";
import { runReadOnlyAgentTools, type AgentWorkspaceFile } from "./agentTools";
import type { AiEditIntent, AiTargetScope } from "./inlineAi";
import { buildInlineAiMessages, normalizeInlineAiReplacement } from "./inlinePrompt";

type InlineAiSuggestionContext = {
  original: string;
  replacement: string;
};

type AssistantContentBlock = TextContent | ThinkingContent | ToolCall;

export type InlineAiAgentTarget = {
  from?: number;
  original: string;
  promptText: string;
  scope?: AiTargetScope;
  suggestionContext?: InlineAiSuggestionContext;
  to?: number;
  type: "insert" | "replace";
};

export type InlineAiAgentComplete = (
  provider: AiProviderConfig,
  model: string,
  messages: ChatMessage[],
  options?: ChatCompletionStreamOptions
) => Promise<ChatResponse>;

export type InlineAiAgentInput = {
  complete?: InlineAiAgentComplete;
  documentContent: string;
  documentPath: string | null;
  intent?: AiEditIntent;
  model: string;
  onEvent?: (event: AgentEvent) => unknown;
  prompt: string;
  provider: AiProviderConfig;
  target: InlineAiAgentTarget;
  thinkingEnabled?: boolean;
  translationTargetLanguage?: string;
  workspaceFiles?: AgentWorkspaceFile[];
};

export async function runInlineAiAgent({
  complete = chatCompletionStream,
  documentContent,
  documentPath,
  intent = "custom",
  model,
  onEvent,
  prompt,
  provider,
  target,
  thinkingEnabled,
  translationTargetLanguage,
  workspaceFiles = []
}: InlineAiAgentInput) {
  const toolResults = await runReadOnlyAgentTools({
    documentContent,
    documentPath,
    workspaceFiles
  });
  const messages = buildInlineAiMessages({
    documentContent,
    intent,
    prompt,
    suggestionContext: target.suggestionContext,
    targetScope: target.scope,
    targetText: target.promptText,
    targetType: target.type,
    translationTargetLanguage
  });
  const systemPrompt = messages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = [
    ...messages.filter((message) => message.role !== "system").map((message) => message.content),
    formatReadOnlyToolContext(toolResults)
  ].join("\n\n");
  const agent = new Agent({
    initialState: {
      model: createPiAgentModel(provider, model),
      systemPrompt
    },
    streamFn: createNativeChatStreamFn(provider, complete, thinkingEnabled)
  });
  let finalContent = "";
  let finishReason: string | undefined;

  agent.subscribe((event) => {
    onEvent?.(event);
    if (event.type !== "message_end" || event.message.role !== "assistant") return;

    finalContent = assistantTextContent(event.message);
    finishReason = event.message.stopReason;
  });

  await agent.prompt(userPrompt);

  return {
    content: normalizeInlineAiReplacement(finalContent, {
      preserveLeadingWhitespace: target.type === "insert"
    }),
    finishReason
  };
}

function formatReadOnlyToolContext(toolResults: Awaited<ReturnType<typeof runReadOnlyAgentTools>>) {
  return [
    "Read-only agent tool context:",
    ...toolResults.map((result) => [`Tool: ${result.name}`, result.content].join("\n"))
  ].join("\n\n");
}

export function createNativeChatStreamFn(
  provider: AiProviderConfig,
  complete: InlineAiAgentComplete,
  thinkingEnabled: boolean | undefined,
  webSearchEnabled = false
): StreamFn {
  let localToolCallCounter = 0;

  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();
    streamNativeChatCompletion({
      complete,
      context,
      model,
      nextLocalToolCallId: () => `tool-call-${++localToolCallCounter}`,
      options,
      provider,
      stream,
      thinkingEnabled,
      webSearchEnabled
    }).catch((error) => {
      pushAssistantError(stream, model, error, options?.signal);
    });
    return stream;
  };
}

async function streamNativeChatCompletion({
  complete,
  context,
  model,
  options,
  provider,
  stream,
  thinkingEnabled,
  webSearchEnabled,
  nextLocalToolCallId
}: {
  complete: InlineAiAgentComplete;
  context: Context;
  model: Model<any>;
  nextLocalToolCallId: () => string;
  options?: { signal?: AbortSignal };
  provider: AiProviderConfig;
  stream: ReturnType<typeof createAssistantMessageEventStream>;
  thinkingEnabled: boolean | undefined;
  webSearchEnabled: boolean;
}) {
  if (options?.signal?.aborted) {
    pushAssistantError(stream, model, new Error("Request aborted by user."), options.signal);
    return;
  }

  const contentBlocks: AssistantContentBlock[] = [];
  const toolCallBlocks = new Map<number, ToolCall>();
  const toolCallArgumentBuffers = new Map<number, string>();
  const ignoredToolCallIndexes = new Set<number>();
  const openToolCallIndexes = new Set<number>();
  let currentBlock: AssistantContentBlock | null = null;
  const partial = createAssistantMessage(model);
  let streamedContent = "";
  stream.push({ partial, type: "start" });
  const localToolNames = new Set((context.tools ?? []).map((tool) => tool.name));
  const shouldIgnoreToolCall = (name: string) => {
    return webSearchEnabled && !localToolNames.has(name);
  };

  const finishCurrentBlock = () => {
    if (!currentBlock) return;

    const contentIndex = contentBlocks.indexOf(currentBlock);
    const partialMessage = createAssistantMessage(model, contentBlocks);
    if (currentBlock.type === "text") {
      stream.push({
        content: currentBlock.text,
        contentIndex,
        partial: partialMessage,
        type: "text_end"
      });
    } else if (currentBlock.type === "thinking") {
      stream.push({
        content: currentBlock.thinking,
        contentIndex,
        partial: partialMessage,
        type: "thinking_end"
      });
    }
    currentBlock = null;
  };
  const ensureTextBlock = () => {
    if (currentBlock?.type === "text") return currentBlock;

    finishCurrentBlock();
    const block: TextContent = { text: "", type: "text" };
    currentBlock = block;
    contentBlocks.push(block);
    stream.push({
      contentIndex: contentBlocks.length - 1,
      partial: createAssistantMessage(model, contentBlocks),
      type: "text_start"
    });

    return block;
  };
  const ensureThinkingBlock = () => {
    if (currentBlock?.type === "thinking") return currentBlock;

    finishCurrentBlock();
    const block: ThinkingContent = { thinking: "", type: "thinking" };
    currentBlock = block;
    contentBlocks.push(block);
    stream.push({
      contentIndex: contentBlocks.length - 1,
      partial: createAssistantMessage(model, contentBlocks),
      type: "thinking_start"
    });

    return block;
  };
  const ensureToolCallBlock = (index: number) => {
    finishCurrentBlock();
    const existingBlock = toolCallBlocks.get(index);
    if (existingBlock) return existingBlock;

    const localToolCallId = nextLocalToolCallId();
    const block: ToolCall = {
      arguments: {},
      id: localToolCallId,
      name: "",
      type: "toolCall"
    };
    toolCallBlocks.set(index, block);
    contentBlocks.push(block);
    openToolCallIndexes.add(index);
    stream.push({
      contentIndex: contentBlocks.length - 1,
      partial: createAssistantMessage(model, contentBlocks),
      type: "toolcall_start"
    });

    return block;
  };
  const discardToolCallBlock = (index: number) => {
    const block = toolCallBlocks.get(index);
    if (block) {
      const contentIndex = contentBlocks.indexOf(block);
      if (contentIndex >= 0) contentBlocks.splice(contentIndex, 1);
      if (currentBlock === block) currentBlock = null;
    }
    ignoredToolCallIndexes.add(index);
    openToolCallIndexes.delete(index);
    toolCallArgumentBuffers.delete(index);
    toolCallBlocks.delete(index);
  };
  const finishToolCallBlocks = () => {
    for (const index of [...openToolCallIndexes].sort((left, right) => left - right)) {
      const block = toolCallBlocks.get(index);
      if (!block) continue;

      block.arguments = parseToolCallArguments(toolCallArgumentBuffers.get(index) ?? "");
      stream.push({
        contentIndex: contentBlocks.indexOf(block),
        partial: createAssistantMessage(model, contentBlocks),
        toolCall: { ...block, arguments: structuredClone(block.arguments) },
        type: "toolcall_end"
      });
      openToolCallIndexes.delete(index);
    }
  };

  const response = await complete(provider, model.id, messagesFromPiContext(context), {
    onDelta: (delta) => {
      streamedContent += delta;
      const textBlock = ensureTextBlock();
      textBlock.text += delta;
      stream.push({
        contentIndex: contentBlocks.indexOf(textBlock),
        delta,
        partial: createAssistantMessage(model, contentBlocks),
        type: "text_delta"
      });
    },
    onThinkingDelta: (delta) => {
      const thinkingBlock = ensureThinkingBlock();
      thinkingBlock.thinking += delta;
      stream.push({
        contentIndex: contentBlocks.indexOf(thinkingBlock),
        delta,
        partial: createAssistantMessage(model, contentBlocks),
        type: "thinking_delta"
      });
    },
    onToolCallDelta: (delta) => {
      if (ignoredToolCallIndexes.has(delta.index)) return;

      const existingToolCall = toolCallBlocks.get(delta.index);
      const nextToolCallName = delta.replaceName
        ? (delta.nameDelta ?? "")
        : `${existingToolCall?.name ?? ""}${delta.nameDelta ?? ""}`;
      if (nextToolCallName && shouldIgnoreToolCall(nextToolCallName)) {
        discardToolCallBlock(delta.index);
        return;
      }

      const toolCallBlock = ensureToolCallBlock(delta.index);
      if (delta.id) {
        toolCallBlock.id = combineToolCallIds(delta.id, localToolCallIdFromCombined(toolCallBlock.id));
      }
      if (delta.nameDelta) {
        toolCallBlock.name = delta.replaceName ? delta.nameDelta : `${toolCallBlock.name}${delta.nameDelta}`;
      }
      if (delta.argumentsDelta) {
        toolCallArgumentBuffers.set(
          delta.index,
          delta.replaceArguments ? delta.argumentsDelta : `${toolCallArgumentBuffers.get(delta.index) ?? ""}${delta.argumentsDelta}`
        );
      }

      const parsedArguments = parseToolCallArguments(toolCallArgumentBuffers.get(delta.index) ?? "");
      toolCallBlock.arguments = parsedArguments;
      stream.push({
        contentIndex: contentBlocks.indexOf(toolCallBlock),
        delta: delta.argumentsDelta ?? delta.nameDelta ?? "",
        partial: createAssistantMessage(model, contentBlocks),
        type: "toolcall_delta"
      });
    },
    thinkingEnabled,
    tools: context.tools,
    webSearchEnabled
  });
  if (options?.signal?.aborted) {
    pushAssistantError(stream, model, new Error("Request aborted by user."), options.signal);
    return;
  }

  if (response.toolCalls?.length) {
    for (const [index, toolCall] of response.toolCalls.entries()) {
      if (shouldIgnoreToolCall(toolCall.name)) continue;

      const block = ensureToolCallBlock(index);
      block.id = combineToolCallIds(toolCall.id, localToolCallIdFromCombined(block.id));
      block.name = toolCall.name;
      block.arguments = structuredClone(toolCall.arguments);
      toolCallArgumentBuffers.set(index, JSON.stringify(toolCall.arguments));
    }
  }
  finishToolCallBlocks();

  const finalContent = response.content || streamedContent;
  if (!streamedContent && finalContent) {
    const textBlock = ensureTextBlock();
    textBlock.text += finalContent;
    stream.push({
      contentIndex: contentBlocks.indexOf(textBlock),
      delta: finalContent,
      partial: createAssistantMessage(model, contentBlocks),
      type: "text_delta"
    });
  }
  finishCurrentBlock();
  const finalStopReason = stopReasonFromFinishReason(
    response.finishReason ?? (response.toolCalls?.length ? "toolUse" : undefined)
  );
  const finalMessage = createAssistantMessage(model, contentBlocks, finalStopReason);
  stream.push({
    message: finalMessage,
    reason:
      finalMessage.stopReason === "toolUse"
        ? "toolUse"
        : finalMessage.stopReason === "length"
          ? "length"
          : "stop",
    type: "done"
  });
}

export function createPiAgentModel(provider: AiProviderConfig, modelId: string): Model<any> {
  return {
    api: "markra-native-chat",
    baseUrl: provider.baseUrl ?? "",
    contextWindow: 0,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0
    },
    id: modelId,
    input: ["text"],
    maxTokens: 0,
    name: modelId,
    provider: provider.id,
    reasoning: false
  };
}

function messagesFromPiContext(context: Context): ChatMessage[] {
  return [
    ...(context.systemPrompt ? [{ content: context.systemPrompt, role: "system" as const }] : []),
    ...context.messages.flatMap(chatMessageFromPiMessage)
  ];
}

function chatMessageFromPiMessage(message: Message): ChatMessage[] {
  if (message.role === "user") {
    return [chatMessageFromPiUserMessage(message.content)];
  }

  if (message.role === "assistant") {
    const toolCalls = message.content
      .filter((part): part is ToolCall => part.type === "toolCall")
      .map((toolCall) => ({
        arguments: structuredClone(toolCall.arguments),
        id: toolCall.id,
        name: toolCall.name
      }));

    return [{
      content: assistantTextContent(message),
      role: "assistant",
      ...(toolCalls.length ? { toolCalls } : {})
    }];
  }

  return [chatMessageFromPiToolResultMessage(message)];
}

function chatMessageFromPiUserMessage(content: string | (TextContent | ImageContent)[]): ChatMessage {
  if (typeof content === "string") return { content, role: "user" };

  const { images, text } = chatContentFromPiContent(content);

  return {
    content: text,
    ...(images.length ? { images } : {}),
    role: "user"
  };
}

function chatMessageFromPiToolResultMessage(message: Extract<Message, { role: "toolResult" }>): ChatMessage {
  const { images, text } = chatContentFromPiContent(message.content);

  return {
    content: [`Tool result from ${message.toolName}:`, text].filter((part) => part.length > 0).join("\n"),
    ...(images.length ? { images } : {}),
    role: "user",
    toolResult: {
      outputText: text,
      toolCallId: message.toolCallId,
      toolName: message.toolName
    }
  };
}

function chatContentFromPiContent(content: (TextContent | ImageContent)[]) {
  return {
    images: content
      .filter((part): part is ImageContent => part.type === "image")
      .map((part) => ({
        dataUrl: imageDataUrlFromPiImage(part),
        mimeType: part.mimeType
      })),
    text: content.map((part) => (part.type === "text" ? part.text : "")).filter(Boolean).join("\n")
  };
}

function imageDataUrlFromPiImage(image: ImageContent) {
  if (image.data.startsWith("data:")) return image.data;

  return `data:${image.mimeType};base64,${image.data}`;
}

function combineToolCallIds(providerToolCallId: string, localToolCallId: string) {
  return providerToolCallId ? `${providerToolCallId}|${localToolCallId}` : localToolCallId;
}

function localToolCallIdFromCombined(toolCallId: string) {
  const [, localToolCallId] = toolCallId.split("|");
  return localToolCallId ?? toolCallId;
}

export function assistantTextContent(message: AssistantMessage) {
  return message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function createAssistantMessage(
  model: Model<any>,
  content: string | AssistantContentBlock[] = "",
  stopReason: StopReason = "stop"
): AssistantMessage {
  return {
    api: model.api,
    content: typeof content === "string"
      ? content ? [{ text: content, type: "text" }] : []
      : cloneAssistantContent(content),
    model: model.id,
    provider: model.provider,
    role: "assistant",
    stopReason,
    timestamp: Date.now(),
    usage: emptyUsage()
  };
}

function cloneAssistantContent(content: AssistantContentBlock[]): AssistantContentBlock[] {
  return content.map((block) => {
    return block.type === "toolCall" ? { ...block, arguments: structuredClone(block.arguments) } : { ...block };
  });
}

function emptyUsage() {
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

function stopReasonFromFinishReason(reason: string | undefined): StopReason {
  if (reason === "length") return "length";
  if (reason === "toolUse") return "toolUse";
  if (reason === "error") return "error";
  if (reason === "aborted") return "aborted";

  return "stop";
}

function pushAssistantError(
  stream: ReturnType<typeof createAssistantMessageEventStream>,
  model: Model<any>,
  error: unknown,
  signal: AbortSignal | undefined
) {
  const reason = signal?.aborted ? "aborted" : "error";
  const message = createAssistantMessage(model, "", reason);
  message.errorMessage = error instanceof Error ? error.message : String(error);
  stream.push({
    error: message,
    reason,
    type: "error"
  });
}

function parseToolCallArguments(rawArguments: string) {
  if (!rawArguments.trim()) return {};

  try {
    const parsed = JSON.parse(rawArguments) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
