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
import { Children, type ReactNode, useEffect, useMemo, useState } from "react";
import { Button, SegmentedControl, SegmentedControlItem, Switch } from "@markra/ui";
import {
  defaultMarkdownShortcuts,
  markdownShortcutFromKeyboardEvent,
  normalizeMarkdownShortcuts,
  parseMarkdownShortcut,
  type MarkdownShortcutAction
} from "@markra/editor";
import type {
  AppTheme,
  EditorPreferences,
  ExportSettings as ExportSettingsValue,
  PdfMarginPreset,
  PdfPageSize,
  WebSearchProviderId,
  WebSearchSettings
} from "../lib/settings/app-settings";
import type { DesktopPlatform } from "../lib/platform";
import { clampNumber, supportedLanguages, type AppLanguage, type I18nKey } from "@markra/shared";
import {
  editorContentWidthPixels,
  editorCustomContentWidthMax,
  editorCustomContentWidthMin,
  normalizeEditorContentWidthPx
} from "../lib/editor-width";

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
const contentWidthRatioSpanPx = editorCustomContentWidthMax - editorCustomContentWidthMin;
const contentWidthRatioMin = 0;
const contentWidthRatioMax = 100;
const exportMarginPresetOptions: PdfMarginPreset[] = ["default", "none", "narrow", "normal", "wide", "custom"];
const exportPageSizeOptions: PdfPageSize[] = ["default", "a4", "letter", "custom"];
const lineHeightOptions = [1.5, 1.65, 1.8];
const webSearchProviderOptions: WebSearchProviderId[] = ["local-bing", "searxng"];
const markdownShortcutLabelKeys: Record<MarkdownShortcutAction, I18nKey> = {
  bold: "menu.bold",
  bulletList: "menu.bulletList",
  codeBlock: "menu.codeBlock",
  heading1: "menu.heading1",
  heading2: "menu.heading2",
  heading3: "menu.heading3",
  image: "menu.image",
  inlineCode: "menu.inlineCode",
  italic: "menu.italic",
  link: "menu.link",
  orderedList: "menu.orderedList",
  paragraph: "menu.paragraph",
  quote: "menu.quote",
  strikethrough: "menu.strikethrough",
  table: "menu.table",
  toggleAiAgent: "app.toggleAiAgent",
  toggleAiCommand: "app.aiCommandDialog",
  toggleMarkdownFiles: "app.toggleMarkdownFiles",
  toggleSourceMode: "app.switchToSourceMode"
};

const keyboardShortcutSections: Array<{
  labelKey: I18nKey;
  actions: MarkdownShortcutAction[];
}> = [
  {
    labelKey: "settings.editor.shortcutsGroupApp",
    actions: ["toggleMarkdownFiles", "toggleAiAgent", "toggleAiCommand", "toggleSourceMode"]
  },
  {
    labelKey: "settings.categories.editor",
    actions: [
      "bold",
      "italic",
      "strikethrough",
      "inlineCode",
      "paragraph",
      "heading1",
      "heading2",
      "heading3",
      "bulletList",
      "orderedList",
      "quote",
      "codeBlock",
      "link",
      "image",
      "table"
    ]
  }
];

const exportPageSizeDimensions: Record<Exclude<PdfPageSize, "custom">, { heightMm: number; widthMm: number }> = {
  a4: { heightMm: 297, widthMm: 210 },
  default: { heightMm: 297, widthMm: 210 },
  letter: { heightMm: 279, widthMm: 216 }
};

const exportMarginPresetMm: Record<Exclude<PdfMarginPreset, "custom">, number> = {
  default: 18,
  narrow: 10,
  none: 0,
  normal: 18,
  wide: 25
};

function formatShortcutForPlatform(shortcut: string, platform: DesktopPlatform) {
  const parsed = parseMarkdownShortcut(shortcut);
  if (!parsed) return shortcut;

  if (platform === "macos") {
    return [
      "⌘",
      parsed.shift ? "⇧" : null,
      parsed.alt ? "⌥" : null,
      parsed.key
    ].filter((part): part is string => Boolean(part)).join("+");
  }

  return [
    "Ctrl",
    parsed.shift ? "Shift" : null,
    parsed.alt ? "Alt" : null,
    parsed.key
  ].filter((part): part is string => Boolean(part)).join("+");
}

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
  value,
  widthClassName = "w-44"
}: {
  label: string;
  onChange: (value: string) => unknown;
  placeholder?: string;
  value: string;
  widthClassName?: string;
}) {
  return (
    <input
      className={`h-8 ${widthClassName} rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[560] text-(--text-heading) transition-colors duration-150 ease-out placeholder:text-(--text-secondary) hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)`}
      type="text"
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

function SettingsNumberInput({
  label,
  max,
  min,
  onChange,
  step = 1,
  unit,
  value
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => unknown;
  step?: number;
  unit?: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <input
        className="h-8 w-24 rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[12px] leading-5 font-[560] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      {unit ? (
        <span className="text-[12px] leading-5 font-[560] text-(--text-secondary)" aria-hidden="true">
          {unit}
        </span>
      ) : null}
    </div>
  );
}

