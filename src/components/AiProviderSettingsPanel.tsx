import { Check, KeyRound, Plus, Search } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import azureAiLogo from "../assets/provider-logos/azure-ai.svg";
import anthropicLogo from "../assets/provider-logos/anthropic.svg";
import deepseekLogo from "../assets/provider-logos/deepseek.svg";
import geminiLogo from "../assets/provider-logos/gemini.svg";
import grokLogo from "../assets/provider-logos/grok.svg";
import groqLogo from "../assets/provider-logos/groq.svg";
import mistralLogo from "../assets/provider-logos/mistral.svg";
import ollamaLogo from "../assets/provider-logos/ollama.svg";
import openAiLogo from "../assets/provider-logos/openai.svg";
import openRouterLogo from "../assets/provider-logos/openrouter.svg";
import togetherLogo from "../assets/provider-logos/together.svg";
import type { AiProviderConfig, AiProviderModel, AiProviderSettings, AiProviderType } from "../lib/appSettings";
import { aiProviderTypes, defaultApiUrlForProviderType } from "../lib/aiProviders";
import type { I18nKey } from "../lib/i18n";

type Translate = (key: I18nKey) => string;

type AiProviderSettingsPanelProps = {
  saved: boolean;
  selectedProviderId?: string;
  settings: AiProviderSettings;
  translate: Translate;
  onAddProvider: () => void;
  onFetchModels: (provider: AiProviderConfig) => Promise<AiProviderModel[]>;
  onSave: () => void;
  onSelectProvider: (providerId: string) => void;
  onTestProvider: (provider: AiProviderConfig) => Promise<{ message: string; ok: boolean }>;
  onUpdateSettings: (settings: AiProviderSettings) => void;
};

type ProviderActionState = {
  message?: string;
  pending?: "models" | "test";
  status: "error" | "idle" | "success";
};

const providerLogoByType: Partial<Record<AiProviderType, string>> = {
  anthropic: anthropicLogo,
  "azure-openai": azureAiLogo,
  deepseek: deepseekLogo,
  google: geminiLogo,
  groq: groqLogo,
  mistral: mistralLogo,
  ollama: ollamaLogo,
  openai: openAiLogo,
  openrouter: openRouterLogo,
  together: togetherLogo,
  xai: grokLogo
};

function SettingsTextField({
  label,
  onChange,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "password" | "text";
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">{label}</span>
      <input
        className="h-9 w-full rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[13px] leading-5 font-[520] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-(--text-secondary) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function SettingsSelectField<TValue extends string>({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: TValue) => void;
  value: TValue;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">{label}</span>
      <select
        className="h-9 w-full rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[13px] leading-5 font-[520] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as TValue)}
      >
        {children}
      </select>
    </label>
  );
}

function SettingsSection({ children, label }: { children: ReactNode; label: string }) {
  const sectionId = `ai-settings-section-${label.replace(/\s+/g, "-")}`;

  return (
    <section className="settings-section mb-8 last:mb-0" aria-labelledby={sectionId}>
      <h3 className="m-0 mb-3 text-[12px] leading-5 font-bold tracking-normal text-(--text-secondary)" id={sectionId}>
        {label}
      </h3>
      {children}
    </section>
  );
}

function providerTypeLabel(type: AiProviderType) {
  const labels: Record<AiProviderType, string> = {
    anthropic: "Anthropic",
    "azure-openai": "Azure OpenAI",
    deepseek: "DeepSeek",
    google: "Google",
    groq: "Groq",
    mistral: "Mistral",
    ollama: "Ollama",
    openai: "OpenAI",
    "openai-compatible": "OpenAI Compatible",
    openrouter: "OpenRouter",
    together: "Together.ai",
    xai: "xAI"
  };

  return labels[type];
}

function updateProvider(
  settings: AiProviderSettings,
  providerId: string,
  updater: (provider: AiProviderConfig) => AiProviderConfig
): AiProviderSettings {
  return {
    ...settings,
    providers: settings.providers.map((provider) => (provider.id === providerId ? updater(provider) : provider))
  };
}

