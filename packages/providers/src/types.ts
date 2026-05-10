export const aiProviderApiStyles = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "mistral",
  "groq",
  "openrouter",
  "together",
  "xai",
  "azure-openai",
  "openai-compatible",
  "ollama"
] as const;

export type AiProviderApiStyle = (typeof aiProviderApiStyles)[number];
export type AiModelCapability = "image" | "reasoning" | "text" | "tools" | "vision" | "web";

export type AiProviderModel = {
  capabilities: AiModelCapability[];
  enabled: boolean;
  id: string;
  name: string;
};

export type AiProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  customHeaders?: string;
  defaultModelId?: string;
  enabled: boolean;
  id: string;
  models: AiProviderModel[];
  name: string;
  type: AiProviderApiStyle;
};

export type AiProviderSettings = {
  agentDefaultModelId?: string;
  agentDefaultProviderId?: string;
  defaultModelId?: string;
  defaultProviderId?: string;
  inlineDefaultModelId?: string;
  inlineDefaultProviderId?: string;
  providers: AiProviderConfig[];
};

export type AiProviderModelSeed = Omit<AiProviderModel, "capabilities"> & {
  capability?: AiModelCapability;
  capabilities?: AiModelCapability[];
};

export type AiProviderConfigSeed = Omit<AiProviderConfig, "models"> & {
  models: AiProviderModelSeed[];
};

export function isAiProviderApiStyle(value: unknown): value is AiProviderApiStyle {
  return typeof value === "string" && aiProviderApiStyles.includes(value as AiProviderApiStyle);
}
