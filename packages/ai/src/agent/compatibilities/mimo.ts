type MimoProviderIdentity = {
  baseUrl?: string;
  id: string;
};

export const mimoWebSearchTool = {
  force_search: true,
  type: "web_search"
} as const;

export function supportsMimoNativeWebSearch(provider: MimoProviderIdentity) {
  const normalizedBaseUrl = provider.baseUrl?.toLowerCase() ?? "";

  return normalizedBaseUrl.includes("api.xiaomimimo.com/v1");
}

export function getMimoCompatibleThinkingRequestOptions(modelId: string, thinkingEnabled: boolean | undefined) {
  if (!modelId.toLowerCase().includes("mimo")) return {};
  if (thinkingEnabled === true) return { thinking: { type: "enabled" } };
  if (thinkingEnabled === false) return { thinking: { type: "disabled" } };

  return {};
}
