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
  type: AiProviderApiStyle;
};

export type AiProviderSettings = {
  defaultModelId?: string;
  defaultProviderId?: string;
  providers: AiProviderConfig[];
};

const defaultApiUrlByApiStyle: Partial<Record<AiProviderApiStyle, string>> = {
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
    defaultModelId: "gpt-5.5",
    enabled: false,
    id: "openai",
    models: [
      { capability: "text", enabled: true, id: "gpt-5.5", name: "GPT-5.5" },
      { capability: "text", enabled: true, id: "gpt-5.4", name: "GPT-5.4" },
      { capability: "text", enabled: true, id: "gpt-5.4-mini", name: "GPT-5.4 mini" },
      { capability: "text", enabled: true, id: "gpt-5.4-nano", name: "GPT-5.4 nano" },
      { capability: "image", enabled: true, id: "gpt-image-2", name: "GPT Image 2" }
    ],
    name: "OpenAI",
    type: "openai"
  },
  {
    apiKey: "",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModelId: "claude-opus-4-7",
    enabled: false,
    id: "anthropic",
    models: [
      { capability: "text", enabled: true, id: "claude-opus-4-7", name: "Claude Opus 4.7" },
      { capability: "text", enabled: true, id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { capability: "text", enabled: true, id: "claude-haiku-4-5", name: "Claude Haiku 4.5" }
    ],
    name: "Anthropic",
    type: "anthropic"
  },
  {
    apiKey: "",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "gemini-3.1-pro-preview",
    enabled: false,
    id: "google",
    models: [
      { capability: "text", enabled: true, id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
      { capability: "text", enabled: true, id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
      { capability: "text", enabled: true, id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash-Lite Preview" }
    ],
    name: "Google",
    type: "google"
  },
  {
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    defaultModelId: "deepseek-v4-pro",
    enabled: false,
    id: "deepseek",
    models: [
      { capability: "text", enabled: true, id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { capability: "text", enabled: true, id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" }
    ],
    name: "DeepSeek",
    type: "deepseek"
  },
  {
    apiKey: "",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModelId: "mistral-medium-latest",
    enabled: false,
    id: "mistral",
    models: [
      { capability: "text", enabled: true, id: "mistral-medium-latest", name: "Mistral Medium 3.5" },
      { capability: "text", enabled: true, id: "mistral-small-latest", name: "Mistral Small 4" },
      { capability: "text", enabled: true, id: "mistral-large-latest", name: "Mistral Large 3" },
      { capability: "text", enabled: true, id: "devstral-latest", name: "Devstral 2" }
    ],
    name: "Mistral",
    type: "mistral"
  },
  {
    apiKey: "",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModelId: "groq/compound",
    enabled: false,
    id: "groq",
    models: [
      { capability: "text", enabled: true, id: "groq/compound", name: "Groq Compound" },
      { capability: "text", enabled: true, id: "groq/compound-mini", name: "Groq Compound Mini" },
      { capability: "text", enabled: true, id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
      { capability: "text", enabled: true, id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" }
    ],
    name: "Groq",
    type: "groq"
  },
  {
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModelId: "openrouter/auto",
    enabled: false,
    id: "openrouter",
    models: [
      { capability: "text", enabled: true, id: "openrouter/auto", name: "OpenRouter Auto" },
      { capability: "text", enabled: true, id: "openai/gpt-5.5", name: "GPT-5.5" },
      { capability: "text", enabled: true, id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7" },
      { capability: "text", enabled: true, id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
      { capability: "text", enabled: true, id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" }
    ],
    name: "OpenRouter",
    type: "openrouter"
  },
  {
    apiKey: "",
    baseUrl: "https://api.together.xyz/v1",
    defaultModelId: "moonshotai/Kimi-K2.5",
    enabled: false,
    id: "together",
    models: [
      {
        capability: "text",
        enabled: true,
        id: "moonshotai/Kimi-K2.5",
        name: "Kimi K2.5"
      },
      { capability: "text", enabled: true, id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
      { capability: "text", enabled: true, id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" }
    ],
    name: "Together.ai",
    type: "together"
  },
  {
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModelId: "qwen3.6-plus",
    enabled: false,
    id: "aliyun-bailian",
    models: [
      { capability: "text", enabled: true, id: "qwen3.6-plus", name: "Qwen3.6 Plus" },
      { capability: "text", enabled: true, id: "qwen3-max", name: "Qwen3 Max" },
      { capability: "text", enabled: true, id: "qwen3-coder-plus", name: "Qwen3 Coder Plus" },
      { capability: "text", enabled: true, id: "qwen3.5-flash", name: "Qwen3.5 Flash" }
    ],
    name: "Qwen",
    type: "openai-compatible"
  },
  {
    apiKey: "",
    baseUrl: "https://api.xiaomimimo.com/v1",
    defaultModelId: "mimo-v2.5-pro",
    enabled: false,
    id: "xiaomi-mimo",
    models: [
      { capability: "text", enabled: true, id: "mimo-v2.5-pro", name: "MiMo V2.5 Pro" },
      { capability: "image", enabled: true, id: "mimo-v2.5", name: "MiMo V2.5" },
      { capability: "text", enabled: true, id: "mimo-v2.5-flash", name: "MiMo V2.5 Flash" }
    ],
    name: "Xiaomi MiMo",
    type: "openai-compatible"
  },
  {
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModelId: "doubao-seed-1-6-flash-250715",
    enabled: false,
    id: "volcengine",
    models: [
      { capability: "text", enabled: true, id: "doubao-seed-1-6-flash-250715", name: "Doubao Seed 1.6 Flash" },
      { capability: "text", enabled: true, id: "doubao-seed-1-6-thinking-250715", name: "Doubao Seed 1.6 Thinking" },
      { capability: "text", enabled: true, id: "deepseek-v3-2-250915", name: "DeepSeek V3.2" },
      { capability: "text", enabled: true, id: "deepseek-r1-250528", name: "DeepSeek R1" }
    ],
    name: "Volcengine Ark",
    type: "openai-compatible"
  },
  {
    apiKey: "",
    baseUrl: "https://api.x.ai/v1",
    defaultModelId: "grok-4.3",
    enabled: false,
    id: "xai",
    models: [
      { capability: "text", enabled: true, id: "grok-4.3", name: "Grok 4.3" },
      { capability: "text", enabled: true, id: "grok-4.3-fast", name: "Grok 4.3 Fast" }
    ],
    name: "xAI",
    type: "xai"
  },
  {
    apiKey: "",
    baseUrl: "https://your-resource-name.openai.azure.com",
    defaultModelId: "gpt-5.4",
    enabled: false,
    id: "azure-openai",
    models: [
      { capability: "text", enabled: true, id: "gpt-5.4", name: "GPT-5.4 deployment" },
      { capability: "text", enabled: true, id: "gpt-5.4-mini", name: "GPT-5.4 mini deployment" },
      { capability: "text", enabled: true, id: "gpt-5.4-nano", name: "GPT-5.4 nano deployment" }
    ],
    name: "Azure OpenAI",
    type: "azure-openai"
  },
  {
    apiKey: "",
    baseUrl: "http://localhost:11434/v1",
    defaultModelId: "llama3.3",
    enabled: false,
    id: "ollama",
    models: [
      { capability: "text", enabled: true, id: "llama3.3", name: "Llama 3.3" },
      { capability: "text", enabled: true, id: "qwen3:32b", name: "Qwen3 32B" },
      { capability: "text", enabled: true, id: "gpt-oss:20b", name: "GPT-OSS 20B" }
    ],
    name: "Ollama",
    type: "ollama"
  }
];

const staleDefaultModelIdsByProviderId: Partial<Record<string, string[]>> = {
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-3-5"],
  "azure-openai": ["gpt-4o"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
  groq: ["llama-3.3-70b-versatile"],
  mistral: ["mistral-large-latest", "mistral-small-latest"],
  ollama: ["llama"],
  openai: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-image-1.5", "gpt-5", "gpt-5-mini", "gpt-4o"],
  openrouter: ["openrouter/auto"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  xai: ["grok-4"]
};

const legacyBuiltInProviderIds = new Set(["openai-compatible"]);

export function createDefaultAiSettings(): AiProviderSettings {
  return {
    defaultModelId: "gpt-5.5",
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

export function isAiProviderApiStyle(value: unknown): value is AiProviderApiStyle {
  return typeof value === "string" && aiProviderApiStyles.includes(value as AiProviderApiStyle);
}

export function defaultApiUrlForApiStyle(apiStyle: AiProviderApiStyle) {
  return defaultApiUrlByApiStyle[apiStyle] ?? "";
}

export function normalizeAiSettings(value: unknown): AiProviderSettings {
  if (!isRecord(value) || !Array.isArray(value.providers)) return createDefaultAiSettings();

  const providers = value.providers.map(normalizeProvider).filter((provider): provider is AiProviderConfig => Boolean(provider));
  if (providers.length === 0) return createDefaultAiSettings();

  const defaultProviderId =
    typeof value.defaultProviderId === "string" && providers.some((provider) => provider.id === value.defaultProviderId)
      ? value.defaultProviderId
      : providers[0]?.id;
  const selectedProvider = providers.find((provider) => provider.id === defaultProviderId) ?? providers[0];
  const storedDefaultModelId = typeof value.defaultModelId === "string" ? value.defaultModelId : "";
  const defaultModelId = selectedProvider?.models.some((model) => model.id === storedDefaultModelId)
    ? storedDefaultModelId
    : selectedProvider?.defaultModelId;

  return {
    defaultModelId,
    defaultProviderId,
    providers
  };
}

function normalizeProvider(value: unknown): AiProviderConfig | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (legacyBuiltInProviderIds.has(value.id)) return null;

  const type = isAiProviderApiStyle(value.type) ? value.type : "openai-compatible";
  const storedModels = Array.isArray(value.models)
    ? value.models.map(normalizeModel).filter((model): model is AiProviderModel => Boolean(model))
    : [];
  const defaultProvider = defaultProviderTemplateForProviderId(value.id);
  const shouldRefreshDefaultModels = shouldRefreshStoredDefaultModels(value.id, storedModels);
  const models =
    shouldRefreshDefaultModels && defaultProvider
      ? defaultProvider.models.map((model) => ({ ...model }))
      : storedModels.length > 0
        ? storedModels
        : defaultProvider?.models.map((model) => ({ ...model })) ?? [
            { capability: "text", enabled: true, id: "default", name: "Default model" }
          ];
  const storedBaseUrl = typeof value.baseUrl === "string" ? value.baseUrl : "";
  const storedDefaultModelId = typeof value.defaultModelId === "string" ? value.defaultModelId : "";
  const defaultModelId = models.some((model) => model.id === storedDefaultModelId)
    ? storedDefaultModelId
    : defaultProvider?.defaultModelId && models.some((model) => model.id === defaultProvider.defaultModelId)
      ? defaultProvider.defaultModelId
      : models[0]?.id;

  return {
    apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
    baseUrl: storedBaseUrl || defaultApiUrlForStoredProvider(value.id, type),
    defaultModelId,
    enabled: value.enabled === true,
    id: value.id,
    models,
    name: value.name,
    type
  };
}

function defaultProviderTemplateForProviderId(providerId: string) {
  return defaultProviderTemplates.find((provider) => provider.id === providerId);
}

function shouldRefreshStoredDefaultModels(providerId: string, models: AiProviderModel[]) {
  const staleModelIds = staleDefaultModelIdsByProviderId[providerId];
  if (!staleModelIds || models.length === 0 || providerId.startsWith("custom-provider-")) return false;

  const staleModelIdSet = new Set(staleModelIds);

  // Only auto-upgrade lists that still look exactly like Markra's older built-in seeds.
  return models.every((model) => staleModelIdSet.has(model.id));
}

function defaultApiUrlForStoredProvider(providerId: string, type: AiProviderApiStyle) {
  if (providerId.startsWith("custom-provider-")) return "";

  return defaultProviderTemplateForProviderId(providerId)?.baseUrl ?? defaultApiUrlForApiStyle(type);
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