function ProviderBadge({ provider }: { provider: AiProviderConfig }) {
  const logo = providerLogoByType[provider.type];

  return (
    <span className="inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-(--border-default) bg-[oklch(0.985_0.004_255)] text-[11px] leading-none font-[750] text-(--accent)">
      {logo ? (
        <img
          className="size-5 object-contain"
          src={logo}
          alt={`${provider.name} logo`}
          draggable={false}
        />
      ) : (
        provider.name.slice(0, 2)
      )}
    </span>
  );
}

function ProviderSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-(--border-strong) bg-(--bg-secondary) transition-colors duration-150 ease-out aria-checked:border-(--accent) aria-checked:bg-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
    >
      <span
        className="inline-block size-3.5 translate-x-0.75 rounded-full bg-(--text-secondary) transition-transform duration-150 ease-out aria-checked:translate-x-4.5 aria-checked:bg-(--bg-primary)"
        aria-checked={checked}
      />
    </button>
  );
}

function ActionButton({
  children,
  disabled,
  label,
  onClick
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[650] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) disabled:cursor-default disabled:opacity-60 disabled:hover:bg-(--bg-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function AiProviderSettingsPanel({
  settings,
  selectedProviderId,
  saved,
  translate,
  onAddProvider,
  onFetchModels,
  onSave,
  onSelectProvider,
  onTestProvider,
  onUpdateSettings
}: AiProviderSettingsPanelProps) {
  const [actionState, setActionState] = useState<ProviderActionState>({ status: "idle" });
  const [providerSearch, setProviderSearch] = useState("");
  const selectedProvider = settings.providers.find((provider) => provider.id === selectedProviderId) ?? settings.providers[0];
  const normalizedProviderSearch = providerSearch.trim().toLowerCase();
  const visibleProviders = normalizedProviderSearch
    ? settings.providers.filter((provider) => provider.name.toLowerCase().includes(normalizedProviderSearch))
    : settings.providers;
  const isCustomProvider = Boolean(selectedProvider?.id.startsWith("custom-provider-"));

  const updateSelectedProvider = useCallback(
    (updater: (provider: AiProviderConfig) => AiProviderConfig) => {
      if (!selectedProvider) return;
      onUpdateSettings(updateProvider(settings, selectedProvider.id, updater));
    },
    [onUpdateSettings, selectedProvider, settings]
  );

  const modelOptions = selectedProvider?.models ?? [];

  const handleTestProvider = useCallback(() => {
    if (!selectedProvider) return;

    setActionState({ pending: "test", status: "idle" });
    void onTestProvider(selectedProvider)
      .then((result) => {
        setActionState({
          message: result.ok ? translate("settings.ai.apiConnected") : result.message,
          status: result.ok ? "success" : "error"
        });
      })
      .catch((error: unknown) => {
        setActionState({ message: error instanceof Error ? error.message : String(error), status: "error" });
      });
  }, [onTestProvider, selectedProvider, translate]);

  const handleFetchModels = useCallback(() => {
    if (!selectedProvider) return;

    setActionState({ pending: "models", status: "idle" });
    void onFetchModels(selectedProvider)
      .then((models) => {
        const enabledByModelId = new Map(selectedProvider.models.map((model) => [model.id, model.enabled]));
        const mergedModels = models.map((model) => ({
          ...model,
          enabled: enabledByModelId.get(model.id) ?? model.enabled
        }));
        const defaultModelId = mergedModels.some((model) => model.id === selectedProvider.defaultModelId)
          ? selectedProvider.defaultModelId
          : mergedModels[0]?.id;

        onUpdateSettings({
          ...updateProvider(settings, selectedProvider.id, (provider) => ({
            ...provider,
            defaultModelId,
            models: mergedModels
          })),
          defaultModelId,
          defaultProviderId: selectedProvider.id
        });
        setActionState({ message: translate("settings.ai.modelsUpdated"), status: "success" });
      })
      .catch((error: unknown) => {
        setActionState({ message: error instanceof Error ? error.message : String(error), status: "error" });
      });
  }, [onFetchModels, onUpdateSettings, selectedProvider, settings, translate]);

  return (
    <div className="ai-settings-layout grid min-h-full grid-cols-[16rem_minmax(0,1fr)] max-[860px]:grid-cols-1">
      <section className="flex min-h-0 flex-col border-r border-(--border-default) bg-(--bg-primary) max-[860px]:border-r-0 max-[860px]:border-b">
        <div className="border-b border-(--border-default) p-3">
          <label className="relative block">
            <span className="sr-only">{translate("settings.ai.searchProviders")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--text-secondary)"
              size={14}
            />
            <input
              className="h-9 w-full rounded-md border border-(--border-default) bg-(--bg-secondary) pr-3 pl-8 text-[13px] leading-5 font-[520] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-(--text-secondary) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
              aria-label={translate("settings.ai.searchProviders")}
              value={providerSearch}
              placeholder={translate("settings.ai.searchProviders")}
              onChange={(event) => setProviderSearch(event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="grid flex-1 content-start gap-1 overflow-auto p-3">
          {visibleProviders.map((provider) => (
            <button
              className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border-0 bg-transparent px-2.5 py-2 text-left transition-colors duration-150 ease-out hover:bg-(--bg-hover) aria-current:bg-(--bg-active) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
              type="button"
              key={provider.id}
              aria-current={provider.id === selectedProvider?.id ? "page" : undefined}
              aria-label={provider.name}
              onClick={() => onSelectProvider(provider.id)}
            >
              <ProviderBadge provider={provider} />
              <span className="min-w-0 truncate text-[13px] leading-5 font-[620] text-(--text-heading)">
                {provider.name}
              </span>
              <span className={`size-2 rounded-full ${provider.enabled ? "bg-(--accent)" : "bg-(--border-strong)"}`} />
            </button>
          ))}
        </div>

        <div className="border-t border-(--border-default) p-3">
          <button
            className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[13px] leading-5 font-[650] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
            type="button"
            aria-label={translate("settings.ai.addProvider")}
            onClick={onAddProvider}
          >
            <Plus aria-hidden="true" size={15} />
            {translate("settings.ai.addProvider")}
          </button>
        </div>
      </section>

      {selectedProvider ? (
        <section className="min-h-0 overflow-auto overscroll-none bg-(--bg-primary)">
          <div className="flex min-h-16 items-center justify-between gap-4 border-b border-(--border-default) px-6 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <ProviderBadge provider={selectedProvider} />
              <div className="min-w-0">
                <h3 className="m-0 truncate text-[16px] leading-6 font-[750] text-(--text-heading)">
                  {selectedProvider.name}
                </h3>
                {isCustomProvider ? (
                  <p className="m-0 text-[12px] leading-5 text-(--text-secondary)">
                    {providerTypeLabel(selectedProvider.type)}
                  </p>
                ) : null}
              </div>
              <span className="rounded-md bg-(--bg-secondary) px-2 py-1 text-[12px] leading-4 font-[650] text-(--text-secondary)">
                {selectedProvider.apiKey ? translate("settings.ai.configured") : translate("settings.ai.notConfigured")}
              </span>
            </div>
            <ProviderSwitch
              checked={selectedProvider.enabled}
              label={translate("settings.ai.enableProviderLabel")}
              onChange={() => updateSelectedProvider((provider) => ({ ...provider, enabled: !provider.enabled }))}
            />
          </div>

          <div className="grid gap-6 px-6 py-5">
            <SettingsSection label={translate("settings.sections.aiProviders")}>
              <div className="grid gap-4 py-2">
                {isCustomProvider ? (
                  <>
                    <SettingsTextField
                      label={translate("settings.ai.providerName")}
                      value={selectedProvider.name}
                      onChange={(name) => updateSelectedProvider((provider) => ({ ...provider, name }))}
                    />
                    <SettingsSelectField<AiProviderType>
                      label={translate("settings.ai.providerType")}
                      value={selectedProvider.type}
                      onChange={(type) =>
                        updateSelectedProvider((provider) => ({
                          ...provider,
                          baseUrl: provider.baseUrl || defaultApiUrlForProviderType(type),
                          type
                        }))
                      }
                    >
                      {aiProviderTypes.map((type) => (
                        <option key={type} value={type}>
                          {providerTypeLabel(type)}
                        </option>
                      ))}
                    </SettingsSelectField>
                  </>
                ) : null}
                <SettingsTextField
                  label={translate("settings.ai.apiKey")}
                  type="password"
                  value={selectedProvider.apiKey ?? ""}
                  onChange={(apiKey) => updateSelectedProvider((provider) => ({ ...provider, apiKey }))}
                />
                <div className="grid gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-end">
                  <SettingsTextField
                    label={translate("settings.ai.apiAddress")}
                    value={selectedProvider.baseUrl ?? ""}
                    onChange={(baseUrl) => updateSelectedProvider((provider) => ({ ...provider, baseUrl }))}
                  />
                  <ActionButton
                    label={translate("settings.ai.testApi")}
                    disabled={actionState.pending === "test"}
                    onClick={handleTestProvider}
                  >
                    {actionState.pending === "test" ? translate("settings.ai.testingApi") : translate("settings.ai.testApi")}
                  </ActionButton>
                </div>
                <p className="m-0 flex items-center gap-2 text-[12px] leading-5 text-(--text-secondary)">
                  <KeyRound aria-hidden="true" size={13} />
                  {translate("settings.ai.localStorageNotice")}
                </p>
              </div>
            </SettingsSection>

            <SettingsSection label={translate("settings.sections.aiModels")}>
              <div className="grid gap-4 py-2">
                <SettingsSelectField
                  label={translate("settings.ai.defaultModel")}
                  value={selectedProvider.defaultModelId ?? modelOptions[0]?.id ?? ""}
                  onChange={(defaultModelId) => {
                    onUpdateSettings({
                      ...updateProvider(settings, selectedProvider.id, (provider) => ({ ...provider, defaultModelId })),
                      defaultModelId,
                      defaultProviderId: selectedProvider.id
                    });
                  }}
                >
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </SettingsSelectField>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="m-0 text-[12px] leading-5 font-[700] text-(--text-secondary)">
                      {translate("settings.ai.availableModels")}
                    </p>
                    <ActionButton
                      label={translate("settings.ai.getModelList")}
                      disabled={actionState.pending === "models"}
                      onClick={handleFetchModels}
                    >
                      {actionState.pending === "models" ? translate("settings.ai.fetchingModels") : translate("settings.ai.getModelList")}
                    </ActionButton>
                  </div>
                  <div className="divide-y divide-(--border-default)">
                    {modelOptions.map((model) => (
                      <div className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2" key={model.id}>
                        <ProviderSwitch
                          checked={model.enabled}
                          label={model.name}
                          onChange={() =>
                            updateSelectedProvider((provider) => ({
                              ...provider,
                              models: provider.models.map((item) =>
                                item.id === model.id ? { ...item, enabled: !item.enabled } : item
                              )
                            }))
                          }
                        />
                        <span className="min-w-0 truncate text-[13px] leading-5 font-[600] text-(--text-heading)">
                          {model.name}
                        </span>
                        <span className="rounded-full bg-(--bg-secondary) px-2 py-0.5 text-[11px] leading-4 font-[650] text-(--text-secondary)">
                          {model.capability}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SettingsSection>

            {actionState.message ? (
              <p
                className={`m-0 rounded-md px-3 py-2 text-[12px] leading-5 font-[560] ${
                  actionState.status === "error"
                    ? "bg-[oklch(0.96_0.035_25)] text-[oklch(0.48_0.13_25)]"
                    : "bg-(--bg-secondary) text-(--text-secondary)"
                }`}
                role="status"
              >
                {actionState.message}
              </p>
            ) : null}
          </div>

          <div className="sticky bottom-0 flex min-h-15 items-center justify-end gap-3 border-t border-(--border-default) bg-(--bg-primary) px-6 py-3">
            {saved ? (
              <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] leading-5 font-[560] text-(--accent)" role="status">
                <Check aria-hidden="true" size={13} />
                {translate("settings.ai.saved")}
              </span>
            ) : null}
            <button
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-(--accent) bg-(--accent) px-4 text-[13px] leading-5 font-[700] text-(--bg-primary) shadow-[0_8px_20px_rgba(63,102,216,0.24)] transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-(--accent-hover) hover:border-(--accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
              type="button"
              aria-label={translate("settings.ai.saveProviders")}
              onClick={onSave}
            >
              {translate("settings.ai.saveProviders")}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
