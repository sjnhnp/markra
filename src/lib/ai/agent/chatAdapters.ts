import type { Tool } from "@mariozechner/pi-ai";
import type { AiProviderApiStyle, AiProviderConfig } from "../providers/aiProviders";
import { readAiProviderCustomHeaders } from "../providers/aiProviders";
import { isRecord, joinApiUrl } from "../../utils";
import { getNativeWebSearchKind } from "./nativeWebSearch";

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
  webSearchEnabled?: boolean;
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
    if (usesOpenAiResponsesNativeWebSearch(config, model, options)) {
      return buildOpenAiResponsesRequest(config, model, messages, options, baseUrl);
    }

    const body = mergeChatRequestBody(
      {
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
      mergeChatRequestBody(
        openAiCompatibleThinkingOptions(config, model, options),
        openAiCompatibleNativeWebSearchOptions(config, model, options)
      )
    );

    return {
      body,
      headers: {
        ...(config.apiKey?.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
        "content-type": "application/json",
        ...readAiProviderCustomHeaders(config)
      },
      url: joinApiUrl(baseUrl, "/chat/completions")
    };
  },
  parseResponse(body) {
    if (isOpenAiResponsesBody(body)) return parseOpenAiResponsesResponse(body);

    const record = isRecord(body) ? body : {};
    const choices = Array.isArray(record.choices) ? record.choices : [];
    const firstChoice = isRecord(choices[0]) ? choices[0] : {};
    const message = isRecord(firstChoice.message) ? firstChoice.message : {};
    const content = readOpenAiCompatibleContentDeltas(message.content).contentDelta ?? "";
    const toolCalls = readOpenAiCompatibleToolCalls(message);

    return {
      content,
      finishReason: normalizeFinishReason(typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : undefined),
      ...(toolCalls.length ? { toolCalls } : {})
    };
  },
  parseStreamEvent(body) {
    if (isOpenAiResponsesStreamEvent(body)) return parseOpenAiResponsesStreamEvent(body);

    return parseOpenAiCompatibleStreamEvent(body);
  }
};

function usesOpenAiResponsesNativeWebSearch(config: AiProviderConfig, model: string, options: ChatRequestOptions) {
  return options.webSearchEnabled === true && getNativeWebSearchKind(config, model) === "openai-responses";
}

function buildOpenAiResponsesRequest(
  config: AiProviderConfig,
  model: string,
  messages: ChatMessage[],
  options: ChatRequestOptions,
  baseUrl: string
): ChatRequest {
  const body = mergeChatRequestBody(
    {
      input: openAiResponsesInputMessages(messages),
      ...(openAiResponsesInstructions(messages) ? { instructions: openAiResponsesInstructions(messages) } : {}),
      model,
      ...(options.stream ? { stream: true } : {}),
      tools: [
        { type: "web_search" },
        ...(options.tools ?? []).map((tool) => ({
          description: tool.description,
          name: tool.name,
          parameters: tool.parameters,
          type: "function"
        }))
      ]
    },
    openAiResponsesThinkingOptions(config, options)
  );

  return {
    body,
    headers: {
      ...(config.apiKey?.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
      "content-type": "application/json",
      ...readAiProviderCustomHeaders(config)
    },
    url: joinApiUrl(baseUrl, "/responses")
  };
}

function openAiResponsesInstructions(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

function openAiResponsesInputMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      content: openAiResponsesMessageContent(message),
      role: message.role
    }));
}

function openAiResponsesMessageContent(message: ChatMessage) {
  if (message.role === "assistant" && !message.images?.length) return message.content;

  return [
    { text: message.content, type: "input_text" },
    ...(message.images ?? []).map((image) => ({
      image_url: image.dataUrl,
      type: "input_image"
    }))
  ];
}

function openAiResponsesThinkingOptions(config: AiProviderConfig, options: ChatRequestOptions) {
  if (!options.thinkingEnabled || (config.type !== "openai" && config.type !== "xai")) return {};

  return { reasoning: { effort: "high" } };
}

function openAiCompatibleNativeWebSearchOptions(config: AiProviderConfig, model: string, options: ChatRequestOptions) {
  if (options.webSearchEnabled !== true) return {};
  if (getNativeWebSearchKind(config, model) === "dashscope-enable-search") return { enable_search: true };

  return {};
}

