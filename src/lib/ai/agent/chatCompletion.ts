import type { AiProviderConfig } from "../providers/aiProviders";
import { requestNativeChat, type NativeAiChatRequest, type NativeAiHttpResponse } from "../../tauri/nativeAi";
import { isRecord } from "../../utils";
import { getChatAdapter, type ChatMessage, type ChatResponse } from "./chatAdapters";

export type ChatCompletionTransport = (request: NativeAiChatRequest) => Promise<NativeAiHttpResponse>;

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

function readResponseError(response: NativeAiHttpResponse) {
  if (isRecord(response.body)) {
    if (typeof response.body.message === "string") return response.body.message;
    if (isRecord(response.body.error) && typeof response.body.error.message === "string") return response.body.error.message;
    if (typeof response.body.error === "string") return response.body.error;
  }

  return `Request failed with HTTP ${response.status}.`;
}
