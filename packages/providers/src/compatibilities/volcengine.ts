type VolcengineProviderIdentity = {
  baseUrl?: string;
  id: string;
};

export function isVolcengineArkProvider(provider: VolcengineProviderIdentity) {
  const normalizedProviderId = provider.id.toLowerCase();
  const normalizedBaseUrl = provider.baseUrl?.toLowerCase() ?? "";

  return normalizedProviderId === "volcengine" || normalizedBaseUrl.includes("ark.cn-beijing.volces.com/api/v3");
}

export function supportsVolcengineNativeWebSearch(provider: VolcengineProviderIdentity, modelId: string) {
  return isVolcengineArkProvider(provider) && modelId.toLowerCase().startsWith("doubao-seed-1-6");
}