function openAiCompatibleThinkingOptions(config: AiProviderConfig, model: string, options: ChatRequestOptions) {
  const thinkingEnabled = options.thinkingEnabled === true;
  const thinkingExplicitlyDisabled = options.thinkingEnabled === false;
  const normalizedModel = model.toLowerCase();

  if (isDashScopeQwenRequest(config, normalizedModel) && (thinkingEnabled || thinkingExplicitlyDisabled)) {
    return { enable_thinking: thinkingEnabled };
  }

  if (config.type === "ollama" && (thinkingEnabled || thinkingExplicitlyDisabled)) {
    return { think: thinkingEnabled };
  }

  if (thinkingExplicitlyDisabled && isQwenCompatibleModel(normalizedModel)) {
    return { chat_template_kwargs: { enable_thinking: false } };
  }

  if (thinkingExplicitlyDisabled && (isDeepSeekCompatibleModel(normalizedModel) || isThinkingTypeCompatibleModel(normalizedModel))) {
    return { thinking: { type: "disabled" } };
  }

  if (!thinkingEnabled) return {};

  if (config.type === "openrouter" || config.id === "openrouter") return { reasoning: { effort: "high" } };
  if (config.type === "groq") return { reasoning_format: "parsed" };
  if (config.type === "mistral" || config.type === "openai" || config.type === "azure-openai" || config.type === "xai") {
    return { reasoning_effort: "high" };
  }
  if (config.type === "together") return { reasoning: { enabled: true }, reasoning_effort: "high" };
  if (isGeminiCompatibleModel(normalizedModel)) {
    return {
      extra_body: {
        google: {
          thinking_config: {
            include_thoughts: true,
            thinking_budget: -1
          }
        }
      }
    };
  }
  if (isQwenCompatibleModel(normalizedModel)) return { chat_template_kwargs: { enable_thinking: true } };
  if (isDeepSeekCompatibleModel(normalizedModel) || isThinkingTypeCompatibleModel(normalizedModel)) {
    return { thinking: { type: "enabled" } };
  }
  if (isClaudeCompatibleModel(normalizedModel)) {
    return { thinking: { budget_tokens: 1024, type: "enabled" } };
  }

  return {};
}

function isDashScopeQwenRequest(config: AiProviderConfig, normalizedModel: string) {
  const baseUrl = config.baseUrl?.toLowerCase() ?? "";

  return (config.id === "aliyun-bailian" || baseUrl.includes("dashscope.aliyuncs.com")) && isQwenCompatibleModel(normalizedModel);
}

function isQwenCompatibleModel(normalizedModel: string) {
  return normalizedModel.includes("qwen");
}

function isGeminiCompatibleModel(normalizedModel: string) {
  return normalizedModel.includes("gemini");
}

function isDeepSeekCompatibleModel(normalizedModel: string) {
  return normalizedModel.includes("deepseek");
}

function isClaudeCompatibleModel(normalizedModel: string) {
  return normalizedModel.includes("claude");
}

function isThinkingTypeCompatibleModel(normalizedModel: string) {
  return (
    normalizedModel.includes("doubao") ||
    normalizedModel.includes("kimi") ||
    normalizedModel.includes("mimo") ||
    normalizedModel.includes("zhipu")
  );
}

const deepseekAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const request = openAiCompatibleAdapter.buildRequest(config, model, messages, {
      stream: options.stream,
      tools: options.tools
    });
    const body = isRecord(request.body) ? request.body : {};

    return {
      ...request,
      body: mergeChatRequestBody(body, deepseekThinkingOptions(options))
    };
  },
  parseResponse: openAiCompatibleAdapter.parseResponse,
  parseStreamEvent: openAiCompatibleAdapter.parseStreamEvent
};

function deepseekThinkingOptions(options: ChatRequestOptions) {
  return {
    thinking: { type: options.thinkingEnabled ? "enabled" : "disabled" }
  };
}

const anthropicAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const systemMessage = messages.find((message) => message.role === "system");
    const nonSystemMessages = messages.filter((message) => message.role !== "system");
    const tools = anthropicTools(config, model, options);
    const body = mergeChatRequestBody(
      {
        max_tokens: 4096,
        messages: nonSystemMessages.map((message) => ({
          content: anthropicMessageContent(message),
          role: message.role
        })),
        model,
        ...(options.stream ? { stream: true } : {}),
        ...(tools.length ? { tools } : {}),
        ...(systemMessage ? { system: systemMessage.content } : {})
      },
      anthropicThinkingOptions(model, options)
    );

    return {
      body,
      headers: {
        "anthropic-version": anthropicVersion,
        "content-type": "application/json",
        "x-api-key": config.apiKey?.trim() ?? "",
        ...readAiProviderCustomHeaders(config)
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
      if (delta.type === "thinking_delta") {
        const thinkingDelta = typeof delta.thinking === "string" ? delta.thinking : undefined;
        return thinkingDelta ? { thinkingDelta } : {};
      }

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

      const contentDelta = typeof delta.text === "string" ? delta.text : undefined;
      return contentDelta ? { contentDelta } : {};
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

function anthropicTools(config: AiProviderConfig, model: string, options: ChatRequestOptions) {
  return [
    ...(options.webSearchEnabled === true && getNativeWebSearchKind(config, model) === "anthropic-server-tool"
      ? [{ max_uses: 5, name: "web_search", type: "web_search_20250305" }]
      : []),
    ...(options.tools ?? []).map((tool) => ({
      description: tool.description,
      input_schema: tool.parameters,
      name: tool.name
    }))
  ];
}

function anthropicThinkingOptions(model: string, options: ChatRequestOptions) {
  if (!options.thinkingEnabled) return {};

  if (supportsAnthropicAdaptiveThinking(model)) {
    return {
      thinking: {
        display: "summarized",
        type: "adaptive"
      }
    };
  }

  return {
    thinking: {
      budget_tokens: 1024,
      type: "enabled"
    }
  };
}

function supportsAnthropicAdaptiveThinking(model: string) {
  const normalizedModel = model.toLowerCase();

  return (
    normalizedModel.includes("claude-mythos") ||
    normalizedModel.includes("claude-opus-4-7") ||
    normalizedModel.includes("claude-opus-4-6") ||
    normalizedModel.includes("claude-sonnet-4-6")
  );
}

const azureAdapter: ChatAdapter = {
  buildRequest(config, model, messages, options = {}) {
    const baseUrl = config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle["azure-openai"]!;
    const body = mergeChatRequestBody(
      {
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
      openAiCompatibleThinkingOptions(config, model, options)
    );

    return {
      body,
      headers: {
        "api-key": config.apiKey?.trim() ?? "",
        "content-type": "application/json",
        ...readAiProviderCustomHeaders(config)
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
    const tools = googleTools(config, model, options);
    const body = mergeChatRequestBody(
      {
        contents,
        generationConfig: {
          temperature: 0.7
        },
        ...(tools.length ? { tools } : {}),
        ...(systemMessage ? { systemInstruction: { parts: [{ text: systemMessage.content }] } } : {})
      },
      googleThinkingOptions(options)
    );

    return {
      body,
      headers: { "content-type": "application/json", ...readAiProviderCustomHeaders(config) },
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
        .map((part) => (part.thought === true ? "" : typeof part.text === "string" ? part.text : ""))
        .join("")
    };
  },
  parseStreamEvent(body) {
    const record = isRecord(body) ? body : {};
    const candidates = Array.isArray(record.candidates) ? record.candidates : [];
    const candidate = isRecord(candidates[0]) ? candidates[0] : {};
    const content = isRecord(candidate.content) ? candidate.content : {};
    const parts = Array.isArray(content.parts) ? content.parts : [];
    const { contentDelta, thinkingDelta } = readGoogleTextParts(parts);
    const result: ChatStreamEventResult = {};

    if (contentDelta) result.contentDelta = contentDelta;
    if (thinkingDelta) result.thinkingDelta = thinkingDelta;
    if (typeof candidate.finishReason === "string") result.finishReason = candidate.finishReason;

    return result;
  }
};

function googleTools(config: AiProviderConfig, model: string, options: ChatRequestOptions) {
  return options.webSearchEnabled === true && getNativeWebSearchKind(config, model) === "google-search-grounding"
    ? [{ google_search: {} }]
    : [];
}

function googleThinkingOptions(options: ChatRequestOptions) {
  return options.thinkingEnabled
    ? {
        generationConfig: {
          thinkingConfig: { includeThoughts: true }
        }
      }
    : {};
}

function readGoogleTextParts(parts: unknown[]) {
  let contentDelta = "";
  let thinkingDelta = "";

  for (const part of parts) {
    if (!isRecord(part) || typeof part.text !== "string") continue;

    if (part.thought === true) {
      thinkingDelta += part.text;
    } else {
      contentDelta += part.text;
    }
  }

  return { contentDelta, thinkingDelta };
}

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

function mergeChatRequestBody(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const current = result[key];
    result[key] = isPlainRecord(current) && isPlainRecord(value) ? mergeChatRequestBody(current, value) : value;
  }

  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
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

function isOpenAiResponsesBody(body: unknown) {
  return isRecord(body) && (body.object === "response" || Array.isArray(body.output));
}

function parseOpenAiResponsesResponse(body: unknown): ChatResponse {
  const record = isRecord(body) ? body : {};
  const output = Array.isArray(record.output) ? record.output : [];
  const content = output
    .filter(isRecord)
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter(isRecord)
    .map((item) => (item.type === "output_text" && typeof item.text === "string" ? item.text : ""))
    .join("");
  const toolCalls = output.flatMap(readOpenAiResponsesToolCall);

  return {
    content,
    ...(typeof record.status === "string" ? { finishReason: record.status } : {}),
    ...(toolCalls.length ? { toolCalls } : {})
  };
}

function readOpenAiResponsesToolCall(item: unknown): ChatToolCall[] {
  if (!isRecord(item) || item.type !== "function_call") return [];

  const id = typeof item.call_id === "string" ? item.call_id : typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? item.name : "";
  const rawArguments = typeof item.arguments === "string" ? item.arguments : "";
  if (!id || !name) return [];

  return [
    {
      arguments: parseToolArguments(rawArguments),
      id,
      name
    }
  ];
}

function isOpenAiResponsesStreamEvent(body: unknown) {
  return isRecord(body) && typeof body.type === "string" && body.type.startsWith("response.");
}

function parseOpenAiResponsesStreamEvent(body: unknown): ChatStreamEventResult {
  const record = isRecord(body) ? body : {};
  if (record.type === "response.output_text.delta") {
    const contentDelta = typeof record.delta === "string" ? record.delta : undefined;
    return contentDelta ? { contentDelta } : {};
  }
  if (record.type === "response.output_item.added") {
    const item = isRecord(record.item) ? record.item : {};
    if (item.type !== "function_call") return {};

    return {
      toolCallDeltas: [
        {
          id: typeof item.call_id === "string" ? item.call_id : typeof item.id === "string" ? item.id : undefined,
          index: typeof record.output_index === "number" ? record.output_index : 0,
          nameDelta: typeof item.name === "string" ? item.name : undefined
        }
      ]
    };
  }
  if (record.type === "response.function_call_arguments.delta") {
    return {
      toolCallDeltas: [
        {
          argumentsDelta: typeof record.delta === "string" ? record.delta : undefined,
          index: typeof record.output_index === "number" ? record.output_index : 0
        }
      ]
    };
  }
  if (record.type === "response.completed") return { finishReason: "stop" };
  if (record.type === "response.failed") return { finishReason: "error" };

  return {};
}

function parseOpenAiCompatibleStreamEvent(body: unknown): ChatStreamEventResult {
  if (body === "[DONE]") return { done: true };

  const record = isRecord(body) ? body : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : {};
  const delta = isRecord(firstChoice.delta) ? firstChoice.delta : {};
  const result: ChatStreamEventResult = {};
  const contentDeltas = readOpenAiCompatibleContentDeltas(delta.content);
  const thinkingDelta = readOpenAiCompatibleThinkingDelta(delta) ?? contentDeltas.thinkingDelta;
  const toolCallDeltas = readOpenAiCompatibleToolCallDeltas(delta);

  if (contentDeltas.contentDelta) result.contentDelta = contentDeltas.contentDelta;
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

function readOpenAiCompatibleContentDeltas(value: unknown) {
  if (typeof value === "string") return { contentDelta: value };
  if (!Array.isArray(value)) return {};

  const contentDelta = value.filter(isRecord).map(readOpenAiCompatibleTextChunk).join("");
  const thinkingDelta = value.filter(isRecord).map(readOpenAiCompatibleThinkingChunk).join("");

  return {
    ...(contentDelta ? { contentDelta } : {}),
    ...(thinkingDelta ? { thinkingDelta } : {})
  };
}

function readOpenAiCompatibleTextChunk(chunk: Record<string, unknown>) {
  if (chunk.type === "thinking" || chunk.type === "reasoning") return "";
  if (typeof chunk.text === "string") return chunk.text;
  if (typeof chunk.content === "string") return chunk.content;

  return "";
}

function readOpenAiCompatibleThinkingChunk(chunk: Record<string, unknown>) {
  if (chunk.type !== "thinking" && chunk.type !== "reasoning") return "";

  return readNestedText(chunk.thinking ?? chunk.reasoning ?? chunk.text ?? chunk.content);
}

function readNestedText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .filter(isRecord)
    .map((item) => readNestedText(item.text ?? item.content ?? item.thinking ?? item.reasoning))
    .join("");
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
