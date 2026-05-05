import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getStoredAiSettings,
  saveStoredAiSettings,
  type AiProviderConfig,
  type AiProviderModel,
  type AiProviderSettings
} from "../lib/settings/appSettings";

export type AvailableAiTextModel = {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
};

export function useAiSettings() {
  const [settings, setSettings] = useState<AiProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    getStoredAiSettings()
      .then((nextSettings) => {
        if (alive) setSettings(nextSettings);
      })
      .catch(() => {
        if (alive) setSettings(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectEditorModel = useCallback(
    async (providerId: string, modelId: string) => {
      if (!settings) return;

      const selectedProvider = settings.providers.find((provider) => provider.enabled && provider.id === providerId);
      const selectedModel = selectedProvider?.models.find((model) => isEnabledTextModel(model) && model.id === modelId);

      if (!selectedProvider || !selectedModel) return;

      const nextSettings: AiProviderSettings = {
        ...settings,
        defaultModelId: modelId,
        defaultProviderId: providerId,
        providers: settings.providers.map((provider) =>
          provider.id === providerId
            ? {
                ...provider,
                defaultModelId: modelId
              }
            : provider
        )
      };

      setSettings(nextSettings);
      await saveStoredAiSettings(nextSettings);
    },
    [settings]
  );

  return useMemo(() => {
    const enabledProviders = settings?.providers.filter(hasEnabledTextModel) ?? [];
    const activeProvider =
      enabledProviders.find((provider) => provider.id === settings?.defaultProviderId) ?? enabledProviders[0] ?? null;
    const defaultModelId = activeProvider ? readDefaultTextModelId(activeProvider, settings?.defaultModelId) : null;
    const availableTextModels = enabledProviders.flatMap((provider) =>
      provider.models.filter(isEnabledTextModel).map((model) => ({
        id: model.id,
        name: model.name,
        providerId: provider.id,
        providerName: provider.name
      }))
    );

    return {
      activeProvider,
      availableTextModels,
      defaultModelId,
      loading,
      selectEditorModel,
      settings
    };
  }, [loading, selectEditorModel, settings]);
}

function hasEnabledTextModel(provider: AiProviderConfig) {
  return provider.enabled && provider.models.some(isEnabledTextModel);
}

function isEnabledTextModel(model: AiProviderModel) {
  return model.enabled && model.capabilities.includes("text");
}

function readDefaultTextModelId(provider: AiProviderConfig, globalDefaultModelId?: string) {
  const enabledTextModels = provider.models.filter(isEnabledTextModel);
  const providerDefaultModel = enabledTextModels.find((model) => model.id === provider.defaultModelId);
  const globalDefaultModel = enabledTextModels.find((model) => model.id === globalDefaultModelId);

  return providerDefaultModel?.id ?? globalDefaultModel?.id ?? enabledTextModels[0]?.id ?? null;
}
