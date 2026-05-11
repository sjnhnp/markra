import {
  Bot,
  FileText,
  FolderOpen,
  ImageIcon,
  Moon,
  PanelLeft,
  PanelRight,
  Save,
  SquarePen,
  Sun
} from "lucide-react";
import type { CSSProperties } from "react";
import { IconButton } from "@markra/ui";
import type { ResolvedAppTheme } from "../lib/settings/app-settings";
import { resolveDesktopPlatform, type DesktopPlatform } from "../lib/platform";
import { t, type AppLanguage } from "@markra/shared";

type NativeTitleBarProps = {
  aiAgentOpen: boolean;
  aiAgentResizing?: boolean;
  aiAgentWidth?: number;
  dirty: boolean;
  documentKind?: "file" | "folder" | "image";
  documentName: string;
  language?: AppLanguage;
  markdownFilesOpen: boolean;
  markdownFilesResizing?: boolean;
  markdownFilesWidth?: number;
  platform?: DesktopPlatform;
  quickCreateMarkdownFileVisible?: boolean;
  saveDisabled?: boolean;
  theme: ResolvedAppTheme;
  onCreateMarkdownFile?: () => unknown;
  onOpenMarkdown: () => unknown;
  onSaveMarkdown: () => unknown;
  onToggleAiAgent: () => unknown;
  onToggleMarkdownFiles: () => unknown;
  onToggleTheme: () => unknown;
};

const dimTitlebarIconButtonClassName =
  "opacity-55 hover:opacity-100 focus-visible:opacity-100";

export function NativeTitleBar({
  aiAgentOpen,
  aiAgentResizing = false,
  aiAgentWidth = 384,
  dirty,
  documentKind = "file",
  documentName,
  language = "en",
  markdownFilesOpen,
  markdownFilesResizing = false,
  markdownFilesWidth = 288,
  platform = resolveDesktopPlatform(),
  quickCreateMarkdownFileVisible = false,
  saveDisabled = false,
  theme,
  onCreateMarkdownFile,
  onOpenMarkdown,
  onSaveMarkdown,
  onToggleAiAgent,
  onToggleMarkdownFiles,
  onToggleTheme
}: NativeTitleBarProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);
  const themeActionLabel = theme === "dark" ? label("app.switchToLightTheme") : label("app.switchToDarkTheme");
  const renderDocumentActions = (className: string, style?: CSSProperties) => (
    <div
      className={className}
      aria-label={label("app.fileActions")}
      style={style}
    >
      <IconButton
        className={
          aiAgentOpen
            ? "bg-(--bg-active) text-(--text-heading) opacity-100"
            : "bg-transparent text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading)"
        }
        label={label("app.toggleAiAgent")}
        pressed={aiAgentOpen}
        onClick={onToggleAiAgent}
      >
        <Bot aria-hidden="true" size={15} />
      </IconButton>
      <IconButton
        label={label("app.openMarkdownOrFolder")}
        onClick={onOpenMarkdown}
      >
        <FolderOpen aria-hidden="true" size={15} />
      </IconButton>
      <IconButton
        className="disabled:opacity-35"
        disabled={saveDisabled}
        label={label("app.saveMarkdown")}
        onClick={onSaveMarkdown}
      >
        <Save aria-hidden="true" size={15} />
      </IconButton>
      <IconButton
        label={themeActionLabel}
        onClick={onToggleTheme}
      >
        {theme === "dark" ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />}
      </IconButton>
    </div>
  );

  const documentActionsClassName = `document-actions relative z-10 flex h-10 items-center justify-end gap-0.5 pr-3.5 text-(--text-secondary) opacity-10 group-hover/titlebar:opacity-100 focus-within:opacity-100 motion-reduce:transition-none ${
    aiAgentResizing
      ? "transition-none"
      : "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
  }`;

  if (platform === "windows") {
    return renderDocumentActions(
      "document-actions fixed top-0 right-3.5 z-10 flex h-10 items-center justify-end gap-0.5 text-(--text-secondary) opacity-40 transition-[opacity,background-color,color] duration-150 ease-out hover:opacity-100 focus-within:opacity-100"
    );
  }

  const editorLeftInset = markdownFilesOpen ? markdownFilesWidth : 0;
  const editorRightInset = aiAgentOpen ? aiAgentWidth : 0;
  const titleOffset = (editorLeftInset - editorRightInset) / 2;
  const titleTransform = titleOffset === 0 ? undefined : `translateX(${titleOffset}px)`;
  const titleResizing = aiAgentResizing || markdownFilesResizing;
  const showQuickCreateMarkdownFile =
    quickCreateMarkdownFileVisible && !markdownFilesOpen && onCreateMarkdownFile;
  const TitleIcon = documentKind === "folder" ? FolderOpen : documentKind === "image" ? ImageIcon : FileText;
  const MarkdownFilesIcon = markdownFilesOpen ? PanelLeft : PanelRight;
  const titlebarLeftPaddingClassName = platform === "macos" ? "pl-22" : "pl-2";

  return (
    <header
      className="native-titlebar group/titlebar fixed inset-x-0 top-0 z-8 grid h-10 grid-cols-[164px_minmax(0,1fr)_164px] select-none items-center [-webkit-user-select:none]"
      aria-label={label("app.windowDragRegion")}
      data-tauri-drag-region
    >
      <div
        className={`titlebar-spacer relative z-20 flex h-10 items-center gap-1 ${titlebarLeftPaddingClassName}`}
        data-tauri-drag-region
      >
        <IconButton
          className={dimTitlebarIconButtonClassName}
          label={label("app.toggleMarkdownFiles")}
          pressed={markdownFilesOpen}
          onClick={onToggleMarkdownFiles}
        >
          <MarkdownFilesIcon aria-hidden="true" size={15} />
        </IconButton>
        {showQuickCreateMarkdownFile ? (
          <IconButton
            className={dimTitlebarIconButtonClassName}
            label={label("app.newMarkdownFile")}
            onClick={onCreateMarkdownFile}
          >
            <SquarePen aria-hidden="true" size={15} />
          </IconButton>
        ) : null}
      </div>
      <h1
        className={`native-title pointer-events-none m-0 flex h-10 min-w-0 items-center justify-center gap-1.5 text-[14px] leading-none font-[650] tracking-normal text-(--text-primary) motion-reduce:transition-none ${
          titleResizing ? "transition-none" : "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        }`}
        data-tauri-drag-region
        style={{ transform: titleTransform }}
      >
        <TitleIcon aria-hidden="true" size={15} />
        <span className="min-w-0 truncate" data-tauri-drag-region>
          {documentName}
        </span>
        {dirty ? (
          <span className="save-mark size-1.25 rounded-full bg-(--accent)" aria-label={label("app.unsavedChanges")} />
        ) : null}
      </h1>
      {renderDocumentActions(documentActionsClassName, { transform: aiAgentOpen ? `translateX(-${aiAgentWidth}px)` : undefined })}
    </header>
  );
}
