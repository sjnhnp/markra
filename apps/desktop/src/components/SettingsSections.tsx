import {
  ChevronDown,
  Languages,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  type LucideIcon
} from "lucide-react";
import { Children, type ReactNode } from "react";
import { Button, SegmentedControl, SegmentedControlItem, Switch } from "@markra/ui";
import type {
  AppTheme,
  EditorContentWidth,
  EditorPreferences,
  WebSearchProviderId,
  WebSearchSettings
} from "../lib/settings/app-settings";
import { supportedLanguages, type AppLanguage, type I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

const themeOptions: Array<{
  actionLabelKey: I18nKey;
  icon: LucideIcon;
  labelKey: I18nKey;
  value: AppTheme;
}> = [
  {
    actionLabelKey: "settings.theme.useSystemLabel",
    icon: Monitor,
    labelKey: "settings.theme.system",
    value: "system"
  },
  {
    actionLabelKey: "settings.theme.useLightLabel",
    icon: Sun,
    labelKey: "settings.theme.light",
    value: "light"
  },
  {
    actionLabelKey: "settings.theme.useDarkLabel",
    icon: Moon,
    labelKey: "settings.theme.dark",
    value: "dark"
  }
];

const bodyFontSizeOptions = [14, 15, 16, 17, 18, 20];
const contentWidthOptions: EditorContentWidth[] = ["narrow", "default", "wide"];
const lineHeightOptions = [1.5, 1.65, 1.8];
const webSearchProviderOptions: WebSearchProviderId[] = ["local-bing", "searxng"];

function SettingsSection({ children, label }: { children: ReactNode; label: string }) {
  const sectionId = `settings-section-${label.replace(/\s+/g, "-")}`;
  const hasMultipleRows = Children.count(children) > 1;

  return (
    <section className="settings-section mb-8 last:mb-0" aria-labelledby={sectionId}>
      <h3
        className="m-0 mb-3 text-[12px] leading-5 font-bold tracking-normal text-(--text-secondary)"
        id={sectionId}
      >
        {label}
      </h3>
      <div className={hasMultipleRows ? "settings-list-group divide-y divide-(--border-default)" : "settings-list-group"}>
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  action,
  description,
  title
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="settings-row grid min-h-15 grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-4">
      <div className="min-w-0">
        <p className="m-0 text-[13px] leading-5 font-[650] tracking-normal text-(--text-heading)">{title}</p>
        {description ? (
          <p className="m-0 mt-0.5 text-[12px] leading-4.5 font-[450] text-(--text-secondary)">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center justify-end">{action}</div> : null}
    </div>
  );
}

function SettingsSwitch({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: () => unknown;
}) {
  return <Switch checked={checked} label={label} onCheckedChange={onChange} />;
}

function SettingsSelect({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => unknown;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        className="h-8 min-w-36 appearance-none rounded-md border border-(--border-default) bg-(--bg-primary) py-0 pr-8 pl-3 text-[12px] leading-5 font-[560] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 text-(--text-secondary)"
        size={13}
      />
    </div>
  );
}

function SettingsTextInput({
  label,
  onChange,
  placeholder,
  value
}: {
  label: string;
  onChange: (value: string) => unknown;
  placeholder?: string;
  value: string;
}) {
  return (
    <input
      className="h-8 w-44 rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[560] text-(--text-heading) transition-colors duration-150 ease-out placeholder:text-(--text-secondary) hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="text"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function SettingsButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => unknown;
}) {
  return (
    <Button
      className="gap-1.5"
      size="sm"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function LanguageSelect({
  language,
  label,
  onSelectLanguage
}: {
  language: AppLanguage;
  label: string;
  onSelectLanguage: (language: AppLanguage) => unknown;
}) {
  return (
    <div className="relative inline-flex items-center">
      <Languages aria-hidden="true" className="pointer-events-none absolute left-2.5 text-(--text-secondary)" size={13} />
      <select
        className="h-8 min-w-42 appearance-none rounded-md border border-(--border-default) bg-(--bg-primary) px-8 text-[12px] leading-5 font-[560] text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        aria-label={label}
        value={language}
        onChange={(event) => onSelectLanguage(event.currentTarget.value as AppLanguage)}
      >
        {supportedLanguages.map((supportedLanguage) => (
          <option key={supportedLanguage.code} value={supportedLanguage.code}>
            {supportedLanguage.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ThemeSegmentedControl({
  onSelectTheme,
  selectedTheme,
  translate
}: {
  onSelectTheme: (theme: AppTheme) => unknown;
  selectedTheme: AppTheme;
  translate: Translate;
}) {
  return (
    <SegmentedControl className="grid-cols-3" label={translate("settings.theme.groupLabel")}>
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = selectedTheme === option.value;

        return (
          <SegmentedControlItem
            key={option.value}
            label={translate(option.actionLabelKey)}
            selected={active}
            onClick={() => onSelectTheme(option.value)}
          >
            <Icon aria-hidden="true" size={13} />
            {translate(option.labelKey)}
          </SegmentedControlItem>
        );
      })}
    </SegmentedControl>
  );
}

export function GeneralSettings({
  language,
  onCheckForUpdates,
  onResetWelcomeDocument,
  onSelectLanguage,
  onUpdatePreferences,
  preferences,
  translate,
  welcomeReset
}: {
  language: AppLanguage;
  onCheckForUpdates: () => unknown;
  onResetWelcomeDocument: () => unknown;
  onSelectLanguage: (language: AppLanguage) => unknown;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  translate: Translate;
  welcomeReset: boolean;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.language")}>
        <SettingsRow
          title={translate("settings.language.title")}
          description={translate("settings.language.description")}
          action={
            <LanguageSelect
              language={language}
              label={translate("settings.language.title")}
              onSelectLanguage={onSelectLanguage}
            />
          }
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.startup")}>
        <SettingsRow
          title={translate("settings.startup.restoreWorkspace")}
          description={translate("settings.startup.restoreWorkspaceDescription")}
          action={
            <SettingsSwitch
              checked={preferences.restoreWorkspaceOnStartup}
              label={translate("settings.startup.restoreWorkspace")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  restoreWorkspaceOnStartup: !preferences.restoreWorkspaceOnStartup
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.welcome.title")}
          description={translate("settings.welcome.description")}
          action={
            <SettingsButton label={translate("settings.welcome.buttonLabel")} onClick={onResetWelcomeDocument}>
              <RotateCcw aria-hidden="true" size={13} />
              {translate("settings.welcome.button")}
            </SettingsButton>
          }
        />
      </SettingsSection>

      {welcomeReset ? (
        <p className="-mt-6 mb-8 text-[12px] leading-5 text-(--accent)" role="status">
          {translate("settings.welcome.status")}
        </p>
      ) : null}

      <SettingsSection label={translate("settings.sections.updates")}>
        <SettingsRow
          title={translate("settings.update.title")}
          description={translate("settings.update.description")}
          action={
            <SettingsButton label={translate("settings.update.check")} onClick={onCheckForUpdates}>
              <RefreshCw aria-hidden="true" size={13} />
              {translate("settings.update.check")}
            </SettingsButton>
          }
        />
      </SettingsSection>
    </>
  );
}

export function AppearanceSettings({
  onSelectTheme,
  selectedTheme,
  translate
}: {
  onSelectTheme: (theme: AppTheme) => unknown;
  selectedTheme: AppTheme;
  translate: Translate;
}) {
  return (
    <SettingsSection label={translate("settings.sections.theme")}>
      <SettingsRow
        title={translate("settings.theme.colorTitle")}
        description={translate("settings.theme.description")}
        action={
          <ThemeSegmentedControl selectedTheme={selectedTheme} translate={translate} onSelectTheme={onSelectTheme} />
        }
      />
    </SettingsSection>
  );
}

export function EditorSettings({
  onUpdatePreferences,
  preferences,
  translate
}: {
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  translate: Translate;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.editing")}>
        <SettingsRow
          title={translate("settings.editor.bodyFontSize")}
          description={translate("settings.editor.bodyFontSizeDescription")}
          action={
            <SettingsSelect
              label={translate("settings.editor.bodyFontSize")}
              value={String(preferences.bodyFontSize)}
              options={bodyFontSizeOptions.map((size) => ({ label: `${size}px`, value: String(size) }))}
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  bodyFontSize: Number(value)
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.lineHeight")}
          description={translate("settings.editor.lineHeightDescription")}
          action={
            <SettingsSelect
              label={translate("settings.editor.lineHeight")}
              value={String(preferences.lineHeight)}
              options={lineHeightOptions.map((height) => ({ label: String(height), value: String(height) }))}
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  lineHeight: Number(value)
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.contentWidth")}
          description={translate("settings.editor.contentWidthDescription")}
          action={
            <SettingsSelect
              label={translate("settings.editor.contentWidth")}
              value={preferences.contentWidth}
              options={contentWidthOptions.map((width) => ({
                label: translate(`settings.editor.contentWidth.${width}` as I18nKey),
                value: width
              }))}
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  contentWidth: value as EditorContentWidth
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.clipboardImageFolder")}
          description={translate("settings.editor.clipboardImageFolderDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.editor.clipboardImageFolder")}
              value={preferences.clipboardImageFolder}
              placeholder="assets"
              onChange={(value) =>
                onUpdatePreferences({
                  ...preferences,
                  clipboardImageFolder: value
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.showWordCount")}
          description={translate("settings.editor.showWordCountDescription")}
          action={
            <SettingsSwitch
              checked={preferences.showWordCount}
              label={translate("settings.editor.showWordCount")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  showWordCount: !preferences.showWordCount
                })
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.aiAssistance")}>
        <SettingsRow
          title={translate("settings.editor.autoOpenAiOnSelection")}
          description={translate("settings.editor.autoOpenAiOnSelectionDescription")}
          action={
            <SettingsSwitch
              checked={preferences.autoOpenAiOnSelection}
              label={translate("settings.editor.autoOpenAiOnSelection")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  autoOpenAiOnSelection: !preferences.autoOpenAiOnSelection
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.editor.closeAiCommandOnAgentPanelOpen")}
          description={translate("settings.editor.closeAiCommandOnAgentPanelOpenDescription")}
          action={
            <SettingsSwitch
              checked={preferences.closeAiCommandOnAgentPanelOpen}
              label={translate("settings.editor.closeAiCommandOnAgentPanelOpen")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  closeAiCommandOnAgentPanelOpen: !preferences.closeAiCommandOnAgentPanelOpen
                })
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}

export function WebSearchSettings({
  onUpdateSettings,
  settings,
  translate
}: {
  onUpdateSettings: (settings: WebSearchSettings) => unknown;
  settings: WebSearchSettings;
  translate: Translate;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.webSearch")}>
        <SettingsRow
          title={translate("settings.webSearch.enable")}
          description={translate("settings.webSearch.enableDescription")}
          action={
            <SettingsSwitch
              checked={settings.enabled}
              label={translate("settings.webSearch.enable")}
              onChange={() =>
                onUpdateSettings({
                  ...settings,
                  enabled: !settings.enabled
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.webSearch.provider")}
          description={translate("settings.webSearch.providerDescription")}
          action={
            <SettingsSelect
              label={translate("settings.webSearch.provider")}
              value={settings.providerId}
              options={webSearchProviderOptions.map((providerId) => ({
                label: translate(providerId === "local-bing" ? "settings.webSearch.provider.localBing" : "settings.webSearch.provider.searxng"),
                value: providerId
              }))}
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  providerId: value === "searxng" ? "searxng" : "local-bing"
                })
              }
            />
          }
        />
        {settings.providerId === "searxng" ? (
          <SettingsRow
            title={translate("settings.webSearch.searxngApiHost")}
            description={translate("settings.webSearch.searxngApiHostDescription")}
            action={
              <SettingsTextInput
                label={translate("settings.webSearch.searxngApiHost")}
                value={settings.searxngApiHost}
                placeholder="http://localhost:8888"
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    searxngApiHost: value
                  })
                }
              />
            }
          />
        ) : null}
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.webSearchLimits")}>
        <SettingsRow
          title={translate("settings.webSearch.maxResults")}
          description={translate("settings.webSearch.maxResultsDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.webSearch.maxResults")}
              value={String(settings.maxResults)}
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  maxResults: Number(value)
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.webSearch.contentMaxChars")}
          description={translate("settings.webSearch.contentMaxCharsDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.webSearch.contentMaxChars")}
              value={String(settings.contentMaxChars)}
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  contentMaxChars: Number(value)
                })
              }
            />
          }
        />
      </SettingsSection>
    </>
  );
}
