import { KeyRound } from "lucide-react";
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
  type AiProviderApiStyle,
  type AiProviderConfig
} from "../lib/ai/providers/aiProviders";
import type { AiProviderActionState } from "../hooks/useAiProviderSettingsPanelState";
import type { I18nKey } from "../lib/i18n";

type Translate = (key: I18nKey) => string;

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
        <p className="m-0 flex items-center gap-2 text-[12px] leading-5 text-(--text-secondary)">
          <KeyRound aria-hidden="true" size={13} />
          {translate("settings.ai.localStorageNotice")}
        </p>
      </div>
    </AiSettingsSection>
  );
}
