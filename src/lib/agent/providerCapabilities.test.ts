import { getProviderCapabilities } from "./providerCapabilities";

describe("AI provider capabilities", () => {
  it("uses api-style defaults and provider-level overrides", () => {
    expect(getProviderCapabilities("custom-provider-1", "openai-compatible")).toEqual({
      chat: true,
      modelList: false,
      streaming: true,
      toolCalling: false
    });
    expect(getProviderCapabilities("aliyun-bailian", "openai-compatible")).toEqual({
      chat: true,
      modelList: true,
      streaming: true,
      toolCalling: false
    });
    expect(getProviderCapabilities("volcengine", "openai-compatible").modelList).toBe(true);
    expect(getProviderCapabilities("xiaomi-mimo", "openai-compatible").modelList).toBe(true);
    expect(getProviderCapabilities("azure-openai", "azure-openai")).toEqual({
      chat: true,
      modelList: false,
      streaming: true,
      toolCalling: true
    });
    expect(getProviderCapabilities("ollama", "ollama").toolCalling).toBe(false);
  });
});
