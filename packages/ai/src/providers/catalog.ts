import type { AiProviderApiStyle, AiProviderConfigSeed } from "./types";

export const defaultApiUrlByApiStyle: Partial<Record<AiProviderApiStyle, string>> = {
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

export const defaultProviderTemplates: AiProviderConfigSeed[] = [
  {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-5.5",
    enabled: false,
    id: "openai",
    models: [
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.5", name: "GPT-5.5" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.4", name: "GPT-5.4" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.4-mini", name: "GPT-5.4 mini" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.4-nano", name: "GPT-5.4 nano" },
      { capabilities: ["image"], enabled: true, id: "gpt-image-2", name: "GPT Image 2" }
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
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "claude-opus-4-7", name: "Claude Opus 4.7" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { capabilities: ["text", "vision", "reasoning", "tools"], enabled: true, id: "claude-haiku-4-5", name: "Claude Haiku 4.5" }
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
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
      {
        capabilities: ["text", "vision", "reasoning", "tools", "web"],
        enabled: true,
        id: "gemini-3.1-flash-lite-preview",
        name: "Gemini 3.1 Flash-Lite Preview"
      }
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
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" }
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
      { capabilities: ["text", "vision", "tools"], enabled: true, id: "mistral-medium-latest", name: "Mistral Medium 3.5" },
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "mistral-small-latest", name: "Mistral Small 4" },
      { capabilities: ["text", "vision", "tools"], enabled: true, id: "mistral-large-latest", name: "Mistral Large 3" },
      { capabilities: ["text", "tools"], enabled: true, id: "devstral-latest", name: "Devstral 2" }
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
      { capabilities: ["text", "tools", "web"], enabled: true, id: "groq/compound", name: "Groq Compound" },
      { capabilities: ["text", "tools", "web"], enabled: true, id: "groq/compound-mini", name: "Groq Compound Mini" },
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
      { capabilities: ["text", "tools"], enabled: true, id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" }
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
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "openrouter/auto", name: "OpenRouter Auto" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "openai/gpt-5.5", name: "GPT-5.5" },
      { capabilities: ["text", "vision", "reasoning", "tools"], enabled: true, id: "anthropic/claude-opus-4.7", name: "Claude Opus 4.7" },
      { capabilities: ["text", "vision", "reasoning", "tools"], enabled: true, id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" }
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
        capabilities: ["text", "vision", "reasoning", "tools"],
        enabled: true,
        id: "moonshotai/Kimi-K2.5",
        name: "Kimi K2.5"
      },
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1" }
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
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "qwen3.6-plus", name: "Qwen3.6 Plus" },
      { capabilities: ["text", "reasoning", "tools", "web"], enabled: true, id: "qwen3-max", name: "Qwen3 Max" },
      { capabilities: ["text", "tools"], enabled: true, id: "qwen3-coder-plus", name: "Qwen3 Coder Plus" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "qwen3.5-flash", name: "Qwen3.5 Flash" }
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
      { capabilities: ["text", "reasoning", "tools", "web"], enabled: true, id: "mimo-v2.5-pro", name: "MiMo V2.5 Pro" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "mimo-v2.5", name: "MiMo V2.5" },
      { capabilities: ["text", "tools", "web"], enabled: true, id: "mimo-v2.5-flash", name: "MiMo V2.5 Flash" }
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
      { capabilities: ["text", "vision", "reasoning", "tools"], enabled: true, id: "doubao-seed-1-6-flash-250715", name: "Doubao Seed 1.6 Flash" },
      { capabilities: ["text", "vision", "reasoning", "tools"], enabled: true, id: "doubao-seed-1-6-thinking-250715", name: "Doubao Seed 1.6 Thinking" },
      { capabilities: ["text", "reasoning", "tools"], enabled: true, id: "deepseek-v3-2-250915", name: "DeepSeek V3.2" },
      { capabilities: ["text", "reasoning"], enabled: true, id: "deepseek-r1-250528", name: "DeepSeek R1" }
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
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "grok-4.3", name: "Grok 4.3" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "grok-4.3-fast", name: "Grok 4.3 Fast" }
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
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.4", name: "GPT-5.4 deployment" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.4-mini", name: "GPT-5.4 mini deployment" },
      { capabilities: ["text", "vision", "reasoning", "tools", "web"], enabled: true, id: "gpt-5.4-nano", name: "GPT-5.4 nano deployment" }
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
      { capabilities: ["text"], enabled: true, id: "llama3.3", name: "Llama 3.3" },
      { capabilities: ["text"], enabled: true, id: "qwen3:32b", name: "Qwen3 32B" },
      { capabilities: ["text"], enabled: true, id: "gpt-oss:20b", name: "GPT-OSS 20B" }
    ],
    name: "Ollama",
    type: "ollama"
  }
];

export const staleDefaultModelIdsByProviderId: Partial<Record<string, string[]>> = {
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

export function defaultProviderTemplateForProviderId(providerId: string): AiProviderConfigSeed | undefined {
  return defaultProviderTemplates.find((provider) => provider.id === providerId);
}

export function defaultApiUrlForApiStyle(apiStyle: AiProviderApiStyle) {
  return defaultApiUrlByApiStyle[apiStyle] ?? "";
}

export function defaultApiUrlForStoredProvider(providerId: string, type: AiProviderApiStyle) {
  if (providerId.startsWith("custom-provider-")) return "";

  return defaultProviderTemplateForProviderId(providerId)?.baseUrl ?? defaultApiUrlForApiStyle(type);
}
