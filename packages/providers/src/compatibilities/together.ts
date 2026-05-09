export function getTogetherThinkingRequestOptions(modelId: string, thinkingEnabled: boolean | undefined) {
  if (thinkingEnabled === undefined) return {};

  const normalizedModelId = modelId.toLowerCase();
  if (normalizedModelId.includes("gpt-oss")) {
    return thinkingEnabled ? { reasoning_effort: "high" } : {};
  }

  if (!supportsTogetherHybridReasoningToggle(normalizedModelId)) return {};

  return {
    reasoning: {
      enabled: thinkingEnabled
    }
  };
}

function supportsTogetherHybridReasoningToggle(normalizedModelId: string) {
  return (
    normalizedModelId.includes("kimi") ||
    normalizedModelId.includes("qwen") ||
    normalizedModelId.includes("glm") ||
    normalizedModelId.includes("minimax") ||
    normalizedModelId.includes("deepseek-v4") ||
    normalizedModelId.includes("deepseek-v3.1")
  );
}
