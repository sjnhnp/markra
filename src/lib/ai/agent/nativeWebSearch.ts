import type { AiModelCapability, AiProviderConfig } from "../providers/aiProviders";

export type NativeWebSearchKind =
  | "anthropic-server-tool"
  | "dashscope-enable-search"
  | "google-search-grounding"
  | "openai-responses"
  | "perplexity-sonar";

type NativeWebSearchModel = {
  capabilities?: AiModelCapability[];
  id: string;
} | string;

export function providerSupportsNativeWebSearch(provider: AiProviderConfig, model: NativeWebSearchModel) {
  return getNativeWebSearchKind(provider, model) !== null;
}

export function getNativeWebSearchKind(provider: AiProviderConfig, model: NativeWebSearchModel): NativeWebSearchKind | null {
  const normalizedBaseUrl = provider.baseUrl?.toLowerCase() ?? "";
  const normalizedProviderId = provider.id.toLowerCase();

  if (!modelSupportsConfiguredWebSearch(provider, model)) return null;

  if (provider.type === "openai") return "openai-responses";
  if (provider.type === "xai") return "openai-responses";
  if (provider.type === "anthropic") return "anthropic-server-tool";
  if (provider.type === "google") return "google-search-grounding";
  if (isDashScopeProvider(normalizedProviderId, normalizedBaseUrl)) return "dashscope-enable-search";
  if (isPerplexityProvider(normalizedProviderId, normalizedBaseUrl)) return "perplexity-sonar";

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

function isDashScopeProvider(normalizedProviderId: string, normalizedBaseUrl: string) {
  return (
    normalizedProviderId === "aliyun-bailian" ||
    normalizedBaseUrl.includes("dashscope.aliyuncs.com") ||
    normalizedBaseUrl.includes("dashscope-intl.aliyuncs.com") ||
    normalizedBaseUrl.includes("qwencloud.com")
  );
}

function isPerplexityProvider(normalizedProviderId: string, normalizedBaseUrl: string) {
  return normalizedProviderId === "perplexity" || normalizedBaseUrl.includes("api.perplexity.ai");
}
