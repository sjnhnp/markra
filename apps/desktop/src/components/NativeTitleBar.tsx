import {
  Bot,
  Code2,
  Eye,
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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, IconButton, PopoverSurface } from "@markra/ui";
import type { ResolvedAppTheme } from "../lib/settings/app-settings";
import { resolveDesktopPlatform, type DesktopPlatform } from "../lib/platform";
import { t, type AppLanguage } from "@markra/shared";
import { MacWindowControls } from "./MacWindowControls";

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
  sourceMode?: boolean;
  sourceModeDisabled?: boolean;
  theme: ResolvedAppTheme;
  titleContent?: ReactNode;
  onCreateMarkdownFile?: () => unknown;
  onOpenMarkdown: () => unknown;
  onOpenMarkdownFolder?: () => unknown;
  onSaveMarkdown: () => unknown;
  onToggleAiAgent: () => unknown;
  onToggleMarkdownFiles: () => unknown;
  onToggleSourceMode?: () => unknown;
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
  sourceMode = false,
  sourceModeDisabled = false,
  theme,
  titleContent,
  onCreateMarkdownFile,
  onOpenMarkdown,
  onOpenMarkdownFolder,
  onSaveMarkdown,
  onToggleAiAgent,
  onToggleMarkdownFiles,
  onToggleSourceMode,
  onToggleTheme
}: NativeTitleBarProps) {
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const [openMenuVisible, setOpenMenuVisible] = useState(false);
  const label = (key: Parameters<typeof t>[1]) => t(language, key);
  const themeActionLabel = theme === "dark" ? label("app.switchToLightTheme") : label("app.switchToDarkTheme");
  const splitOpenChoiceAvailable = platform !== "macos" && Boolean(onOpenMarkdownFolder);

  useEffect(() => {
    if (!openMenuVisible) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!openMenuRef.current?.contains(event.target as Node)) setOpenMenuVisible(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuVisible(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuVisible]);

  const runOpenAction = (action: () => unknown) => {
    setOpenMenuVisible(false);
    action();
  };

  const renderOpenAction = () => {
    if (!splitOpenChoiceAvailable || !onOpenMarkdownFolder) {
      return (
        <IconButton
          label={label("app.openMarkdownOrFolder")}
          onClick={onOpenMarkdown}
        >
          <FolderOpen aria-hidden="true" size={15} />
        </IconButton>
      );
    }

    return (
      <div className="relative" ref={openMenuRef}>
        <IconButton
          className={openMenuVisible ? "bg-(--bg-active) text-(--text-heading)" : ""}
          label={label("app.openMarkdownOrFolder")}
          aria-expanded={openMenuVisible}
          aria-haspopup="menu"
          onClick={() => setOpenMenuVisible((current) => !current)}
        >
          <FolderOpen aria-hidden="true" size={15} />
        </IconButton>
        {openMenuVisible ? (
          <PopoverSurface
            className="absolute top-[calc(100%+6px)] right-0 z-40 grid w-52 gap-1 rounded-lg p-1"
            open
            role="menu"
            aria-label={label("app.openMarkdownOrFolder")}
          >
            <Button
              className="w-full justify-start rounded-md text-left"
              size="sm"
              role="menuitem"
              onClick={() => runOpenAction(onOpenMarkdown)}
            >
              <FileText aria-hidden="true" className="shrink-0 text-(--text-secondary)" size={14} />
              <span className="truncate">{label("app.openMarkdownFile")}</span>
            </Button>
            <Button
              className="w-full justify-start rounded-md text-left"
              size="sm"
              role="menuitem"
              onClick={() => runOpenAction(onOpenMarkdownFolder)}
            >
              <FolderOpen aria-hidden="true" className="shrink-0 text-(--text-secondary)" size={14} />
              <span className="truncate">{label("app.openFolder")}</span>
            </Button>
          </PopoverSurface>
        ) : null}
      </div>
    );
  };

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
      {onToggleSourceMode && sourceMode ? (
        <IconButton
          className="bg-(--bg-active) text-(--text-heading) opacity-100 disabled:opacity-35"
          disabled={sourceModeDisabled}
          label={label("app.switchToVisualMode")}
          onClick={onToggleSourceMode}
        >
          <Eye aria-hidden="true" size={15} />
        </IconButton>
      ) : null}
      {onToggleSourceMode && !sourceMode ? (
        <IconButton
          className="disabled:opacity-35"
          disabled={sourceModeDisabled}
          label={label("app.switchToSourceMode")}
          onClick={onToggleSourceMode}
        >
          <Code2 aria-hidden="true" size={15} />
        </IconButton>
      ) : null}
      {renderOpenAction()}
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

  const renderTitleContent = (className: string, style?: CSSProperties) => (
    <div className={className} style={style}>
      {titleContent}
    </div>
  );

  if (platform === "windows") {
    if (titleContent) {
      return (
        <header
          className="native-titlebar group/titlebar fixed inset-x-0 top-0 z-10 grid h-10 grid-cols-[minmax(0,1fr)_164px] select-none items-center [-webkit-user-select:none]"
          aria-label={label("app.windowDragRegion")}
          data-tauri-drag-region
        >
          {renderTitleContent(
            "native-title-slot min-w-0 h-10 px-3"
          )}
          {renderDocumentActions(
            "document-actions relative z-10 flex h-10 items-center justify-end gap-0.5 pr-3.5 text-(--text-secondary) opacity-40 transition-[opacity,background-color,color] duration-150 ease-out hover:opacity-100 focus-within:opacity-100"
          )}
        </header>
      );
    }

    return (
      <header
        className="native-titlebar fixed top-0 right-3.5 z-10 flex h-10 w-auto select-none items-center justify-end [-webkit-user-select:none]"
        aria-label={label("app.windowDragRegion")}
        data-tauri-drag-region
      >
        {renderDocumentActions(
          "document-actions relative flex h-10 items-center justify-end gap-0.5 text-(--text-secondary) opacity-40 transition-[opacity,background-color,color] duration-150 ease-out hover:opacity-100 focus-within:opacity-100"
        )}
      </header>
    );
  }

  const editorLeftInset = markdownFilesOpen ? markdownFilesWidth : 0;
  const editorRightInset = aiAgentOpen ? aiAgentWidth : 0;
  const titleOffset = (editorLeftInset - editorRightInset) / 2;
  const titleTransform = titleOffset === 0 ? undefined : `translateX(${titleOffset}px)`;
  const titleSlotStyle: CSSProperties = {
    transform: titleTransform,
    ...(titleOffset > 0 ? { marginRight: titleOffset } : {}),
    ...(titleOffset < 0 ? { marginLeft: -titleOffset } : {})
  };
  const titleResizing = aiAgentResizing || markdownFilesResizing;
  const showQuickCreateMarkdownFile =
    quickCreateMarkdownFileVisible && !markdownFilesOpen && onCreateMarkdownFile;
  const TitleIcon = documentKind === "folder" ? FolderOpen : documentKind === "image" ? ImageIcon : FileText;
  const MarkdownFilesIcon = markdownFilesOpen ? PanelLeft : PanelRight;
  const showMacWindowControls = platform === "macos";
  const titlebarLeftPaddingClassName = showMacWindowControls ? "pl-0" : "pl-2";

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
        {showMacWindowControls ? <MacWindowControls /> : null}
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
      {titleContent ? (
        renderTitleContent(
          `native-title-slot flex h-10 min-w-0 items-center justify-center motion-reduce:transition-none ${
            titleResizing ? "transition-none" : "transition-[margin,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          }`,
          titleSlotStyle
        )
      ) : (
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
      )}
      {renderDocumentActions(documentActionsClassName, { transform: aiAgentOpen ? `translateX(-${aiAgentWidth}px)` : undefined })}
    </header>
  );
}
