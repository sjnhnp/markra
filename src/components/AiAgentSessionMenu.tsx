import { useEffect, useMemo, useRef, useState } from "react";
import { Check, History, MessageSquarePlus } from "lucide-react";
import type { AppLanguage, I18nKey } from "../lib/i18n";
import type { StoredAiAgentSessionSummary } from "../lib/settings/appSettings";
import { t } from "../lib/i18n";

const menuExitDurationMs = 140;

type AiAgentSessionMenuProps = {
  activeSessionId?: string | null;
  language?: AppLanguage;
  sessions?: StoredAiAgentSessionSummary[];
  onCreateSession?: () => unknown;
  onSelectSession?: (sessionId: string) => unknown;
};

export function AiAgentSessionMenu({
  activeSessionId = null,
  language = "en",
  sessions = [],
  onCreateSession,
  onSelectSession
}: AiAgentSessionMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const label = (key: I18nKey) => t(language, key);
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
          className={`absolute top-[calc(100%+8px)] right-0 z-40 w-72 overflow-hidden rounded-xl border border-(--border-default) bg-(--bg-primary) shadow-[var(--ai-command-popover-shadow)] transition-[opacity,transform] duration-140 ease-out motion-reduce:transition-none ${
            open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
          }`}
          role="menu"
          aria-label={label("app.aiAgentSessions")}
        >
          <div className="border-b border-(--border-default) p-1.5">
            <button
              className="inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-(--border-default) bg-(--bg-secondary) px-3 text-left text-[12px] leading-5 font-[600] text-(--text-primary) transition-[background-color,border-color,color] duration-150 ease-out hover:border-(--border-strong) hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:border-(--accent) focus-visible:outline-none"
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
          </div>
          <div className="max-h-80 overflow-auto p-1.5">
            {sessions.length > 0 ? (
              <div className="grid gap-1">
                {sessions.map((session) => {
                  const active = session.id === activeSessionId;

                  return (
                    <button
                      className={`grid w-full cursor-pointer gap-0.5 rounded-lg border px-3 py-2 text-left transition-[background-color,border-color,color] duration-150 ease-out ${
                        active
                          ? "border-(--accent) bg-(--accent-soft) text-(--text-heading)"
                          : "border-transparent bg-transparent text-(--text-primary) hover:border-(--border-default) hover:bg-(--bg-hover) hover:text-(--text-heading)"
                      }`}
                      key={session.id}
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
                          {session.title ?? label("app.aiAgentSessionUntitled")}
                        </span>
                        {active ? <Check aria-hidden="true" className="shrink-0 text-(--accent)" size={14} /> : null}
                      </span>
                      <span className="truncate text-[11px] leading-4 text-(--text-secondary)">
                        {formatter.format(session.updatedAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="m-0 px-2 py-3 text-[12px] leading-5 text-(--text-secondary)">{label("app.aiAgentNoSessions")}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
