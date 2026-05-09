export function getDeepSeekCompatibleThinkingRequestOptions(modelId: string, thinkingEnabled: boolean | undefined) {
  if (!modelId.toLowerCase().includes("deepseek")) return {};
  if (thinkingEnabled === true) return { thinking: { type: "enabled" } };
  if (thinkingEnabled === false) return { thinking: { type: "disabled" } };

  return {};
}
