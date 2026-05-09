import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Archive, ArchiveRestore, Check, History, MessageSquarePlus, PencilLine, Search, Trash2 } from "lucide-react";
import type { AppLanguage, I18nKey } from "@markra/shared";
import type { StoredAiAgentSessionSummary } from "../lib/settings/app-settings";
import { t } from "@markra/shared";
import { confirmNativeAiAgentSessionDelete } from "../lib/tauri";

const menuExitDurationMs = 140;

type AiAgentSessionMenuProps = {
  activeSessionId?: string | null;
  language?: AppLanguage;
  sessions?: StoredAiAgentSessionSummary[];
  onArchiveSession?: (sessionId: string, archived: boolean) => unknown;
  onCreateSession?: () => unknown;
  onDeleteSession?: (sessionId: string) => unknown;
  onRenameSession?: (sessionId: string, title: string) => unknown;
  onSelectSession?: (sessionId: string) => unknown;
};

export function AiAgentSessionMenu({
  activeSessionId = null,
  language = "en",
  sessions = [],
  onArchiveSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  onSelectSession
}: AiAgentSessionMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const label = (key: I18nKey) => t(language, key);
  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    return sessions.filter((session) => {
      if (!showArchived && session.archivedAt !== null) return false;
      if (!normalizedQuery) return true;

      const sessionTitle = (session.title ?? label("app.aiAgentSessionUntitled")).toLocaleLowerCase();

      return sessionTitle.includes(normalizedQuery);
    });
  }, [label, query, sessions, showArchived]);
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short"
      }),
    [language]
  );

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      setMenuVisible(true);
      return;
    }

    if (!menuVisible) return;
    setEditingSessionId(null);
    setEditingTitle("");

    closeTimerRef.current = window.setTimeout(() => {
      setMenuVisible(false);
      closeTimerRef.current = null;
    }, menuExitDurationMs);
  }, [menuVisible, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current === null) return;

      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const commitRename = (sessionId: string) => {
    const normalizedTitle = editingTitle.trim();
    if (normalizedTitle) onRenameSession?.(sessionId, normalizedTitle);
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const cancelRename = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const requestDeleteSession = async (sessionId: string, sessionTitle: string) => {
    setEditingSessionId(null);
    setEditingTitle("");
    setOpen(false);

    const confirmed = await confirmNativeAiAgentSessionDelete(sessionTitle, {
      cancelLabel: label("app.aiAgentCancelDeleteSession"),
      message: label("app.aiAgentConfirmDeleteSession"),
      okLabel: label("app.aiAgentConfirmDeleteSessionAction")
    });

    if (!confirmed) return;

    await onDeleteSession?.(sessionId);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-(--text-secondary) transition-[background-color,color] duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none ${
          open ? "bg-(--bg-hover) text-(--text-heading)" : ""
        }`}
        type="button"
        aria-label={label("app.aiAgentSessions")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <History aria-hidden="true" size={15} />
      </button>
      {menuVisible ? (
        <div
          className={`absolute top-[calc(100%+8px)] right-0 z-40 w-72 overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-primary) shadow-(--ai-command-popover-shadow) transition-[opacity,transform] duration-140 ease-out motion-reduce:transition-none ${
            open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
          }`}
          role="menu"
          aria-label={label("app.aiAgentSessions")}
        >
          <div className="border-b border-(--border-default) p-1.5">
            <button
              className="inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-(--border-default) bg-(--bg-secondary) px-3 text-left text-[12px] leading-5 font-semibold text-(--text-primary) transition-[background-color,border-color,color] duration-150 ease-out hover:border-(--border-strong) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:border-(--accent) focus-visible:outline-none"
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onCreateSession?.();
              }}
            >
              <MessageSquarePlus aria-hidden="true" className="shrink-0 text-(--text-secondary)" size={14} />
              <span className="truncate">{label("app.aiAgentNewSession")}</span>
            </button>
            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
              <label className="relative min-w-0">
                <span className="sr-only">{label("app.aiAgentSearchSessions")}</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--text-secondary)"
                  size={13}
                />
                <input
                  aria-label={label("app.aiAgentSearchSessions")}
                  className="h-8 w-full rounded-lg border border-(--border-default) bg-(--bg-primary) pr-2 pl-7 text-[12px] leading-5 font-[520] text-(--text-primary) outline-none transition-[border-color,background-color] duration-150 ease-out placeholder:text-(--text-secondary) focus:border-(--accent)"
                  type="search"
                  value={query}
                  placeholder={label("app.aiAgentSearchSessions")}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border p-0 transition-[background-color,border-color,color] duration-150 ease-out focus-visible:outline-none ${
                  showArchived
                    ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                    : "border-(--border-default) bg-(--bg-primary) text-(--text-secondary) hover:border-(--border-strong) hover:text-(--text-heading)"
                }`}
                type="button"
                aria-label={showArchived ? label("app.aiAgentHideArchivedSessions") : label("app.aiAgentShowArchivedSessions")}
                aria-pressed={showArchived}
                onClick={() => setShowArchived((current) => !current)}
              >
                <Archive aria-hidden="true" size={13} />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto p-1.5">
            {filteredSessions.length > 0 ? (
              <div className="grid gap-1">
                {filteredSessions.map((session) => {
                  const active = session.id === activeSessionId;
                  const sessionTitle = session.title ?? label("app.aiAgentSessionUntitled");
                  const editing = editingSessionId === session.id;
                  const archived = session.archivedAt !== null;

                  return (
                    <div
                      className={`relative rounded-lg border transition-[background-color,border-color,color] duration-150 ease-out ${
                        active
                          ? "border-(--accent) bg-(--accent-soft) text-(--text-heading)"
                          : archived
                            ? "border-transparent bg-transparent text-(--text-secondary) opacity-75 hover:border-(--border-default) hover:bg-(--bg-hover) hover:text-(--text-heading) hover:opacity-100"
                            : "border-transparent bg-transparent text-(--text-primary) hover:border-(--border-default) hover:bg-(--bg-hover) hover:text-(--text-heading)"
                      }`}
                      key={session.id}
                    >
                      {editing ? (
                        <div className="grid gap-1 px-3 py-2">
                          <input
                            aria-label={label("app.aiAgentRenameSessionInput")}
                            autoFocus
                            className="h-8 rounded-md border border-(--accent) bg-(--bg-primary) px-2 text-[12px] leading-5 font-[620] text-(--text-primary) outline-none"
                            type="text"
                            value={editingTitle}
                            onBlur={() => commitRename(session.id)}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitRename(session.id);
                                return;
                              }

                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelRename();
                              }
                            }}
                          />
                          <span className="truncate text-[11px] leading-4 text-(--text-secondary)">
                            {formatter.format(session.updatedAt)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <button
                            className="grid w-full cursor-pointer gap-0.5 rounded-lg px-3 py-2 pr-24 text-left"
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            onClick={() => {
                              setOpen(false);
                              onSelectSession?.(session.id);
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[12px] leading-5 font-[620]">
                                {sessionTitle}
                              </span>
                              {active ? <Check aria-hidden="true" className="shrink-0 text-(--accent)" size={14} /> : null}
                            </span>
                            <span className="truncate text-[11px] leading-4 text-(--text-secondary)">
                              {formatter.format(session.updatedAt)}
                            </span>
                          </button>
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            <button
                              aria-label={`${label("app.aiAgentRenameSession")} ${sessionTitle}`}
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-(--text-secondary) transition-[background-color,color] duration-150 ease-out hover:bg-(--bg-active) hover:text-(--text-heading) focus-visible:bg-(--bg-active) focus-visible:text-(--text-heading) focus-visible:outline-none"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingSessionId(session.id);
                                setEditingTitle(sessionTitle);
                              }}
                            >
                              <PencilLine aria-hidden="true" size={12} />
                            </button>
                            <button
                              aria-label={`${archived ? label("app.aiAgentRestoreSession") : label("app.aiAgentArchiveSession")} ${sessionTitle}`}
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-(--text-secondary) transition-[background-color,color] duration-150 ease-out hover:bg-(--bg-active) hover:text-(--text-heading) focus-visible:bg-(--bg-active) focus-visible:text-(--text-heading) focus-visible:outline-none"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onArchiveSession?.(session.id, !archived);
                              }}
                            >
                              {archived ? <ArchiveRestore aria-hidden="true" size={12} /> : <Archive aria-hidden="true" size={12} />}
                            </button>
                            <button
                              aria-label={`${label("app.aiAgentDeleteSession")} ${sessionTitle}`}
                              className="inline-flex size-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-(--text-secondary) transition-[background-color,color] duration-150 ease-out hover:bg-(--bg-active) hover:text-(--text-heading) focus-visible:bg-(--bg-active) focus-visible:text-(--text-heading) focus-visible:outline-none"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestDeleteSession(session.id, sessionTitle).catch(() => {});
                              }}
                            >
                              <Trash2 aria-hidden="true" size={12} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 px-2 py-3 text-[12px] leading-5 text-(--text-secondary)">
                {sessions.length > 0 ? label("app.aiAgentNoMatchingSessions") : label("app.aiAgentNoSessions")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
