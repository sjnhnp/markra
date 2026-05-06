import { Agent, type AgentEvent, type StreamFn } from "@mariozechner/pi-agent-core";
import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context,
  type ImageContent,
  type Message,
  type Model,
  type StopReason,
  type TextContent
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

function createNativeChatStreamFn(
  provider: AiProviderConfig,
  complete: InlineAiAgentComplete,
  thinkingEnabled: boolean | undefined
): StreamFn {
  return (model, context, options) => {
    const stream = createAssistantMessageEventStream();
    streamNativeChatCompletion({
      complete,
      context,
      model,
      options,
      provider,
      stream,
      thinkingEnabled
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
  thinkingEnabled
}: {
  complete: InlineAiAgentComplete;
  context: Context;
  model: Model<any>;
  options?: { signal?: AbortSignal };
  provider: AiProviderConfig;
  stream: ReturnType<typeof createAssistantMessageEventStream>;
  thinkingEnabled: boolean | undefined;
}) {
  if (options?.signal?.aborted) {
    pushAssistantError(stream, model, new Error("Request aborted by user."), options.signal);
    return;
  }

  const partial = createAssistantMessage(model);
  let streamedContent = "";
  stream.push({ partial, type: "start" });
  stream.push({ contentIndex: 0, partial, type: "text_start" });

  const response = await complete(provider, model.id, messagesFromPiContext(context), {
    onDelta: (delta) => {
      streamedContent += delta;
      stream.push({
        contentIndex: 0,
        delta,
        partial: createAssistantMessage(model, streamedContent),
        type: "text_delta"
      });
    },
    thinkingEnabled
  });
  if (options?.signal?.aborted) {
    pushAssistantError(stream, model, new Error("Request aborted by user."), options.signal);
    return;
  }

  const finalContent = response.content || streamedContent;
  const finalMessage = createAssistantMessage(model, finalContent, stopReasonFromFinishReason(response.finishReason));
  if (!streamedContent && finalContent) {
    stream.push({
      contentIndex: 0,
      delta: finalContent,
      partial: finalMessage,
      type: "text_delta"
    });
  }
  stream.push({
    content: finalContent,
    contentIndex: 0,
    partial: finalMessage,
    type: "text_end"
  });
  stream.push({
    message: finalMessage,
    reason: finalMessage.stopReason === "length" ? "length" : "stop",
    type: "done"
  });
}

function createPiAgentModel(provider: AiProviderConfig, modelId: string): Model<any> {
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
    return [{ content: piContentToText(message.content), role: "user" }];
  }

  if (message.role === "assistant") {
    return [{ content: assistantTextContent(message), role: "assistant" }];
  }

  return [
    {
      content: [`Tool result from ${message.toolName}:`, piContentToText(message.content)].join("\n"),
      role: "user"
    }
  ];
}

function piContentToText(content: string | (TextContent | ImageContent)[]) {
  if (typeof content === "string") return content;

  return content.map((part) => (part.type === "text" ? part.text : `[image:${part.mimeType}]`)).join("\n");
}

function assistantTextContent(message: AssistantMessage) {
  return message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

function createAssistantMessage(model: Model<any>, content = "", stopReason: StopReason = "stop"): AssistantMessage {
  return {
    api: model.api,
    content: content ? [{ text: content, type: "text" }] : [],
    model: model.id,
    provider: model.provider,
    role: "assistant",
    stopReason,
    timestamp: Date.now(),
    usage: emptyUsage()
  };
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
