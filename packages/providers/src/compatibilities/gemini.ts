export function getGeminiCompatibleThinkingRequestOptions(modelId: string, thinkingEnabled: boolean | undefined) {
  if (thinkingEnabled !== true) return {};
  if (!modelId.toLowerCase().includes("gemini")) return {};

  return {
    extra_body: {
      google: {
        thinking_config: {
          include_thoughts: true,
          thinking_budget: -1
        }
      }
    }
  };
}
