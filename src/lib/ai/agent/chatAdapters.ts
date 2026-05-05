import type { AiProviderApiStyle, AiProviderConfig } from "../providers/aiProviders";
import { isRecord, joinApiUrl } from "../../utils";

export type ChatMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

export type ChatRequest = {
  body: unknown;
  headers: Record<string, string>;
  url: string;
};

export type ChatResponse = {
  content: string;
  finishReason?: string;
};

export type ChatAdapter = {
  buildRequest: (config: AiProviderConfig, model: string, messages: ChatMessage[]) => ChatRequest;
  parseResponse: (body: unknown) => ChatResponse;
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
  buildRequest(config, model, messages) {
    const baseUrl = config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle[config.type] || "";
    if (!baseUrl) throw new Error("API URL is required.");

    return {
      body: {
        messages,
        model,
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

    return {
      content,
      finishReason: typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : undefined
    };
  }
};

const anthropicAdapter: ChatAdapter = {
  buildRequest(config, model, messages) {
    const systemMessage = messages.find((message) => message.role === "system");
    const nonSystemMessages = messages.filter((message) => message.role !== "system");

    return {
      body: {
        max_tokens: 4096,
        messages: nonSystemMessages.map((message) => ({
          content: message.content,
          role: message.role
        })),
        model,
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
      .map((block) => (typeof block.text === "string" ? block.text : ""))
      .join("");

    return {
      content,
      finishReason: typeof record.stop_reason === "string" ? record.stop_reason : undefined
    };
  }
};

const azureAdapter: ChatAdapter = {
  buildRequest(config, model, messages) {
    const baseUrl = config.baseUrl?.trim() || defaultChatBaseUrlByApiStyle["azure-openai"]!;

    return {
      body: {
        messages,
        temperature: 0.7
      },
      headers: {
        "api-key": config.apiKey?.trim() ?? "",
        "content-type": "application/json"
      },
      url: `${joinApiUrl(baseUrl, `/openai/deployments/${encodeURIComponent(model)}/chat/completions`)}?api-version=${azureApiVersion}`
    };
  },
  parseResponse: openAiCompatibleAdapter.parseResponse
};

const googleAdapter: ChatAdapter = {
  buildRequest(config, model, messages) {
    const systemMessage = messages.find((message) => message.role === "system");
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        parts: [{ text: message.content }],
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
      url: `${joinApiUrl(baseUrl, `/models/${encodeURIComponent(model)}:generateContent`)}?key=${key}`
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
  }
};

const adapterByApiStyle: Record<AiProviderApiStyle, ChatAdapter> = {
  anthropic: anthropicAdapter,
  "azure-openai": azureAdapter,
  deepseek: openAiCompatibleAdapter,
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

type InlineAiSuggestionContext = {
  original: string;
  replacement: string;
};

export function buildInlineAiMessages(
  prompt: string,
  selectedText: string,
  documentContent: string,
  suggestionContext?: InlineAiSuggestionContext
): ChatMessage[] {
  const trimmedSelection = selectedText.trim();
  const currentSuggestion = suggestionContext
    ? [
        "Current AI suggestion awaiting confirmation:",
        `Original text:\n${suggestionContext.original}`,
        `Suggested replacement:\n${suggestionContext.replacement}`
      ].join("\n\n")
    : null;

  return [
    {
      content:
        "You are Markra's inline writing assistant. Return only the Markdown text that should be inserted or used as the replacement. Do not wrap the answer in code fences. Do not explain the change.",
      role: "system"
    },
    {
      content: [
        `Instruction:\n${prompt.trim()}`,
        trimmedSelection ? `Selected text:\n${selectedText}` : "No text is selected. Generate text that fits at the current cursor.",
        currentSuggestion,
        `Current document:\n${documentContent}`
      ]
        .filter(Boolean)
        .join("\n\n"),
      role: "user"
    }
  ];
}
