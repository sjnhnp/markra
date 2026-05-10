import { isRecord } from "@markra/shared";

import {
  defaultApiUrlForStoredProvider,
  defaultProviderTemplateForProviderId,
  defaultProviderTemplates,
  staleDefaultModelIdsByProviderId
} from "./catalog";
import { enrichAiProviderModelCapabilities, readModelCapabilities } from "./capabilities";
import {
  isAiProviderApiStyle,
  type AiProviderConfig,
  type AiProviderConfigSeed,
  type AiProviderModel,
  type AiProviderModelSeed,
  type AiProviderSettings
} from "./types";

const legacyBuiltInProviderIds = new Set(["openai-compatible"]);

export function createDefaultAiSettings(): AiProviderSettings {
  return {
    agentDefaultModelId: "gpt-5.5",
    agentDefaultProviderId: "openai",
    defaultModelId: "gpt-5.5",
    defaultProviderId: "openai",
    inlineDefaultModelId: "gpt-5.5",
    inlineDefaultProviderId: "openai",
    providers: defaultProviderTemplates.map(cloneProvider)
  };
}

export function createCustomAiProvider(index: number): AiProviderConfig {
  const providerNumber = Math.max(1, index);

  return {
    apiKey: "",
    baseUrl: "",
    customHeaders: "",
    defaultModelId: "default",
    enabled: false,
    id: `custom-provider-${providerNumber}`,
    models: [{ capabilities: ["text"], enabled: true, id: "default", name: "Default model" }],
    name: "Custom Provider",
    type: "openai-compatible"
  };
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
  const inlineDefaultProviderId =
    typeof value.inlineDefaultProviderId === "string" && providers.some((provider) => provider.id === value.inlineDefaultProviderId)
      ? value.inlineDefaultProviderId
      : defaultProviderId;
  const inlineDefaultModelId = typeof value.inlineDefaultModelId === "string" ? value.inlineDefaultModelId : defaultModelId;
  const agentDefaultProviderId =
    typeof value.agentDefaultProviderId === "string" && providers.some((provider) => provider.id === value.agentDefaultProviderId)
      ? value.agentDefaultProviderId
      : defaultProviderId;
  const agentDefaultModelId = typeof value.agentDefaultModelId === "string" ? value.agentDefaultModelId : defaultModelId;

  return {
    agentDefaultModelId,
    agentDefaultProviderId,
    defaultModelId,
    defaultProviderId,
    inlineDefaultModelId,
    inlineDefaultProviderId,
    providers
  };
}

function normalizeProvider(value: unknown): AiProviderConfig | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  const providerId = value.id;
  if (legacyBuiltInProviderIds.has(providerId)) return null;

  const type = isAiProviderApiStyle(value.type) ? value.type : "openai-compatible";
  const normalizedStoredModels = Array.isArray(value.models)
    ? value.models.map(normalizeModel).filter((model): model is AiProviderModel => Boolean(model))
    : [];
  const defaultProvider = defaultProviderTemplateForProviderId(providerId);
  const storedModels = defaultProvider
    ? normalizedStoredModels.map((model) => enrichAiProviderModelCapabilities(providerId, model))
    : normalizedStoredModels;
  const shouldRefreshDefaultModels = shouldRefreshStoredDefaultModels(providerId, storedModels);
  const models =
    shouldRefreshDefaultModels && defaultProvider
      ? defaultProvider.models.map(cloneModel)
      : storedModels.length > 0
        ? storedModels
        : defaultProvider?.models.map(cloneModel) ?? [
            { capabilities: ["text"], enabled: true, id: "default", name: "Default model" }
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
    baseUrl: storedBaseUrl || defaultApiUrlForStoredProvider(providerId, type),
    ...(typeof value.customHeaders === "string" && value.customHeaders.trim() ? { customHeaders: value.customHeaders } : {}),
    defaultModelId,
    enabled: value.enabled === true,
    id: providerId,
    models,
    name: value.name,
    type
  };
}

function shouldRefreshStoredDefaultModels(providerId: string, models: AiProviderModel[]) {
  const staleModelIds = staleDefaultModelIdsByProviderId[providerId];
  if (!staleModelIds || models.length === 0 || providerId.startsWith("custom-provider-")) return false;

  const staleModelIdSet = new Set(staleModelIds);

  // Only auto-upgrade lists that still look exactly like Markra's older built-in seeds.
  return models.every((model) => staleModelIdSet.has(model.id));
}

function normalizeModel(value: unknown): AiProviderModel | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;

  return {
    capabilities: readModelCapabilities(value),
    enabled: value.enabled !== false,
    id: value.id,
    name: value.name
  };
}

function cloneProvider(provider: AiProviderConfigSeed): AiProviderConfig {
  return {
    ...provider,
    models: provider.models.map(cloneModel)
  };
}

function cloneModel(model: AiProviderModelSeed): AiProviderModel {
  return {
    capabilities: readModelCapabilities(model),
    enabled: model.enabled,
    id: model.id,
    name: model.name
  };
}