function contentWidthRatioValue(preferences: EditorPreferences) {
  const contentWidthPx = preferences.contentWidthPx ?? editorContentWidthPixels[preferences.contentWidth];

  return Math.round(((contentWidthPx - editorCustomContentWidthMin) / contentWidthRatioSpanPx) * 100);
}

function contentWidthPxFromRatio(value: number) {
  const ratio = clampNumber(value, contentWidthRatioMin, contentWidthRatioMax);
  if (ratio === null) return null;

  return normalizeEditorContentWidthPx(Math.round(editorCustomContentWidthMin + (contentWidthRatioSpanPx * ratio) / 100));
}

function SettingsContentWidthInput({
  label,
  onUpdatePreferences,
  preferences,
  resetLabel
}: {
  label: string;
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  preferences: EditorPreferences;
  resetLabel: string;
}) {
  const ratio = contentWidthRatioValue(preferences);
  const [draftRatio, setDraftRatio] = useState(String(ratio));

  useEffect(() => {
    setDraftRatio(String(ratio));
  }, [ratio]);

  return (
    <div className="content-width-ratio-control inline-flex h-8 items-center overflow-hidden rounded-md border border-(--border-default) bg-(--bg-primary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-within:ring-2 focus-within:ring-(--accent)">
      <div className="relative inline-flex h-full items-center">
        <input
          className="h-full w-18 border-0 bg-transparent py-0 pr-7 pl-3 text-[12px] leading-5 font-[560] text-(--text-heading) outline-none"
          type="text"
          aria-label={label}
          inputMode="numeric"
          min={contentWidthRatioMin}
          max={contentWidthRatioMax}
          pattern="[0-9]*"
          value={draftRatio}
          onChange={(event) => {
            const digits = event.currentTarget.value.replace(/\D/g, "");
            if (!digits) {
              setDraftRatio("");
              return;
            }

            const normalizedDigits = digits.replace(/^0+(?=\d)/, "");
            const nextRatio = Number(normalizedDigits);
            if (!Number.isFinite(nextRatio)) return;

            const nextContentWidthPx = contentWidthPxFromRatio(nextRatio);
            if (nextContentWidthPx === null) return;

            setDraftRatio(String(clampNumber(nextRatio, contentWidthRatioMin, contentWidthRatioMax) ?? ratio));
            onUpdatePreferences({
              ...preferences,
              contentWidth: "default",
              contentWidthPx: nextContentWidthPx
            });
          }}
          onBlur={() => {
            if (draftRatio) return;

            setDraftRatio(String(ratio));
          }}
        />
        <span
          className="pointer-events-none absolute right-2.5 text-[12px] leading-5 font-[560] text-(--text-secondary)"
          aria-hidden="true"
        >
          %
        </span>
      </div>
      <button
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-0 border-l border-(--border-default) bg-transparent text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        type="button"
        aria-label={resetLabel}
        title={resetLabel}
        onClick={() => {
          setDraftRatio(String(contentWidthRatioValue({
            ...preferences,
            contentWidth: "default",
            contentWidthPx: null
          })));
          onUpdatePreferences({
            ...preferences,
            contentWidth: "default",
            contentWidthPx: null
          });
        }}
      >
        <RotateCcw aria-hidden="true" size={13} />
      </button>
    </div>
  );
}

