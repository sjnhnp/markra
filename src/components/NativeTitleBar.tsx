import { FileText, FolderOpen, Moon, Save, Sun } from "lucide-react";
import type { AppTheme } from "../lib/appSettings";

type NativeTitleBarProps = {
  dirty: boolean;
  documentName: string;
  theme: AppTheme;
  onOpenMarkdown: () => void;
  onSaveMarkdown: () => void;
  onToggleTheme: () => void;
};

export function NativeTitleBar({
  dirty,
  documentName,
  theme,
  onOpenMarkdown,
  onSaveMarkdown,
  onToggleTheme
}: NativeTitleBarProps) {
  const themeActionLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <header
      className="native-titlebar group/titlebar fixed inset-x-0 top-0 z-8 grid h-9.5 grid-cols-[110px_minmax(0,1fr)_110px] select-none items-center [-webkit-user-select:none]"
      aria-label="Window drag region"
      data-tauri-drag-region
    >
      <div className="titlebar-spacer h-full" data-tauri-drag-region />
      <h1
        className="native-title m-0 flex min-w-0 items-center justify-center gap-1.5 text-[14px] font-[650] tracking-normal text-(--text-primary)"
        data-tauri-drag-region
      >
        <FileText aria-hidden="true" size={15} />
        <span className="min-w-0 truncate" data-tauri-drag-region>
          {documentName}
        </span>
        {dirty ? <span className="save-mark size-1.25 rounded-full bg-(--accent)" aria-label="Unsaved changes" /> : null}
      </h1>
      <div
        className="document-actions flex items-center justify-end gap-0.5 pr-3.5 text-(--text-secondary) opacity-10 transition-opacity duration-150 ease-out group-hover/titlebar:opacity-100 focus-within:opacity-100"
        aria-label="File actions"
      >
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          onClick={onOpenMarkdown}
          aria-label="Open Markdown or Folder"
        >
          <FolderOpen aria-hidden="true" size={15} />
        </button>
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          onClick={onSaveMarkdown}
          aria-label="Save Markdown"
        >
          <Save aria-hidden="true" size={15} />
        </button>
        <button
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-[3px] border-0 bg-transparent p-0 text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
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
