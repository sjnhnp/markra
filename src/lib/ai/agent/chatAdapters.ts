import type { Tool } from "@mariozechner/pi-ai";
import type { AiProviderApiStyle, AiProviderConfig } from "../providers/aiProviders";
import { isRecord, joinApiUrl } from "../../utils";

export type ChatMessage = {
  content: string;
  images?: ChatImageAttachment[];
  role: "assistant" | "system" | "user";
};

export type ChatImageAttachment = {
  dataUrl: string;
  mimeType: string;
};

export type ChatRequest = {
  body: unknown;
  headers: Record<string, string>;
  url: string;
};

export type ChatRequestOptions = {
  stream?: boolean;
  thinkingEnabled?: boolean;
  tools?: Tool[];
};

export type ChatToolCall = {
  arguments: Record<string, unknown>;
  id: string;
  name: string;
};

export type ChatToolCallDelta = {
  argumentsDelta?: string;
  id?: string;
  index: number;
  nameDelta?: string;
};

export type ChatResponse = {
  content: string;
  finishReason?: string;
  toolCalls?: ChatToolCall[];
};

export type ChatStreamEventResult = {
  contentDelta?: string;
  done?: boolean;
  finishReason?: string;
  thinkingDelta?: string;
  toolCallDeltas?: ChatToolCallDelta[];
};

export type ChatAdapter = {
  buildRequest: (config: AiProviderConfig, model: string, messages: ChatMessage[], options?: ChatRequestOptions) => ChatRequest;
  parseResponse: (body: unknown) => ChatResponse;
  parseStreamEvent: (body: unknown) => ChatStreamEventResult;
};

const anthropicVersion = "2023-06-01";
const azureApiVersion = "2024-10-21";

const defaultChatBaseUrlByApiStyle: Partial<Record<AiProviderApiStyle, string>> = {
  anthropic: "https://api.anthropic.com/v1",
  "azure-openai": "https://your-resource-name.openai.azure.com",
  google: "https://generativelanguage.googleapis.com/v1beta",
  openai: "https://api.openai.com/v1"
};

const openAiCompatibleAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const baseUrl = config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle[config.type] || "";
    if (!baseUrl) throw new Error("API URL is required.");

    return {
      body: {
        messages: messages.map(openAiCompatibleMessage),
        model,
        ...(options.stream ? { stream: true } : {}),
        ...(options.tools?.length
          ? {
              tool_choice: "auto",
              tools: options.tools.map((tool) => ({
                function: {
                  description: tool.description,
                  name: tool.name,
                  parameters: tool.parameters
                },
                type: "function"
              }))
            }
          : {}),
        temperature: 0.7
      },
      headers: {
        ...(config.apiKey?.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
        "content-type": "application/json"
      },
      url: joinApiUrl(baseUrl, "/chat/completions")
    };
  },
  parseResponse(body) {
    const record = isRecord(body) ? body : {};
    const choices = Array.isArray(record.choices) ? record.choices : [];
    const firstChoice = isRecord(choices[0]) ? choices[0] : {};
    const message = isRecord(firstChoice.message) ? firstChoice.message : {};
    const content = typeof message.content === "string" ? message.content : "";
    const toolCalls = readOpenAiCompatibleToolCalls(message);

    return {
      content,
      finishReason: normalizeFinishReason(typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : undefined),
      ...(toolCalls.length ? { toolCalls } : {})
    };
  },
  parseStreamEvent: parseOpenAiCompatibleStreamEvent
};

const deepseekAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const request = openAiCompatibleAdapter.buildRequest(config, model, messages, options);
    const body = isRecord(request.body) ? request.body : {};

    return {
      ...request,
      body: {
        ...body,
        thinking: { type: options.thinkingEnabled ? "enabled" : "disabled" }
      }
    };
  },
  parseResponse: openAiCompatibleAdapter.parseResponse,
  parseStreamEvent: openAiCompatibleAdapter.parseStreamEvent
};

const anthropicAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const systemMessage = messages.find((message) => message.role === "system");
    const nonSystemMessages = messages.filter((message) => message.role !== "system");

    return {
      body: {
        max_tokens: 4096,
        messages: nonSystemMessages.map((message) => ({
          content: anthropicMessageContent(message),
          role: message.role
        })),
        model,
        ...(options.stream ? { stream: true } : {}),
        ...(options.tools?.length
          ? {
              tools: options.tools.map((tool) => ({
                description: tool.description,
                input_schema: tool.parameters,
                name: tool.name
              }))
            }
          : {}),
        ...(systemMessage ? { system: systemMessage.content } : {})
      },
      headers: {
        "anthropic-version": anthropicVersion,
        "content-type": "application/json",
        "x-api-key": config.apiKey?.trim() ?? ""
      },
      url: joinApiUrl(config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle.anthropic!, "/messages")
    };
  },
  parseResponse(body) {
    const record = isRecord(body) ? body : {};
    const contentBlocks = Array.isArray(record.content) ? record.content : [];
    const content = contentBlocks
      .filter(isRecord)
      .map((block) => (block.type === "text" && typeof block.text === "string" ? block.text : ""))
      .join("");
    const toolCalls = contentBlocks.flatMap(readAnthropicToolCall);

    return {
      content,
      finishReason: normalizeFinishReason(typeof record.stop_reason === "string" ? record.stop_reason : undefined),
      ...(toolCalls.length ? { toolCalls } : {})
    };
  },
  parseStreamEvent(body) {
    const record = isRecord(body) ? body : {};
    if (record.type === "message_stop") return { done: true };

    if (record.type === "content_block_start") {
      const block = isRecord(record.content_block) ? record.content_block : {};
      const index = typeof record.index === "number" ? record.index : 0;
      if (block.type !== "tool_use") return {};

      return {
        toolCallDeltas: [
          {
            argumentsDelta: typeof block.input === "object" && block.input !== null ? JSON.stringify(block.input) : undefined,
            id: typeof block.id === "string" ? block.id : undefined,
            index,
            nameDelta: typeof block.name === "string" ? block.name : undefined
          }
        ]
      };
    }

    if (record.type === "content_block_delta") {
      const delta = isRecord(record.delta) ? record.delta : {};
      const index = typeof record.index === "number" ? record.index : 0;
      if (delta.type === "input_json_delta") {
        return {
          toolCallDeltas: [
            {
              argumentsDelta: typeof delta.partial_json === "string" ? delta.partial_json : undefined,
              index
            }
          ]
        };
      }

      return {
        contentDelta: typeof delta.text === "string" ? delta.text : undefined
      };
    }

    if (record.type === "message_delta") {
      const delta = isRecord(record.delta) ? record.delta : {};
      return {
        finishReason: normalizeFinishReason(typeof delta.stop_reason === "string" ? delta.stop_reason : undefined)
      };
    }

    return {};
  }
};

const azureAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const baseUrl = config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle["azure-openai"]!;

    return {
      body: {
        messages: messages.map(openAiCompatibleMessage),
        ...(options.stream ? { stream: true } : {}),
        ...(options.tools?.length
          ? {
              tool_choice: "auto",
              tools: options.tools.map((tool) => ({
                function: {
                  description: tool.description,
                  name: tool.name,
                  parameters: tool.parameters
                },
                type: "function"
              }))
            }
          : {}),
        temperature: 0.7
      },
      headers: {
        "api-key": config.apiKey?.trim() ?? "",
        "content-type": "application/json"
      },
      url: `${joinApiUrl(baseUrl, `/openai/deployments/${encodeURIComponent(model)}/chat/completions`)}?api-version=${azureApiVersion}`
    };
  },
  parseResponse: openAiCompatibleAdapter.parseResponse,
  parseStreamEvent: openAiCompatibleAdapter.parseStreamEvent
};

const googleAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const systemMessage = messages.find((message) => message.role === "system");
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        parts: googleMessageParts(message),
        role: message.role === "assistant" ? "model" : "user"
      }));
    const baseUrl = config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle.google!;
    const key = encodeURIComponent(config.apiKey?.trim() ?? "");

    return {
      body: {
        contents,
        generationConfig: { temperature: 0.7 },
        ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {})
      },
      headers: { "content-type": "application/json" },
      url: options.stream
        ? `${joinApiUrl(baseUrl, `/models/${encodeURIComponent(model)}:streamGenerateContent`)}?key=${key}&alt=sse`
        : `${joinApiUrl(baseUrl, `/models/${encodeURIComponent(model)}:generateContent`)}?key=${key}`
    };
  },
  parseResponse(body) {
    const record = isRecord(body) ? body : {};
    const candidates = Array.isArray(record.candidates) ? record.candidates : [];
    const candidate = isRecord(candidates[0]) ? candidates[0] : {};
    const content = isRecord(candidate.content) ? candidate.content : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];

    return {
      content: parts
        .filter(isRecord)
        .map((part) => (typeof part.text === "string" ? part.text : ""))
        .join("")
    };
  },
  parseStreamEvent(body) {
    const record = isRecord(body) ? body : {};
    const candidates = Array.isArray(record.candidates) ? record.candidates : [];
    const candidate = isRecord(candidates[0]) ? candidates[0] : {};
    const content = isRecord(candidate.content) ? candidate.content : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const contentDelta = parts
      .filter(isRecord)
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("");

    return {
      contentDelta: contentDelta || undefined,
      finishReason: typeof candidate.finishReason === "string" ? candidate.finishReason : undefined
    };
  }
};

const adapterByApiStyle: Record<AiProviderApiStyle, ChatAdapter> = {
  anthropic: anthropicAdapter,
  "azure-openai": azureAdapter,
  deepseek: deepseekAdapter,
  google: googleAdapter,
  groq: openAiCompatibleAdapter,
  mistral: openAiCompatibleAdapter,
  ollama: openAiCompatibleAdapter,
  openai: openAiCompatibleAdapter,
  "openai-compatible": openAiCompatibleAdapter,
  openrouter: openAiCompatibleAdapter,
  together: openAiCompatibleAdapter,
  xai: openAiCompatibleAdapter
};

