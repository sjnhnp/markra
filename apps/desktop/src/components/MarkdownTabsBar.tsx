import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, Plus, X } from "lucide-react";
import { IconButton } from "@markra/ui";
import { t, type AppLanguage } from "@markra/shared";
import type { MarkdownDocumentTab } from "../hooks/useMarkdownDocument";

export type MarkdownTabsBarItem = Pick<MarkdownDocumentTab, "dirty" | "id" | "name"> & {
  displayKind?: "image" | "markdown";
  path?: string | null;
};

type MarkdownTabsBarProps = {
  activeTabId: string | null;
  language?: AppLanguage;
  placement?: "editor" | "titlebar";
  tabs: MarkdownTabsBarItem[];
  onCloseTab: (tabId: string) => unknown;
  onNewTab: () => unknown;
  onRenameTab?: (tab: MarkdownTabsBarItem, name: string) => unknown;
  onSelectTab: (tabId: string) => unknown;
};

export function MarkdownTabsBar({
  activeTabId,
  language = "en",
  placement = "editor",
  tabs,
  onCloseTab,
  onNewTab,
  onRenameTab,
  onSelectTab
}: MarkdownTabsBarProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameFileName, setRenameFileName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameCancelledRef = useRef(false);

  useEffect(() => {
    if (!renameInputRef.current) return;

    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [renamingTabId]);

  if (tabs.length === 0) return null;

  const titlebarPlacement = placement === "titlebar";
  const startRenamingTab = (tab: MarkdownTabsBarItem) => {
    if (!tab.path || !onRenameTab) return;

    renameCancelledRef.current = false;
    setRenamingTabId(tab.id);
    setRenameFileName(tab.name || "Untitled.md");
  };
  const cancelRenamingTab = () => {
    renameCancelledRef.current = true;
    setRenamingTabId(null);
    setRenameFileName("");
  };
  const commitRenamingTab = (tab: MarkdownTabsBarItem, value = renameFileName) => {
    if (renameCancelledRef.current) {
      renameCancelledRef.current = false;
      return;
    }

    const normalizedName = value.trim();
    setRenamingTabId(null);
    setRenameFileName("");
    if (!normalizedName || normalizedName === tab.name) return;

    onRenameTab?.(tab, normalizedName);
  };

  return (
    <section
      className={
        titlebarPlacement
          ? "document-tabs document-tabs-titlebar h-10 min-w-0 w-full bg-transparent"
          : "document-tabs absolute inset-x-0 top-10 z-7 h-9 border-b border-(--border-default) bg-(--bg-primary)"
      }
      aria-label={label("app.documentTabs")}
    >
      <div
        className={`flex h-full min-w-0 gap-1 overflow-x-auto text-[12px] leading-5 font-[560] text-(--text-secondary) ${
          titlebarPlacement ? "items-center px-1.5" : "items-end px-3"
        }`}
        role="tablist"
        aria-label={label("app.documentTabs")}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const renaming = tab.id === renamingTabId;
          const TabIcon = tab.displayKind === "image" ? ImageIcon : FileText;

          return (
            <div
              className={`group/tab grid h-7 max-w-52 min-w-28 grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border transition-colors duration-150 ease-out ${
                titlebarPlacement ? "" : "mb-1"
              } ${
                active
                  ? "border-(--border-default) bg-(--bg-active) text-(--text-heading)"
                  : "border-transparent bg-transparent text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-heading)"
              }`}
              key={tab.id}
            >
              {renaming ? (
                <div className="flex h-full min-w-0 items-center gap-1.5 rounded-l-md px-2">
                  <TabIcon aria-hidden="true" className="shrink-0 opacity-65" size={13} />
                  <input
                    ref={renameInputRef}
                    aria-label={label("app.renameMarkdownFile")}
                    className="min-w-0 flex-1 rounded-sm border border-(--accent) bg-(--bg-primary) px-1 text-[12px] leading-5 font-[560] text-(--text-heading) outline-none"
                    type="text"
                    value={renameFileName}
                    onBlur={(event) => commitRenamingTab(tab, event.currentTarget.value)}
                    onChange={(event) => setRenameFileName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                        return;
                      }

                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRenamingTab();
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  className="flex h-full min-w-0 items-center gap-1.5 rounded-l-md px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectTab(tab.id)}
                  onDoubleClick={() => startRenamingTab(tab)}
                >
                  <TabIcon aria-hidden="true" className="shrink-0 opacity-65" size={13} />
                  <span className="min-w-0 truncate">{tab.name || "Untitled.md"}</span>
                  {tab.dirty ? (
                    <span className="size-1.25 shrink-0 rounded-full bg-(--accent)" aria-label={label("app.unsavedChanges")} />
                  ) : null}
                </button>
              )}
              <button
                className={`mr-1 flex size-5 items-center justify-center rounded text-(--text-secondary) transition-[opacity,background-color,color] duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) ${
                  active ? "opacity-100" : "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100"
                }`}
                type="button"
                aria-label={`${label("app.closeDocumentTab")} ${tab.name || "Untitled.md"}`}
                onClick={() => onCloseTab(tab.id)}
              >
                <X aria-hidden="true" size={12} />
              </button>
            </div>
          );
        })}
        <IconButton
          className={`${titlebarPlacement ? "" : "mb-1"} rounded-md opacity-70 hover:opacity-100 focus-visible:opacity-100`}
          label={label("app.newDocumentTab")}
          size="icon-xs"
          onClick={onNewTab}
        >
          <Plus aria-hidden="true" size={13} />
        </IconButton>
      </div>
    </section>
  );
}
