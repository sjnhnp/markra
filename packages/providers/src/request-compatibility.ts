import { isRecord } from "@markra/shared";

import { getClaudeCompatibleThinkingRequestOptions } from "./compatibilities/claude";
import { supportsAnthropicAdaptiveThinking } from "./compatibilities/claude";
import { getDeepSeekCompatibleThinkingRequestOptions } from "./compatibilities/deepseek";
import { getDoubaoCompatibleThinkingRequestOptions } from "./compatibilities/doubao";
import { getGeminiCompatibleThinkingRequestOptions } from "./compatibilities/gemini";
import { getGroqThinkingRequestOptions } from "./compatibilities/groq";
import { getKimiCompatibleThinkingRequestOptions } from "./compatibilities/kimi";
import { getMimoCompatibleThinkingRequestOptions, mimoWebSearchTool } from "./compatibilities/mimo";
import { getDashScopeQwenChatWebSearchRequestOptions, getQwenThinkingRequestOptions } from "./compatibilities/qwen";
import { getTogetherThinkingRequestOptions } from "./compatibilities/together";
import { getZhipuCompatibleThinkingRequestOptions } from "./compatibilities/zhipu";
import { getNativeWebSearchKind } from "./native-web-search";
import type { AiProviderConfig } from "./providers";

export type ProviderRequestFeatureOptions = {
  thinkingEnabled?: boolean;
  webSearchEnabled?: boolean;
};

export type ResponsesNativeWebSearchToolType = "openrouter:web_search" | "web_search";

export type OpenAiCompatibleRequestParts = {
  extraBody: Record<string, unknown>;
  nativeTools: Record<string, unknown>[];
};

export function buildAnthropicThinkingRequestOptions(model: string, options: ProviderRequestFeatureOptions) {
  if (!options.thinkingEnabled) return {};

  if (supportsAnthropicAdaptiveThinking(model.toLowerCase())) {
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

export function buildDeepSeekThinkingRequestOptions(options: ProviderRequestFeatureOptions) {
  return {
    thinking: { type: options.thinkingEnabled ? "enabled" : "disabled" }
  };
}

export function buildResponsesStyleRequestOptions(
  config: AiProviderConfig,
  model: string,
  nativeWebSearchToolType: ResponsesNativeWebSearchToolType,
  options: ProviderRequestFeatureOptions
) {
  const baseUrl = config.baseUrl?.trim() || "";
  const qwenRequestOptions = getQwenThinkingRequestOptions({
    baseUrl,
    id: config.id
  }, model, options.thinkingEnabled);
  if (Object.keys(qwenRequestOptions).length > 0) return qwenRequestOptions;

  const doubaoRequestOptions = getDoubaoCompatibleThinkingRequestOptions(model, options.thinkingEnabled);
  if (Object.keys(doubaoRequestOptions).length > 0) return doubaoRequestOptions;

  if (config.type === "xai" && options.thinkingEnabled === true) return { reasoning: { effort: "high" } };
  if (config.type === "xai" && options.thinkingEnabled === false) return { reasoning: { effort: "none" } };

  if (options.thinkingEnabled === false) return {};
  if (options.thinkingEnabled !== true) return {};
  if (nativeWebSearchToolType === "openrouter:web_search") return { reasoning: { effort: "high" } };

  return { reasoning: { effort: "high" } };
}

export function buildOpenAiCompatibleRequestParts(
  config: AiProviderConfig,
  model: string,
  options: ProviderRequestFeatureOptions
): OpenAiCompatibleRequestParts {
  return {
    extraBody: mergeProviderRequestOptions(
      buildOpenAiCompatibleThinkingOptions(config, model, options),
      buildOpenAiCompatibleNativeWebSearchOptions(config, model, options)
    ),
    nativeTools: buildOpenAiCompatibleNativeTools(config, model, options)
  };
}

function buildOpenAiCompatibleNativeWebSearchOptions(
  config: AiProviderConfig,
  model: string,
  options: ProviderRequestFeatureOptions
) {
  if (options.webSearchEnabled !== true) return {};
  const qwenWebSearchOptions = getDashScopeQwenChatWebSearchRequestOptions(config, model, options.webSearchEnabled);
  if (Object.keys(qwenWebSearchOptions).length > 0) return qwenWebSearchOptions;

  return {};
}

function buildOpenAiCompatibleNativeTools(
  config: AiProviderConfig,
  model: string,
  options: ProviderRequestFeatureOptions
) {
  if (options.webSearchEnabled !== true) return [];
  if (getNativeWebSearchKind(config, model) === "mimo-web-search-tool") return [mimoWebSearchTool];

  return [];
}

function buildOpenAiCompatibleThinkingOptions(config: AiProviderConfig, model: string, options: ProviderRequestFeatureOptions) {
  const thinkingEnabled = options.thinkingEnabled === true;
  const thinkingExplicitlyDisabled = options.thinkingEnabled === false;
  const normalizedModel = model.toLowerCase();

  if (config.type === "ollama" && (thinkingEnabled || thinkingExplicitlyDisabled)) {
    return { think: thinkingEnabled };
  }

  const qwenThinkingOptions = getQwenThinkingRequestOptions(config, normalizedModel, options.thinkingEnabled);
  if (Object.keys(qwenThinkingOptions).length > 0) return qwenThinkingOptions;

  if (config.type === "together") {
    return getTogetherThinkingRequestOptions(normalizedModel, options.thinkingEnabled);
  }

  if (config.type === "groq") {
    return getGroqThinkingRequestOptions(normalizedModel, options.thinkingEnabled);
  }

  if ((config.type === "mistral" || config.type === "xai") && (thinkingEnabled || thinkingExplicitlyDisabled)) {
    return { reasoning_effort: thinkingEnabled ? "high" : "none" };
  }

  const disabledThinkingRequestOptions = firstDefinedRequestOptions([
    getDeepSeekCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getDoubaoCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getKimiCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getMimoCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getZhipuCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled)
  ]);
  if (thinkingExplicitlyDisabled && disabledThinkingRequestOptions) return disabledThinkingRequestOptions;

  if (!thinkingEnabled) return {};

  if (config.type === "openrouter" || config.id === "openrouter") return { reasoning: { effort: "high" } };
  if (config.type === "mistral" || config.type === "openai" || config.type === "azure-openai" || config.type === "xai") {
    return { reasoning_effort: "high" };
  }

  const enabledThinkingRequestOptions = firstDefinedRequestOptions([
    getGeminiCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getDeepSeekCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getDoubaoCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getKimiCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getMimoCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getZhipuCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled),
    getClaudeCompatibleThinkingRequestOptions(normalizedModel, options.thinkingEnabled)
  ]);
  if (enabledThinkingRequestOptions) return enabledThinkingRequestOptions;

  return {};
}

function firstDefinedRequestOptions(candidates: Record<string, unknown>[]) {
  return candidates.find((candidate) => Object.keys(candidate).length > 0);
}

function mergeProviderRequestOptions(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...left };

  for (const [key, value] of Object.entries(right)) {
    const current = result[key];
    result[key] = isPlainRecord(current) && isPlainRecord(value) ? mergeProviderRequestOptions(current, value) : value;
  }

  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}