export function getChatAdapter(apiStyle: AiProviderApiStyle): ChatAdapter {
  return adapterByApiStyle[apiStyle] ?? openAiCompatibleAdapter;
}

function openAiCompatibleMessage(message: ChatMessage) {
  if (!message.images?.length) return message;

  return {
    ...message,
    content: [
      { text: message.content, type: "text" },
      ...message.images.map((image) => ({
        image_url: { url: image.dataUrl },
        type: "image_url"
      }))
    ]
  };
}

function anthropicMessageContent(message: ChatMessage) {
  if (!message.images?.length) return message.content;

  return [
    { text: message.content, type: "text" },
    ...message.images.map((image) => ({
      source: {
        data: base64DataFromDataUrl(image.dataUrl),
        media_type: image.mimeType,
        type: "base64"
      },
      type: "image"
    }))
  ];
}

function googleMessageParts(message: ChatMessage) {
  return [
    { text: message.content },
    ...(message.images ?? []).map((image) => ({
      inlineData: {
        data: base64DataFromDataUrl(image.dataUrl),
        mimeType: image.mimeType
      }
    }))
  ];
}

function base64DataFromDataUrl(dataUrl: string) {
  const marker = ";base64,";
  const markerIndex = dataUrl.indexOf(marker);
  if (markerIndex < 0) return dataUrl;

  return dataUrl.slice(markerIndex + marker.length);
}

function parseOpenAiCompatibleStreamEvent(body: unknown): ChatStreamEventResult {
  if (body === "[DONE]") return { done: true };

  const record = isRecord(body) ? body : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : {};
  const delta = isRecord(firstChoice.delta) ? firstChoice.delta : {};
  const result: ChatStreamEventResult = {};
  const contentDelta = typeof delta.content === "string" && delta.content.length > 0 ? delta.content : undefined;
  const thinkingDelta = readOpenAiCompatibleThinkingDelta(delta);
  const toolCallDeltas = readOpenAiCompatibleToolCallDeltas(delta);

  if (contentDelta) result.contentDelta = contentDelta;
  if (thinkingDelta) result.thinkingDelta = thinkingDelta;
  if (toolCallDeltas.length > 0) result.toolCallDeltas = toolCallDeltas;
  if (typeof firstChoice.finish_reason === "string") result.finishReason = normalizeFinishReason(firstChoice.finish_reason);

  return result;
}

function readOpenAiCompatibleThinkingDelta(delta: Record<string, unknown>) {
  const thinkingFields = ["reasoning_content", "reasoning", "reasoning_text"];

  for (const field of thinkingFields) {
    const value = delta[field];
    if (typeof value === "string" && value.length > 0) return value;
  }

  return undefined;
}

function readOpenAiCompatibleToolCalls(message: Record<string, unknown>): ChatToolCall[] {
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  return toolCalls.flatMap((toolCall) => {
    if (!isRecord(toolCall)) return [];
    const functionPayload = isRecord(toolCall.function) ? toolCall.function : {};
    const id = typeof toolCall.id === "string" ? toolCall.id : "";
    const name = typeof functionPayload.name === "string" ? functionPayload.name : "";
    const rawArguments = typeof functionPayload.arguments === "string" ? functionPayload.arguments : "";
    if (!id || !name) return [];

    return [
      {
        arguments: parseToolArguments(rawArguments),
        id,
        name
      }
    ];
  });
}

function readOpenAiCompatibleToolCallDeltas(delta: Record<string, unknown>): ChatToolCallDelta[] {
  const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];

  return toolCalls.flatMap((toolCall) => {
    if (!isRecord(toolCall)) return [];
    const functionPayload = isRecord(toolCall.function) ? toolCall.function : {};

    return [
      {
        argumentsDelta: typeof functionPayload.arguments === "string" ? functionPayload.arguments : undefined,
        id: typeof toolCall.id === "string" ? toolCall.id : undefined,
        index: typeof toolCall.index === "number" ? toolCall.index : 0,
        nameDelta: typeof functionPayload.name === "string" ? functionPayload.name : undefined
      }
    ];
  });
}

function readAnthropicToolCall(block: unknown): ChatToolCall[] {
  if (!isRecord(block) || block.type !== "tool_use") return [];

  return [
    {
      arguments: isRecord(block.input) ? block.input : {},
      id: typeof block.id === "string" ? block.id : "",
      name: typeof block.name === "string" ? block.name : ""
    }
  ].filter((toolCall) => toolCall.id && toolCall.name);
}

function normalizeFinishReason(finishReason: string | undefined) {
  if (finishReason === "tool_calls" || finishReason === "tool_use") return "toolUse";
  return finishReason;
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

export { buildInlineAiMessages } from "./inlinePrompt";
