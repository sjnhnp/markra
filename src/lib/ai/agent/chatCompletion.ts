import type { AiProviderConfig } from "../providers/aiProviders";
import {
  requestNativeChat,
  requestNativeChatStream,
  type NativeAiChatRequest,
  type NativeAiHttpResponse,
  type NativeAiStreamResponse
} from "../../tauri/nativeAi";
import { isRecord } from "../../utils";
import { getChatAdapter, type ChatMessage, type ChatResponse } from "./chatAdapters";

export type ChatCompletionTransport = (request: NativeAiChatRequest) => Promise<NativeAiHttpResponse>;
export type ChatCompletionStreamTransport = (
  request: NativeAiChatRequest,
  onChunk: (chunk: string) => unknown
) => Promise<NativeAiStreamResponse>;

export type ChatCompletionStreamOptions = {
  onDelta?: (delta: string) => unknown;
  streamTransport?: ChatCompletionStreamTransport;
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
    streamTransport = requestNativeChatStream
  }: ChatCompletionStreamOptions = {}
): Promise<ChatResponse> {
  const adapter = getChatAdapter(provider.type);
  const request = adapter.buildRequest(provider, model, messages, { stream: true });
  let content = "";
  let finishReason: string | undefined;
  const parser = createServerSentEventParser();
  const processStreamEvent = (event: unknown) => {
    const parsed = adapter.parseStreamEvent(event);
    if (parsed.done) return;

    if (parsed.contentDelta) {
      content += parsed.contentDelta;
      onDelta?.(parsed.contentDelta);
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

  if (response.status < 200 || response.status >= 300) {
    throw new Error(readResponseError({ body: response.body ?? null, status: response.status }));
  }

  return {
    content,
    finishReason
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
