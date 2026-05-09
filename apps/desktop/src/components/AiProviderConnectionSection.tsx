import { lazy, Suspense, useId, useState } from "react";
import { Braces, KeyRound, X } from "lucide-react";
import {
  AiSettingsActionButton,
  AiSettingsSection,
  AiSettingsSelectField,
  AiSettingsTextField
} from "./AiProviderSettingsControls";
import { aiProviderApiStyleLabel } from "./AiProviderBadge";
import {
  aiProviderApiStyles,
  defaultApiUrlForApiStyle,
  readAiProviderCustomHeaders,
  type AiProviderApiStyle,
  type AiProviderConfig
} from "@markra/ai";
import type { AiProviderActionState } from "../hooks/useAiProviderSettingsPanelState";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

const LazyJsonCodeEditor = lazy(async () => {
  const module = await import("./JsonCodeEditor");

  return { default: module.JsonCodeEditor };
});

function JsonCodeEditorFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-0 gap-1.5" data-testid="json-code-editor-loading">
      <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">{label}</span>
      <div
        aria-hidden="true"
        className="min-h-70 animate-pulse rounded-md border border-(--border-default) bg-(--bg-secondary)"
      />
    </div>
  );
}

export function AiProviderConnectionSection({
  actionState,
  isCustomProvider,
  provider,
  translate,
  onTestProvider,
  updateSelectedProvider
}: {
  actionState: AiProviderActionState;
  isCustomProvider: boolean;
  provider: AiProviderConfig;
  translate: Translate;
  onTestProvider: () => unknown;
  updateSelectedProvider: (updater: (provider: AiProviderConfig) => AiProviderConfig) => unknown;
}) {
  const customHeadersDialogTitleId = useId();
  const [customHeadersDialogOpen, setCustomHeadersDialogOpen] = useState(false);
  const [customHeadersDraft, setCustomHeadersDraft] = useState(provider.customHeaders ?? "");
  const [customHeadersError, setCustomHeadersError] = useState<string | null>(null);
  const customHeadersJsonLabel = translate("settings.ai.customHeadersJson");

  const openCustomHeadersDialog = () => {
    setCustomHeadersDraft(provider.customHeaders ?? "");
    setCustomHeadersError(null);
    setCustomHeadersDialogOpen(true);
  };

  const saveCustomHeaders = () => {
    const customHeaders = customHeadersDraft.trim();

    try {
      readAiProviderCustomHeaders({ customHeaders });
    } catch {
      setCustomHeadersError(translate("settings.ai.customHeadersInvalidJson"));
      return;
    }

    updateSelectedProvider((current) => ({ ...current, customHeaders }));
    setCustomHeadersDialogOpen(false);
  };

  return (
    <AiSettingsSection label={translate("settings.sections.aiProviders")}>
      <div className="grid gap-4 py-2">
        {isCustomProvider ? (
          <>
            <AiSettingsTextField
              label={translate("settings.ai.providerName")}
              value={provider.name}
              onChange={(name) => updateSelectedProvider((current) => ({ ...current, name }))}
            />
            <AiSettingsSelectField<AiProviderApiStyle>
              label={translate("settings.ai.apiStyle")}
              value={provider.type}
              onChange={(type) =>
                updateSelectedProvider((current) => ({
                  ...current,
                  baseUrl: current.baseUrl || defaultApiUrlForApiStyle(type),
                  type
                }))
              }
            >
              {aiProviderApiStyles.map((type) => (
                <option key={type} value={type}>
                  {aiProviderApiStyleLabel(type, translate)}
                </option>
              ))}
            </AiSettingsSelectField>
          </>
        ) : null}
        <AiSettingsTextField
          label={translate("settings.ai.apiKey")}
          type="password"
          value={provider.apiKey ?? ""}
          onChange={(apiKey) => updateSelectedProvider((current) => ({ ...current, apiKey }))}
        />
        <div className="grid gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-end">
          <AiSettingsTextField
            label={translate("settings.ai.apiAddress")}
            value={provider.baseUrl ?? ""}
            onChange={(baseUrl) => updateSelectedProvider((current) => ({ ...current, baseUrl }))}
          />
          <AiSettingsActionButton
            label={translate("settings.ai.testApi")}
            disabled={actionState.pending === "test"}
            onClick={onTestProvider}
          >
            {actionState.pending === "test" ? translate("settings.ai.testingApi") : translate("settings.ai.testApi")}
          </AiSettingsActionButton>
        </div>
        <div className="grid gap-2 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-center">
          <div className="grid gap-1">
            <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">
              {translate("settings.ai.customHeaders")}
            </span>
            <span className="text-[11px] leading-4 text-(--text-secondary)">
              {translate("settings.ai.customHeadersDescription")}{" "}
              {provider.customHeaders?.trim() ? translate("settings.ai.configured") : translate("settings.ai.notConfigured")}
            </span>
          </div>
          <AiSettingsActionButton label={translate("settings.ai.customHeadersEdit")} onClick={openCustomHeadersDialog}>
            <Braces aria-hidden="true" size={14} />
            {translate("settings.ai.customHeadersEdit")}
          </AiSettingsActionButton>
        </div>
        <p className="m-0 flex items-center gap-2 text-[12px] leading-5 text-(--text-secondary)">
          <KeyRound aria-hidden="true" size={13} />
          {translate("settings.ai.localStorageNotice")}
        </p>
      </div>
      {customHeadersDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:rgba(31,35,44,0.42)] px-4 py-6">
          <div
            aria-labelledby={customHeadersDialogTitleId}
            aria-modal="true"
            className="grid max-h-[min(640px,calc(100vh-48px))] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-(--border-default) bg-(--bg-primary) shadow-xl"
            role="dialog"
          >
            <div className="flex items-center justify-between gap-3 border-b border-(--border-default) px-4 py-3">
              <h4 className="m-0 text-[13px] leading-5 font-[700] text-(--text-heading)" id={customHeadersDialogTitleId}>
                {translate("settings.ai.customHeaders")}
              </h4>
              <button
                aria-label={translate("settings.ai.cancelEditModel")}
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                type="button"
                onClick={() => setCustomHeadersDialogOpen(false)}
              >
                <X aria-hidden="true" size={15} />
              </button>
            </div>
            <div className="grid min-h-0 gap-2 overflow-auto px-4 py-4">
              <Suspense fallback={<JsonCodeEditorFallback label={customHeadersJsonLabel} />}>
                <LazyJsonCodeEditor
                  label={customHeadersJsonLabel}
                  value={customHeadersDraft}
                  onChange={(value) => {
                    setCustomHeadersDraft(value);
                    setCustomHeadersError(null);
                  }}
                />
              </Suspense>
              {customHeadersError ? (
                <p className="m-0 text-[11px] leading-4 text-(--danger)" role="alert">
                  {customHeadersError}
                </p>
              ) : (
                <p className="m-0 text-[11px] leading-4 text-(--text-secondary)">
                  {translate("settings.ai.customHeadersDescription")}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-(--border-default) px-4 py-3">
              <button
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[650] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                type="button"
                onClick={() => setCustomHeadersDialogOpen(false)}
              >
                {translate("settings.ai.cancelEditModel")}
              </button>
              <button
                aria-label={translate("settings.ai.customHeadersSave")}
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-(--accent) bg-(--accent) px-3 text-[12px] leading-5 font-[700] text-(--bg-primary) transition-colors duration-150 ease-out hover:border-(--accent-hover) hover:bg-(--accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                type="button"
                onClick={saveCustomHeaders}
              >
                {translate("settings.ai.customHeadersSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AiSettingsSection>
  );
}
