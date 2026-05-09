export function supportsAnthropicAdaptiveThinking(modelId: string) {
  const normalizedModel = modelId.toLowerCase();

  return (
    normalizedModel.includes("claude-mythos") ||
    normalizedModel.includes("claude-opus-4-7") ||
    normalizedModel.includes("claude-opus-4-6") ||
    normalizedModel.includes("claude-sonnet-4-6")
  );
}

export function getClaudeCompatibleThinkingRequestOptions(modelId: string, thinkingEnabled: boolean | undefined) {
  if (thinkingEnabled !== true) return {};
  if (!modelId.toLowerCase().includes("claude")) return {};

  return {
    thinking: {
      budget_tokens: 1024,
      type: "enabled"
    }
  };
}
