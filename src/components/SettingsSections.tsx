import {
  Languages,
  Monitor,
  Moon,
  RotateCcw,
  Sun,
  type LucideIcon
} from "lucide-react";
import { Children, type ReactNode } from "react";
import type { EditorPreferences, AppTheme } from "../lib/settings/appSettings";
import { supportedLanguages, type AppLanguage, type I18nKey } from "../lib/i18n";

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

function SettingValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md px-2.5 text-[12px] leading-5 font-[560] text-(--text-secondary)">
      {children}
    </span>
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
    <button
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[560] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="button"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
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
    <div
      className="grid shrink-0 grid-cols-3 rounded-md border border-(--border-default) bg-(--bg-secondary) p-0.5"
      role="group"
      aria-label={translate("settings.theme.groupLabel")}
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = selectedTheme === option.value;

        return (
          <button
            className="inline-flex h-7 min-w-16 items-center justify-center gap-1.5 rounded-sm border-0 bg-transparent px-2.5 text-[12px] leading-5 font-[560] text-(--text-secondary) transition-colors duration-150 ease-out hover:text-(--text-heading) aria-pressed:bg-(--bg-active) aria-pressed:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
            type="button"
            key={option.value}
            aria-label={translate(option.actionLabelKey)}
            aria-pressed={active}
            onClick={() => onSelectTheme(option.value)}
          >
            <Icon aria-hidden="true" size={13} />
            {translate(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

export function GeneralSettings({
  language,
  onResetWelcomeDocument,
  onSelectLanguage,
  translate,
  welcomeReset
}: {
  language: AppLanguage;
  onResetWelcomeDocument: () => unknown;
  onSelectLanguage: (language: AppLanguage) => unknown;
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

      <SettingsSection label={translate("settings.sections.window")}>
        <SettingsRow
          title={translate("settings.openMode.title")}
          description={translate("settings.openMode.description")}
          action={<SettingValue>{translate("settings.values.native")}</SettingValue>}
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.updates")}>
        <SettingsRow title={translate("settings.updates.currentVersion")} action={<SettingValue>v0.0.1</SettingValue>} />
        <SettingsRow
          title={translate("settings.updates.check")}
          description={translate("settings.updates.description")}
          action={<SettingValue>{translate("settings.values.notConfigured")}</SettingValue>}
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
    <SettingsSection label={translate("settings.sections.editing")}>
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
        title={translate("settings.editor.bodyFontSize")}
        description={translate("settings.editor.bodyFontSizeDescription")}
        action={<SettingValue>16px</SettingValue>}
      />
      <SettingsRow
        title={translate("settings.editor.singleDocument")}
        description={translate("settings.editor.singleDocumentDescription")}
        action={<SettingValue>{translate("settings.values.enabled")}</SettingValue>}
      />
    </SettingsSection>
  );
}

export function MarkdownSettings({ translate }: { translate: Translate }) {
  return (
    <SettingsSection label={translate("settings.sections.syntax")}>
      <SettingsRow
        title={translate("settings.markdown.liveRendering")}
        description={translate("settings.markdown.liveRenderingDescription")}
        action={<SettingValue>{translate("settings.values.enabled")}</SettingValue>}
      />
      <SettingsRow
        title={translate("settings.markdown.tables")}
        description={translate("settings.markdown.tablesDescription")}
        action={<SettingValue>{translate("settings.values.enabled")}</SettingValue>}
      />
    </SettingsSection>
  );
}

export function ShortcutsSettings({ translate }: { translate: Translate }) {
  return (
    <SettingsSection label={translate("settings.sections.systemShortcuts")}>
      <SettingsRow
        title={translate("settings.shortcuts.nativeMenu")}
        description={translate("settings.shortcuts.nativeMenuDescription")}
        action={<SettingValue>{translate("settings.values.enabled")}</SettingValue>}
      />
    </SettingsSection>
  );
}
