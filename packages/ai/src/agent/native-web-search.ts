import type { AiModelCapability, AiProviderConfig } from "../providers/providers";
import { supportsMimoNativeWebSearch } from "./compatibilities/mimo";
import { getDashScopeQwenNativeWebSearchKind } from "./compatibilities/qwen";

export type NativeWebSearchKind =
  | "anthropic-server-tool"
  | "azure-openai-responses"
  | "dashscope-enable-search"
  | "dashscope-responses-tool"
  | "google-search-grounding"
  | "groq-compound"
  | "mimo-web-search-tool"
  | "openai-responses"
  | "openrouter-server-tool"
  | "perplexity-sonar";

type NativeWebSearchModel = {
  capabilities?: AiModelCapability[];
  id: string;
} | string;

export function providerSupportsNativeWebSearch(provider: AiProviderConfig, model: NativeWebSearchModel) {
  return getNativeWebSearchKind(provider, model) !== null;
}

export function getNativeWebSearchKind(provider: AiProviderConfig, model: NativeWebSearchModel): NativeWebSearchKind | null {
  const modelId = typeof model === "string" ? model : model.id;

  if (!modelSupportsConfiguredWebSearch(provider, model)) return null;

  if (provider.type === "openai") return "openai-responses";
  if (provider.type === "xai") return "openai-responses";
  if (provider.type === "anthropic") return "anthropic-server-tool";
  if (provider.type === "azure-openai") return "azure-openai-responses";
  if (provider.type === "google") return "google-search-grounding";
  if (provider.type === "groq") return "groq-compound";
  if (provider.type === "openrouter") return "openrouter-server-tool";
  const dashScopeQwenNativeWebSearchKind = getDashScopeQwenNativeWebSearchKind(provider, modelId);
  if (dashScopeQwenNativeWebSearchKind) return dashScopeQwenNativeWebSearchKind;
  if (supportsMimoNativeWebSearch(provider)) return "mimo-web-search-tool";
  if (isPerplexityProvider(provider.id.toLowerCase(), provider.baseUrl?.toLowerCase() ?? "")) return "perplexity-sonar";

  return null;
}

function modelSupportsConfiguredWebSearch(provider: AiProviderConfig, model: NativeWebSearchModel) {
  const modelId = typeof model === "string" ? model : model.id;
  const configuredCapabilities =
    typeof model === "string"
      ? provider.models.find((providerModel) => providerModel.id === modelId)?.capabilities
      : model.capabilities ?? provider.models.find((providerModel) => providerModel.id === modelId)?.capabilities;

  return configuredCapabilities?.includes("web") === true;
}

function isPerplexityProvider(normalizedProviderId: string, normalizedBaseUrl: string) {
  return normalizedProviderId === "perplexity" || normalizedBaseUrl.includes("api.perplexity.ai");
}
