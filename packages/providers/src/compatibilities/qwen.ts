import type { AiProviderConfig } from "../providers";

type ProviderIdentity = Pick<AiProviderConfig, "baseUrl" | "id">;

export type DashScopeQwenNativeWebSearchKind = "dashscope-enable-search" | "dashscope-responses-tool";

export function isQwenCompatibleModel(modelId: string) {
  return modelId.toLowerCase().includes("qwen");
}

export function isDashScopeProvider(provider: ProviderIdentity) {
  const normalizedProviderId = provider.id.toLowerCase();
  const normalizedBaseUrl = provider.baseUrl?.toLowerCase() ?? "";

  return (
    normalizedProviderId === "aliyun-bailian" ||
    normalizedBaseUrl.includes("dashscope.aliyuncs.com") ||
    normalizedBaseUrl.includes("dashscope-intl.aliyuncs.com") ||
    normalizedBaseUrl.includes("dashscope-us.aliyuncs.com") ||
    normalizedBaseUrl.includes("qwencloud.com")
  );
}

export function isDashScopeQwenRequest(provider: ProviderIdentity, modelId: string) {
  return isDashScopeProvider(provider) && isQwenCompatibleModel(modelId);
}

export function getDashScopeQwenNativeWebSearchKind(
  provider: ProviderIdentity,
  modelId: string
): DashScopeQwenNativeWebSearchKind | null {
  if (!isDashScopeProvider(provider)) return null;

  return supportsDashScopeResponsesWebSearch(modelId) ? "dashscope-responses-tool" : "dashscope-enable-search";
}

export function getDashScopeQwenChatWebSearchRequestOptions(provider: ProviderIdentity, modelId: string, webSearchEnabled: boolean | undefined) {
  if (webSearchEnabled !== true) return {};
  if (getDashScopeQwenNativeWebSearchKind(provider, modelId) !== "dashscope-enable-search") return {};

  return {
    enable_search: true,
    search_options: {
      forced_search: true,
      search_strategy: "max"
    }
  };
}

export function getQwenThinkingRequestOptions(
  provider: ProviderIdentity,
  modelId: string,
  thinkingEnabled: boolean | undefined
) {
  const thinkingExplicitlyDisabled = thinkingEnabled === false;
  const thinkingExplicitlyEnabled = thinkingEnabled === true;

  if (isDashScopeQwenRequest(provider, modelId) && (thinkingExplicitlyEnabled || thinkingExplicitlyDisabled)) {
    return { enable_thinking: thinkingExplicitlyEnabled };
  }

  if (thinkingExplicitlyDisabled && isQwenCompatibleModel(modelId)) {
    return { chat_template_kwargs: { enable_thinking: false } };
  }

  if (thinkingExplicitlyEnabled && isQwenCompatibleModel(modelId)) {
    return { chat_template_kwargs: { enable_thinking: true } };
  }

  return {};
}

function supportsDashScopeResponsesWebSearch(modelId: string) {
  const normalizedModelId = modelId.toLowerCase();

  return (
    normalizedModelId === "qwen3.6-plus" ||
    normalizedModelId.startsWith("qwen3.6-plus-") ||
    normalizedModelId === "qwen3.6-flash" ||
    normalizedModelId.startsWith("qwen3.6-flash-")
  );
}
