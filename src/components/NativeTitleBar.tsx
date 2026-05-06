import { Bot, FileText, FolderOpen, Moon, PanelLeft, Save, Sun } from "lucide-react";
import type { ResolvedAppTheme } from "../lib/settings/appSettings";
import { t, type AppLanguage } from "../lib/i18n";

type NativeTitleBarProps = {
  aiAgentOpen: boolean;
  dirty: boolean;
  documentName: string;
  language?: AppLanguage;
  markdownFilesOpen: boolean;
  theme: ResolvedAppTheme;
  onOpenMarkdown: () => unknown;
  onSaveMarkdown: () => unknown;
  onToggleAiAgent: () => unknown;
  onToggleMarkdownFiles: () => unknown;
  onToggleTheme: () => unknown;
};

export function NativeTitleBar({
  aiAgentOpen,
  dirty,
  documentName,
  language = "en",
  markdownFilesOpen,
  theme,
  onOpenMarkdown,
  onSaveMarkdown,
  onToggleAiAgent,
  onToggleMarkdownFiles,
  onToggleTheme
}: NativeTitleBarProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);
  const themeActionLabel = theme === "dark" ? label("app.switchToLightTheme") : label("app.switchToDarkTheme");

  return (
    <header
      className="native-titlebar group/titlebar fixed inset-x-0 top-0 z-8 grid h-10 grid-cols-[132px_minmax(0,1fr)_164px] select-none items-center [-webkit-user-select:none]"
      aria-label={label("app.windowDragRegion")}
      data-tauri-drag-region
    >
      <div className="titlebar-spacer flex h-10 items-center pl-22" data-tauri-drag-region>
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-(--text-secondary) opacity-55 transition-[background-color,color,opacity] duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) hover:opacity-100 focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:opacity-100 focus-visible:outline-none"
          type="button"
          aria-label={label("app.toggleMarkdownFiles")}
          aria-pressed={markdownFilesOpen}
          onClick={onToggleMarkdownFiles}
        >
          <PanelLeft aria-hidden="true" size={15} />
        </button>
      </div>
      <h1
        className="native-title m-0 flex h-10 min-w-0 items-center justify-center gap-1.5 text-[14px] leading-none font-[650] tracking-normal text-(--text-primary)"
        data-tauri-drag-region
      >
        <FileText aria-hidden="true" size={15} />
        <span className="min-w-0 truncate" data-tauri-drag-region>
          {documentName}
        </span>
        {dirty ? (
          <span className="save-mark size-1.25 rounded-full bg-(--accent)" aria-label={label("app.unsavedChanges")} />
        ) : null}
      </h1>
      <div
        className="document-actions flex h-10 items-center justify-end gap-0.5 pr-3.5 text-(--text-secondary) opacity-10 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/titlebar:opacity-100 focus-within:opacity-100 motion-reduce:transition-none"
        aria-label={label("app.fileActions")}
        style={{ transform: aiAgentOpen ? "translateX(-24rem)" : undefined }}
      >
        <button
          className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 p-0 transition-[background-color,color,opacity] duration-150 ease-out focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none ${
            aiAgentOpen
              ? "bg-(--bg-active) text-(--text-heading) opacity-100"
              : "bg-transparent text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading)"
          }`}
          type="button"
          onClick={onToggleAiAgent}
          aria-label={label("app.toggleAiAgent")}
          aria-pressed={aiAgentOpen}
        >
          <Bot aria-hidden="true" size={15} />
        </button>
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          onClick={onOpenMarkdown}
          aria-label={label("app.openMarkdownOrFolder")}
        >
          <FolderOpen aria-hidden="true" size={15} />
        </button>
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          onClick={onSaveMarkdown}
          aria-label={label("app.saveMarkdown")}
        >
          <Save aria-hidden="true" size={15} />
        </button>
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          onClick={onToggleTheme}
          aria-label={themeActionLabel}
        >
          {theme === "dark" ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />}
        </button>
      </div>
    </header>
  );
}