function SettingsCheckbox({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: () => unknown;
}) {
  return (
    <label className="inline-flex h-8 items-center gap-2 text-[12px] leading-5 font-[560] text-(--text-heading)">
      <input
        className="size-4 rounded border-(--border-default) accent-(--accent)"
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

function exportPageSizeLabelKey(pageSize: PdfPageSize) {
  return `settings.export.pageSize.${pageSize}` as I18nKey;
}

function exportMarginPresetLabelKey(preset: PdfMarginPreset) {
  return `settings.export.margin.${preset}` as I18nKey;
}

function applyExportPageSize(settings: ExportSettingsValue, pageSize: PdfPageSize): ExportSettingsValue {
  if (pageSize === "custom") {
    return {
      ...settings,
      pdfPageSize: pageSize
    };
  }

  const dimensions = exportPageSizeDimensions[pageSize];

  return {
    ...settings,
    pdfHeightMm: dimensions.heightMm,
    pdfPageSize: pageSize,
    pdfWidthMm: dimensions.widthMm
  };
}

function applyExportMarginPreset(settings: ExportSettingsValue, preset: PdfMarginPreset): ExportSettingsValue {
  if (preset === "custom") {
    return {
      ...settings,
      pdfMarginPreset: preset
    };
  }

  return {
    ...settings,
    pdfMarginMm: exportMarginPresetMm[preset],
    pdfMarginPreset: preset
  };
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

function ShortcutCaptureButton({
  active,
  actionLabel,
  platform,
  shortcut,
  translate,
  onStart
}: {
  active: boolean;
  actionLabel: string;
  platform: DesktopPlatform;
  shortcut: string;
  translate: Translate;
  onStart: () => unknown;
}) {
  return (
    <button
      className={`inline-flex h-8 min-w-28 items-center justify-center rounded-md border px-3 font-mono text-[12px] leading-5 font-[650] transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) ${
        active
          ? "border-(--accent) bg-(--bg-active) text-(--text-heading)"
          : "border-(--border-default) bg-(--bg-primary) text-(--text-heading) hover:bg-(--bg-hover)"
      }`}
      type="button"
      aria-label={`${actionLabel} ${translate("settings.editor.shortcutAriaSuffix")}`}
      aria-pressed={active}
      onClick={onStart}
    >
      {active ? translate("settings.editor.shortcutRecording") : formatShortcutForPlatform(shortcut, platform)}
    </button>
  );
}

export function KeyboardShortcutsSettings({
  onUpdatePreferences,
  platform = "macos",
  preferences,
  translate
}: {
  onUpdatePreferences: (preferences: EditorPreferences) => unknown;
  platform?: DesktopPlatform;
  preferences: EditorPreferences;
  translate: Translate;
}) {
  const [activeAction, setActiveAction] = useState<MarkdownShortcutAction | null>(null);
  const shortcuts = useMemo(
    () => normalizeMarkdownShortcuts(preferences.markdownShortcuts),
    [preferences.markdownShortcuts]
  );

  useEffect(() => {
    if (!activeAction) return;

    const handleShortcutCapture = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setActiveAction(null);
        return;
      }

      const nextShortcut = markdownShortcutFromKeyboardEvent(event);
      if (!nextShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      onUpdatePreferences({
        ...preferences,
        markdownShortcuts: normalizeMarkdownShortcuts({
          ...shortcuts,
          [activeAction]: nextShortcut
        })
      });
      setActiveAction(null);
    };

    window.addEventListener("keydown", handleShortcutCapture, true);

    return () => {
      window.removeEventListener("keydown", handleShortcutCapture, true);
    };
  }, [activeAction, onUpdatePreferences, preferences, shortcuts]);

  return (
    <SettingsSection label={translate("settings.sections.keyboardShortcuts")}>
      <SettingsRow
        title={translate("settings.editor.shortcuts")}
        description={translate("settings.editor.shortcutsDescription")}
        action={
          <SettingsButton
            label={translate("settings.editor.shortcutsResetLabel")}
            onClick={() => {
              setActiveAction(null);
              onUpdatePreferences({
                ...preferences,
                markdownShortcuts: { ...defaultMarkdownShortcuts }
              });
            }}
          >
            <RotateCcw aria-hidden="true" size={13} />
            {translate("settings.editor.shortcutsReset")}
          </SettingsButton>
        }
      />
      <div className="divide-y divide-(--border-default)">
        {keyboardShortcutSections.map((section) => (
          <div key={section.labelKey} className="py-4 first:pt-3 last:pb-4">
            <h4 className="m-0 mb-3 text-[12px] leading-5 font-[700] tracking-normal text-(--text-secondary)">
              {translate(section.labelKey)}
            </h4>
            <div className="grid grid-cols-2 gap-x-5 gap-y-2 max-[760px]:grid-cols-1">
              {section.actions.map((action) => {
                const actionLabel = translate(markdownShortcutLabelKeys[action]);

                return (
                  <div
                    key={action}
                    className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
                  >
                    <span className="min-w-0 truncate text-[12px] leading-5 font-[560] text-(--text-heading)">
                      {actionLabel}
                    </span>
                    <ShortcutCaptureButton
                      active={activeAction === action}
                      actionLabel={actionLabel}
                      platform={platform}
                      shortcut={shortcuts[action]}
                      translate={translate}
                      onStart={() => setActiveAction(action)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
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
            <SettingsContentWidthInput
              label={translate("settings.editor.contentWidth")}
              preferences={preferences}
              resetLabel={`${translate("settings.editor.contentWidth")} ${translate("settings.editor.shortcutsReset")}`}
              onUpdatePreferences={onUpdatePreferences}
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
          title={translate("settings.editor.showDocumentTabs")}
          description={translate("settings.editor.showDocumentTabsDescription")}
          action={
            <SettingsSwitch
              checked={preferences.showDocumentTabs}
              label={translate("settings.editor.showDocumentTabs")}
              onChange={() =>
                onUpdatePreferences({
                  ...preferences,
                  showDocumentTabs: !preferences.showDocumentTabs
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

export function ExportSettings({
  onUpdateSettings,
  settings,
  translate
}: {
  onUpdateSettings: (settings: ExportSettingsValue) => unknown;
  settings: ExportSettingsValue;
  translate: Translate;
}) {
  return (
    <>
      <SettingsSection label={translate("settings.sections.pdfExport")}>
        <SettingsRow
          title={translate("settings.export.pageSize")}
          description={translate("settings.export.pageSizeDescription")}
          action={
            <SettingsSelect
              label={translate("settings.export.pageSize")}
              value={settings.pdfPageSize}
              options={exportPageSizeOptions.map((pageSize) => ({
                label: translate(exportPageSizeLabelKey(pageSize)),
                value: pageSize
              }))}
              onChange={(value) => onUpdateSettings(applyExportPageSize(settings, value as PdfPageSize))}
            />
          }
        />
        <SettingsRow
          title={translate("settings.export.pageMargin")}
          description={translate("settings.export.pageMarginDescription")}
          action={
            <SettingsSelect
              label={translate("settings.export.pageMargin")}
              value={settings.pdfMarginPreset}
              options={exportMarginPresetOptions.map((preset) => ({
                label: translate(exportMarginPresetLabelKey(preset)),
                value: preset
              }))}
              onChange={(value) => onUpdateSettings(applyExportMarginPreset(settings, value as PdfMarginPreset))}
            />
          }
        />
        {settings.pdfMarginPreset === "custom" ? (
          <SettingsRow
            title={translate("settings.export.pdfMargin")}
            description={translate("settings.export.pdfMarginDescription")}
            action={
              <SettingsNumberInput
                label={translate("settings.export.pdfMargin")}
                min={0}
                max={60}
                unit={translate("settings.export.pdfMarginUnit")}
                value={settings.pdfMarginMm}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pdfMarginMm: value,
                    pdfMarginPreset: "custom"
                  })
                }
              />
            }
          />
        ) : null}
        <SettingsRow
          title={translate("settings.export.pageDimensions")}
          description={translate("settings.export.pageDimensionsDescription")}
          action={
            <div className="inline-flex items-center gap-2">
              <SettingsNumberInput
                label={translate("settings.export.pageWidth")}
                min={50}
                max={2000}
                unit={translate("settings.export.pdfMarginUnit")}
                value={settings.pdfWidthMm}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pdfPageSize: "custom",
                    pdfWidthMm: value
                  })
                }
              />
              <span className="text-[12px] leading-5 font-[560] text-(--text-secondary)" aria-hidden="true">x</span>
              <SettingsNumberInput
                label={translate("settings.export.pageHeight")}
                min={50}
                max={2000}
                unit={translate("settings.export.pdfMarginUnit")}
                value={settings.pdfHeightMm}
                onChange={(value) =>
                  onUpdateSettings({
                    ...settings,
                    pdfHeightMm: value,
                    pdfPageSize: "custom"
                  })
                }
              />
            </div>
          }
        />
        <SettingsRow
          title={translate("settings.export.pageBreakOnH1")}
          description={translate("settings.export.pageBreakOnH1Description")}
          action={
            <SettingsCheckbox
              checked={settings.pdfPageBreakOnH1}
              label={translate("settings.export.pageBreakOnH1")}
              onChange={() =>
                onUpdateSettings({
                  ...settings,
                  pdfPageBreakOnH1: !settings.pdfPageBreakOnH1
                })
              }
            />
          }
        />
      </SettingsSection>

      <SettingsSection label={translate("settings.sections.pdfMetadata")}>
        <SettingsRow
          title={translate("settings.export.header")}
          description={translate("settings.export.headerDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.export.header")}
              value={settings.pdfHeader}
              widthClassName="w-64"
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  pdfHeader: value
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.export.footer")}
          description={translate("settings.export.footerDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.export.footer")}
              value={settings.pdfFooter}
              widthClassName="w-64"
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  pdfFooter: value
                })
              }
            />
          }
        />
        <SettingsRow
          title={translate("settings.export.author")}
          description={translate("settings.export.authorDescription")}
          action={
            <SettingsTextInput
              label={translate("settings.export.author")}
              value={settings.pdfAuthor}
              widthClassName="w-64"
              onChange={(value) =>
                onUpdateSettings({
                  ...settings,
                  pdfAuthor: value
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
