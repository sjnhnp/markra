import type { AiProviderConfig } from "../providers/aiProviders";
import {
  requestNativeChat,
  requestNativeChatStream,
  type NativeAiChatRequest,
  type NativeAiHttpResponse,
  type NativeAiStreamResponse
} from "../../tauri/nativeAi";
import { isRecord } from "../../utils";
import {
  getChatAdapter,
  type ChatMessage,
  type ChatResponse,
  type ChatToolCallDelta
} from "./chatAdapters";

export type ChatCompletionTransport = (request: NativeAiChatRequest) => Promise<NativeAiHttpResponse>;
export type ChatCompletionStreamTransport = (
  request: NativeAiChatRequest,
  onChunk: (chunk: string) => unknown
) => Promise<NativeAiStreamResponse>;

export type ChatCompletionStreamOptions = {
  onDelta?: (delta: string) => unknown;
  onThinkingDelta?: (delta: string) => unknown;
  onToolCallDelta?: (delta: ChatToolCallDelta) => unknown;
  streamTransport?: ChatCompletionStreamTransport;
  thinkingEnabled?: boolean;
  tools?: import("@mariozechner/pi-ai").Tool[];
};

export async function chatCompletion(
  provider: AiProviderConfig,
  model: string,
  messages: ChatMessage[],
  transport: ChatCompletionTransport = requestNativeChat
): Promise<ChatResponse> {
  const adapter = getChatAdapter(provider.type);
  const request = adapter.buildRequest(provider, model, messages);
  const response = await transport({
    body: JSON.stringify(request.body),
    headers: request.headers,
    url: request.url
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(readResponseError(response));
  }

  return adapter.parseResponse(response.body);
}

export async function chatCompletionStream(
  provider: AiProviderConfig,
  model: string,
  messages: ChatMessage[],
  {
    onDelta,
    onThinkingDelta,
    onToolCallDelta,
    streamTransport = requestNativeChatStream,
    thinkingEnabled,
    tools
  }: ChatCompletionStreamOptions = {}
): Promise<ChatResponse> {
  const adapter = getChatAdapter(provider.type);
  const request = adapter.buildRequest(provider, model, messages, { stream: true, thinkingEnabled, tools });
  let content = "";
  let finishReason: string | undefined;
  const toolCalls = new Map<number, { argumentsText: string; id: string; name: string }>();
  const parser = createServerSentEventParser();
  const inlineThinkingExtractor = thinkingEnabled ? createInlineThinkingExtractor() : null;
  const emitContentDelta = (delta: string) => {
    content += delta;
    onDelta?.(delta);
  };
  const emitThinkingDelta = (delta: string) => {
    onThinkingDelta?.(delta);
  };
  const processContentDelta = (delta: string) => {
    if (!inlineThinkingExtractor) {
      emitContentDelta(delta);
      return;
    }

    const extracted = inlineThinkingExtractor.push(delta);
    if (extracted.thinkingDelta) emitThinkingDelta(extracted.thinkingDelta);
    if (extracted.contentDelta) emitContentDelta(extracted.contentDelta);
  };
  const processStreamEvent = (event: unknown) => {
    const parsed = adapter.parseStreamEvent(event);
    if (parsed.done) return;

    if (parsed.contentDelta) {
      processContentDelta(parsed.contentDelta);
    }

    if (parsed.thinkingDelta) emitThinkingDelta(parsed.thinkingDelta);
    if (parsed.toolCallDeltas?.length) {
      for (const delta of parsed.toolCallDeltas) {
        const currentToolCall = toolCalls.get(delta.index) ?? { argumentsText: "", id: "", name: "" };
        currentToolCall.argumentsText += delta.argumentsDelta ?? "";
        currentToolCall.id = delta.id ?? currentToolCall.id;
        currentToolCall.name += delta.nameDelta ?? "";
        toolCalls.set(delta.index, currentToolCall);
        onToolCallDelta?.(delta);
      }
    }

    if (parsed.finishReason) finishReason = parsed.finishReason;
  };
  const response = await streamTransport(
    {
      body: JSON.stringify(request.body),
      headers: request.headers,
      url: request.url
    },
    (chunk) => {
      parser.push(chunk).forEach(processStreamEvent);
    }
  );

  parser.finish().forEach(processStreamEvent);
  const finalInlineThinkingDelta = inlineThinkingExtractor?.finish();
  if (finalInlineThinkingDelta?.thinkingDelta) emitThinkingDelta(finalInlineThinkingDelta.thinkingDelta);
  if (finalInlineThinkingDelta?.contentDelta) emitContentDelta(finalInlineThinkingDelta.contentDelta);

  if (response.status < 200 || response.status >= 300) {
    throw new Error(readResponseError({ body: response.body ?? null, status: response.status }));
  }

  return {
    content,
    finishReason,
    ...(toolCalls.size > 0
      ? {
          toolCalls: [...toolCalls.entries()].map(([, toolCall]) => ({
            arguments: parseToolArguments(toolCall.argumentsText),
            id: toolCall.id,
            name: toolCall.name
          }))
        }
      : {})
  };
}

function readResponseError(response: NativeAiHttpResponse) {
  if (isRecord(response.body)) {
    if (typeof response.body.message === "string") return response.body.message;
    if (isRecord(response.body.error) && typeof response.body.error.message === "string") return response.body.error.message;
    if (typeof response.body.error === "string") return response.body.error;
  }

  return `Request failed with HTTP ${response.status}.`;
}

function createServerSentEventParser() {
  let buffer = "";

  return {
    finish() {
      const finalBlock = buffer;
      buffer = "";

      return finalBlock.trim() ? parseServerSentEventBlock(finalBlock) : [];
    },
    push(chunk: string) {
      buffer += chunk.replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      return blocks.flatMap(parseServerSentEventBlock);
    }
  };
}

function parseServerSentEventBlock(block: string) {
  const data = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
    .trim();

  if (!data) return [];
  if (data === "[DONE]") return ["[DONE]"];

  return [JSON.parse(data) as unknown];
}

function parseToolArguments(rawArguments: string) {
  if (!rawArguments.trim()) return {};

  try {
    const parsed = JSON.parse(rawArguments) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type InlineThinkingExtraction = {
  contentDelta?: string;
  thinkingDelta?: string;
};

const inlineThinkingTagNames = new Set(["reasoning", "seed:think", "think", "thinking", "thought"]);

function createInlineThinkingExtractor() {
  let activeThinkingTag: string | null = null;
  let pending = "";

  const append = (result: { contentDelta: string; thinkingDelta: string }, text: string) => {
    if (!text) return;
    if (activeThinkingTag) {
      result.thinkingDelta += text;
    } else {
      result.contentDelta += text;
    }
  };

  const readTag = (tag: string) => {
    const match = tag.trim().match(/^(\/)?([a-z][\w:-]*)\b[^>]*$/iu);
    if (!match) return null;

    const name = match[2]?.toLowerCase();
    if (!name || !inlineThinkingTagNames.has(name)) return null;

    return {
      closing: match[1] === "/",
      name
    };
  };

  const consume = (text: string, flushPending: boolean): InlineThinkingExtraction => {
    const result = { contentDelta: "", thinkingDelta: "" };
    let buffer = pending + text;
    let index = 0;
    pending = "";

    while (index < buffer.length) {
      const tagStart = buffer.indexOf("<", index);
      if (tagStart < 0) {
        append(result, buffer.slice(index));
        break;
      }

      append(result, buffer.slice(index, tagStart));
      const tagEnd = buffer.indexOf(">", tagStart + 1);
      if (tagEnd < 0) {
        pending = buffer.slice(tagStart);
        break;
      }

      const rawTag = buffer.slice(tagStart + 1, tagEnd);
      const tag = readTag(rawTag);
      if (tag?.closing && activeThinkingTag && tag.name === activeThinkingTag) {
        activeThinkingTag = null;
      } else if (tag && !tag.closing && !activeThinkingTag) {
        activeThinkingTag = tag.name;
      } else {
        append(result, buffer.slice(tagStart, tagEnd + 1));
      }

      index = tagEnd + 1;
    }

    if (flushPending && pending) {
      buffer = pending;
      pending = "";
      append(result, buffer);
    }

    return {
      ...(result.contentDelta ? { contentDelta: result.contentDelta } : {}),
      ...(result.thinkingDelta ? { thinkingDelta: result.thinkingDelta } : {})
    };
  };

  return {
    finish() {
      return consume("", true);
    },
    push(text: string) {
      return consume(text, false);
    }
  };
}
