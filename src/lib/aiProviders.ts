export const aiProviderTypes = [
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

export type AiProviderType = (typeof aiProviderTypes)[number];
export type AiModelCapability = "audio" | "embedding" | "image" | "moderation" | "rerank" | "text" | "video";

export type AiProviderModel = {
  capability: AiModelCapability;
  enabled: boolean;
  id: string;
  name: string;
};

export type AiProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  defaultModelId?: string;
  enabled: boolean;
  id: string;
  models: AiProviderModel[];
  name: string;
  type: AiProviderType;
};

export type AiProviderSettings = {
  defaultModelId?: string;
  defaultProviderId?: string;
  providers: AiProviderConfig[];
};

const defaultApiUrlByProviderType: Partial<Record<AiProviderType, string>> = {
  anthropic: "https://api.anthropic.com/v1",
  "azure-openai": "https://your-resource-name.openai.azure.com",
  deepseek: "https://api.deepseek.com",
  google: "https://generativelanguage.googleapis.com/v1beta",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  ollama: "http://localhost:11434/v1",
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  together: "https://api.together.xyz/v1",
  xai: "https://api.x.ai/v1"
};

const defaultProviderTemplates: AiProviderConfig[] = [
  {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-5",
    enabled: false,
    id: "openai",
    models: [
      { capability: "text", enabled: true, id: "gpt-5", name: "GPT-5" },
      { capability: "text", enabled: true, id: "gpt-5-mini", name: "GPT-5 mini" },
      { capability: "text", enabled: true, id: "gpt-4o", name: "GPT-4o" }
    ],
    name: "OpenAI",
    type: "openai"
  },
  {
    apiKey: "",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModelId: "claude-sonnet-4-5",
    enabled: false,
    id: "anthropic",
    models: [
      { capability: "text", enabled: true, id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { capability: "text", enabled: true, id: "claude-haiku-3-5", name: "Claude Haiku 3.5" }
    ],
    name: "Anthropic",
    type: "anthropic"
  },
  {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "gemini-2.5-flash",
    enabled: false,
    id: "google",
    models: [
      { capability: "text", enabled: true, id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { capability: "text", enabled: true, id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }
    ],
    name: "Google",
    type: "google"
  },
  {
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    defaultModelId: "deepseek-chat",
    enabled: false,
    id: "deepseek",
    models: [
      { capability: "text", enabled: true, id: "deepseek-chat", name: "DeepSeek Chat" },
      { capability: "text", enabled: true, id: "deepseek-reasoner", name: "DeepSeek Reasoner" }
    ],
    name: "DeepSeek",
    type: "deepseek"
  },
  {
    apiKey: "",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModelId: "mistral-large-latest",
    enabled: false,
    id: "mistral",
    models: [
      { capability: "text", enabled: true, id: "mistral-large-latest", name: "Mistral Large" },
      { capability: "text", enabled: true, id: "mistral-small-latest", name: "Mistral Small" }
    ],
    name: "Mistral",
    type: "mistral"
  },
  {
    apiKey: "",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModelId: "llama-3.3-70b-versatile",
    enabled: false,
    id: "groq",
    models: [{ capability: "text", enabled: true, id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" }],
    name: "Groq",
    type: "groq"
  },
  {
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModelId: "openrouter/auto",
    enabled: false,
    id: "openrouter",
    models: [{ capability: "text", enabled: true, id: "openrouter/auto", name: "OpenRouter Auto" }],
    name: "OpenRouter",
    type: "openrouter"
  },
  {
    apiKey: "",
    baseUrl: "https://api.together.xyz/v1",
    defaultModelId: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    enabled: false,
    id: "together",
    models: [
      {
        capability: "text",
        enabled: true,
        id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        name: "Llama 3.3 70B Instruct Turbo"
      }
    ],
    name: "Together.ai",
    type: "together"
  },
  {
    apiKey: "",
    baseUrl: "https://api.x.ai/v1",
    defaultModelId: "grok-4",
    enabled: false,
    id: "xai",
    models: [{ capability: "text", enabled: true, id: "grok-4", name: "Grok 4" }],
    name: "xAI",
    type: "xai"
  },
  {
    apiKey: "",
    baseUrl: "https://your-resource-name.openai.azure.com",
    defaultModelId: "gpt-4o",
    enabled: false,
    id: "azure-openai",
    models: [{ capability: "text", enabled: true, id: "gpt-4o", name: "GPT-4o deployment" }],
    name: "Azure OpenAI",
    type: "azure-openai"
  },
  {
    apiKey: "",
    baseUrl: "",
    defaultModelId: "default",
    enabled: false,
    id: "openai-compatible",
    models: [{ capability: "text", enabled: true, id: "default", name: "Default model" }],
    name: "OpenAI Compatible",
    type: "openai-compatible"
  },
  {
    apiKey: "",
    baseUrl: "http://localhost:11434/v1",
    defaultModelId: "llama",
    enabled: false,
    id: "ollama",
    models: [{ capability: "text", enabled: true, id: "llama", name: "Llama" }],
    name: "Ollama",
    type: "ollama"
  }
];

export function createDefaultAiSettings(): AiProviderSettings {
  return {
    defaultModelId: "gpt-5",
    defaultProviderId: "openai",
    providers: defaultProviderTemplates.map(cloneProvider)
  };
}

export function createCustomAiProvider(index: number): AiProviderConfig {
  const providerNumber = Math.max(1, index);

  return {
    apiKey: "",
    baseUrl: "",
    defaultModelId: "default",
    enabled: false,
    id: `custom-provider-${providerNumber}`,
    models: [{ capability: "text", enabled: true, id: "default", name: "Default model" }],
    name: "Custom Provider",
    type: "openai-compatible"
  };
}

export function isAiProviderType(value: unknown): value is AiProviderType {
  return typeof value === "string" && aiProviderTypes.includes(value as AiProviderType);
}

export function defaultApiUrlForProviderType(type: AiProviderType) {
  return defaultApiUrlByProviderType[type] ?? "";
}

export function normalizeAiSettings(value: unknown): AiProviderSettings {
  if (!isRecord(value) || !Array.isArray(value.providers)) return createDefaultAiSettings();

  const providers = value.providers.map(normalizeProvider).filter((provider): provider is AiProviderConfig => Boolean(provider));
  if (providers.length === 0) return createDefaultAiSettings();

  const defaultProviderId =
    typeof value.defaultProviderId === "string" && providers.some((provider) => provider.id === value.defaultProviderId)
      ? value.defaultProviderId
      : providers[0]?.id;
  const defaultModelId = typeof value.defaultModelId === "string" ? value.defaultModelId : providers[0]?.defaultModelId;

  return {
    defaultModelId,
    defaultProviderId,
    providers
  };
}

function normalizeProvider(value: unknown): AiProviderConfig | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;

  const type = isAiProviderType(value.type) ? value.type : "openai-compatible";
  const models = Array.isArray(value.models)
    ? value.models.map(normalizeModel).filter((model): model is AiProviderModel => Boolean(model))
    : [];
  const storedBaseUrl = typeof value.baseUrl === "string" ? value.baseUrl : "";

  return {
    apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
    baseUrl: storedBaseUrl || defaultApiUrlForStoredProvider(value.id, type),
    defaultModelId: typeof value.defaultModelId === "string" ? value.defaultModelId : models[0]?.id,
    enabled: value.enabled === true,
    id: value.id,
    models: models.length > 0 ? models : [{ capability: "text", enabled: true, id: "default", name: "Default model" }],
    name: value.name,
    type
  };
}

function defaultApiUrlForStoredProvider(providerId: string, type: AiProviderType) {
  return providerId.startsWith("custom-provider-") ? "" : defaultApiUrlForProviderType(type);
}

function normalizeModel(value: unknown): AiProviderModel | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;

  return {
    capability: isAiModelCapability(value.capability) ? value.capability : "text",
    enabled: value.enabled !== false,
    id: value.id,
    name: value.name
  };
}

function cloneProvider(provider: AiProviderConfig): AiProviderConfig {
  return {
    ...provider,
    models: provider.models.map((model) => ({ ...model }))
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAiModelCapability(value: unknown): value is AiModelCapability {
  return (
    value === "audio" ||
    value === "embedding" ||
    value === "image" ||
    value === "moderation" ||
    value === "rerank" ||
    value === "text" ||
    value === "video"
  );
}
