export function getGroqThinkingRequestOptions(modelId: string, thinkingEnabled: boolean | undefined) {
  if (thinkingEnabled === undefined) return {};

  const normalizedModelId = modelId.toLowerCase();
  if (normalizedModelId.includes("gpt-oss")) {
    return thinkingEnabled
      ? {
          reasoning_effort: "high",
          reasoning_format: "parsed"
        }
      : {
          reasoning_format: "hidden"
        };
  }

  if (normalizedModelId.includes("qwen")) {
    return thinkingEnabled
      ? {
          reasoning_effort: "default",
          reasoning_format: "parsed"
        }
      : {
          reasoning_effort: "none",
          reasoning_format: "hidden"
        };
  }

  return {};
}
