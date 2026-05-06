import {
  Bot,
  FileText,
  Keyboard,
  Palette,
  PenLine,
  SlidersHorizontal,
  type LucideIcon
} from "lucide-react";
import type { ReactNode } from "react";
import type { SettingsCategory } from "../hooks/useSettingsWindowState";
import type { I18nKey } from "../lib/i18n";

type Translate = (key: I18nKey) => string;

type SettingsCategoryDefinition = {
  icon: LucideIcon;
  id: SettingsCategory;
  labelKey: I18nKey;
};

const settingsCategories: SettingsCategoryDefinition[] = [
  {
    icon: SlidersHorizontal,
    id: "general",
    labelKey: "settings.categories.general"
  },
  {
    icon: Bot,
    id: "ai",
    labelKey: "settings.categories.ai"
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

export function SettingsSidebar({
  activeCategory,
  onCategoryChange,
  translate
}: {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => unknown;
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
  onClick: () => unknown;
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

export function SettingsContent({
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

      <div
        className={
          activeCategory === "ai"
            ? "settings-scroll min-h-0 flex-1 overflow-hidden overscroll-none p-0"
            : "settings-scroll min-h-0 flex-1 overflow-auto overscroll-none px-8 py-7"
        }
      >
        {children}
      </div>
    </section>
  );
}
