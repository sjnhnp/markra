import {
  FileText,
  Keyboard,
  Languages,
  Moon,
  Palette,
  PenLine,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  type LucideIcon
} from "lucide-react";
import { Children, useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import { useAppLanguage } from "../hooks/useAppLanguage";
import { useAppTheme } from "../hooks/useAppTheme";
import { resetWelcomeDocumentState, type AppTheme } from "../lib/appSettings";
import { supportedLanguages, t, type AppLanguage, type I18nKey } from "../lib/i18n";

type SettingsCategory = "general" | "appearance" | "editor" | "markdown" | "shortcuts";
type Translate = (key: I18nKey) => string;

type SettingsCategoryDefinition = {
  icon: LucideIcon;
  id: SettingsCategory;
  labelKey: I18nKey;
};

const themeOptions: Array<{
  icon: LucideIcon;
  labelKey: I18nKey;
  value: AppTheme;
}> = [
  {
    icon: Sun,
    labelKey: "settings.theme.light",
    value: "light"
  },
  {
    icon: Moon,
    labelKey: "settings.theme.dark",
    value: "dark"
  }
];

const settingsCategories: SettingsCategoryDefinition[] = [
  {
    icon: SlidersHorizontal,
    id: "general",
    labelKey: "settings.categories.general"
  },
  {
    icon: Palette,
    id: "appearance",
    labelKey: "settings.categories.appearance"
  },
  {
    icon: PenLine,
    id: "editor",
    labelKey: "settings.categories.editor"
  },
  {
    icon: FileText,
    id: "markdown",
    labelKey: "settings.categories.markdown"
  },
  {
    icon: Keyboard,
    id: "shortcuts",
    labelKey: "settings.categories.shortcuts"
  }
];

function categoryLabel(categoryId: SettingsCategory, translate: Translate) {
  const category = settingsCategories.find((item) => item.id === categoryId);

  return category ? translate(category.labelKey) : translate("settings.title");
}

function SettingsSidebar({
  activeCategory,
  onCategoryChange,
  translate
}: {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
  translate: Translate;
}) {
  return (
    <aside className="settings-sidebar flex min-h-0 flex-col border-r border-(--border-default) bg-(--bg-secondary)">
      <div className="px-7 pt-14 pb-5">
        <h1 className="settings-sidebar-title m-0 text-[17px] leading-6 font-bold tracking-normal text-(--text-heading)">
          {translate("settings.title")}
        </h1>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3" aria-label={translate("settings.aria.categories")}>
        {settingsCategories.map((category) => (
          <SettingsNavButton
            key={category.id}
            category={category}
            active={category.id === activeCategory}
            translate={translate}
            onClick={() => onCategoryChange(category.id)}
          />
        ))}
      </nav>

      <div className="border-t border-(--border-default) px-7 py-4 text-[12px] leading-5 font-[560] text-(--text-secondary)">
        Markra v0.0.1
      </div>
    </aside>
  );
}

function SettingsNavButton({
  active,
  category,
  onClick,
  translate
}: {
  active: boolean;
  category: SettingsCategoryDefinition;
  onClick: () => void;
  translate: Translate;
}) {
  const Icon = category.icon;
  const label = translate(category.labelKey);

  return (
    <button
      className="group inline-flex h-9 w-full items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left text-[13px] leading-5 font-[620] tracking-normal text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) aria-current:bg-(--bg-active) aria-current:text-(--accent) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
      type="button"
      aria-current={active ? "page" : undefined}
      aria-label={label}
      onClick={onClick}
    >
      <Icon aria-hidden="true" size={15} />
      <span>{label}</span>
    </button>
  );
}

function SettingsContent({
  activeCategory,
  children,
  translate
}: {
  activeCategory: SettingsCategory;
  children: ReactNode;
  translate: Translate;
}) {
  return (
    <section className="settings-content flex min-h-0 min-w-0 flex-col bg-(--bg-primary)">
      <header
        className="settings-content-header relative z-20 flex h-14 shrink-0 items-center border-b border-(--border-default) px-7"
        data-tauri-drag-region
      >
        <h2 className="settings-panel-title m-0 text-[16px] leading-6 font-bold tracking-normal text-(--text-heading)">
          {categoryLabel(activeCategory, translate)}
        </h2>
      </header>

      <div className="settings-scroll min-h-0 flex-1 overflow-auto overscroll-none px-8 py-7">{children}</div>
    </section>
  );
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

function SettingValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center rounded-md px-2.5 text-[12px] leading-5 font-[560] text-(--text-secondary)">
      {children}
    </span>
  );
}

function SettingsButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
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
  onSelectLanguage: (language: AppLanguage) => void;
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
  onSelectTheme: (theme: AppTheme) => void;
  selectedTheme: AppTheme;
  translate: Translate;
}) {
  return (
    <div
      className="grid shrink-0 grid-cols-2 rounded-md border border-(--border-default) bg-(--bg-secondary) p-0.5"
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
            aria-label={
              option.value === "dark"
                ? translate("settings.theme.useDarkLabel")
                : translate("settings.theme.useLightLabel")
            }
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

export function SettingsWindow() {
  const appTheme = useAppTheme();
  const appLanguage = useAppLanguage();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [welcomeReset, setWelcomeReset] = useState(false);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);

  useLayoutEffect(() => {
    document.documentElement.dataset.window = "settings";

    return () => {
      delete document.documentElement.dataset.window;
    };
  }, []);

  useLayoutEffect(() => {
    document.title = translate("settings.title");
  }, [translate]);

  const handleResetWelcomeDocument = useCallback(() => {
    void resetWelcomeDocumentState().then(() => {
      setWelcomeReset(true);
    }).catch(() => {});
  }, []);

  return (
    <main
      className="settings-window relative h-screen overflow-hidden overscroll-none bg-(--bg-primary) text-(--text-primary)"
      aria-label={translate("settings.aria.main")}
    >
      <div
        className="settings-drag-region fixed inset-x-0 top-0 z-10 h-9.5 select-none [-webkit-user-select:none]"
        aria-label={translate("settings.aria.dragRegion")}
        data-tauri-drag-region
      />
      <div className="settings-layout grid h-screen grid-cols-[180px_minmax(0,1fr)]">
        <SettingsSidebar activeCategory={activeCategory} translate={translate} onCategoryChange={setActiveCategory} />
        <SettingsContent activeCategory={activeCategory} translate={translate}>
          {activeCategory === "general" ? (
            <GeneralSettings
              language={appLanguage.language}
              translate={translate}
              welcomeReset={welcomeReset}
              onResetWelcomeDocument={handleResetWelcomeDocument}
              onSelectLanguage={appLanguage.selectLanguage}
            />
          ) : null}
          {activeCategory === "appearance" ? (
            <AppearanceSettings
              selectedTheme={appTheme.theme}
              translate={translate}
              onSelectTheme={appTheme.selectTheme}
            />
          ) : null}
          {activeCategory === "editor" ? <EditorSettings translate={translate} /> : null}
          {activeCategory === "markdown" ? <MarkdownSettings translate={translate} /> : null}
          {activeCategory === "shortcuts" ? <ShortcutsSettings translate={translate} /> : null}
        </SettingsContent>
      </div>
    </main>
  );
}

function GeneralSettings({
  language,
  onResetWelcomeDocument,
  onSelectLanguage,
  translate,
  welcomeReset
}: {
  language: AppLanguage;
  onResetWelcomeDocument: () => void;
  onSelectLanguage: (language: AppLanguage) => void;
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

function AppearanceSettings({
  onSelectTheme,
  selectedTheme,
  translate
}: {
  onSelectTheme: (theme: AppTheme) => void;
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

function EditorSettings({ translate }: { translate: Translate }) {
  return (
    <SettingsSection label={translate("settings.sections.editing")}>
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

function MarkdownSettings({ translate }: { translate: Translate }) {
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

function ShortcutsSettings({ translate }: { translate: Translate }) {
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
