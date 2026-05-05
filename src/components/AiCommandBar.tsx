import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  FileText,
  Languages,
  PenLine,
  Plus,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { t, type AppLanguage, type I18nKey } from "../lib/i18n";

type AiCommandAction = {
  icon: LucideIcon;
  labelKey: I18nKey;
};

type AiCommandState = "compact" | "expanded" | "collapsing" | "closing";

const collapseDurationMs = 160;
const exitDurationMs = 200;

const aiCommandActions: AiCommandAction[] = [
  {
    icon: Sparkles,
    labelKey: "app.aiPolish"
  },
  {
    icon: PenLine,
    labelKey: "app.aiRewrite"
  },
  {
    icon: Plus,
    labelKey: "app.aiContinueWriting"
  },
  {
    icon: FileText,
    labelKey: "app.aiSummarize"
  },
  {
    icon: Languages,
    labelKey: "app.aiTranslate"
  }
];

type AiCommandBarProps = {
  language?: AppLanguage;
  open: boolean;
  prompt: string;
  onClose: () => void;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
};

export function AiCommandBar({
  language = "en",
  open,
  prompt,
  onClose,
  onPromptChange,
  onSubmit
}: AiCommandBarProps) {
  const collapseTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const commandRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const commandStateRef = useRef<AiCommandState>("compact");
  const renderedRef = useRef(open);
  const [commandState, setCommandState] = useState<AiCommandState>("compact");
  const [closingFromExpanded, setClosingFromExpanded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [playCompactOpenAnimation, setPlayCompactOpenAnimation] = useState(open);
  const [rendered, setRendered] = useState(open);
  const label = (key: I18nKey) => t(language, key);
  const canSubmit = prompt.trim().length > 0;
  const closing = commandState === "closing";
  const expanded = commandState === "expanded";
  const showingExpandedSurface = commandState === "expanded" || commandState === "collapsing" || (closing && closingFromExpanded);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current === null) return;

    window.clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = null;
  }, []);

  const clearExitTimer = useCallback(() => {
    if (exitTimerRef.current === null) return;

    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }, []);

  useEffect(() => {
    commandStateRef.current = commandState;
  }, [commandState]);

  useEffect(() => {
    renderedRef.current = rendered;
  }, [rendered]);

  useEffect(() => {
    if (open) {
      clearCollapseTimer();
      clearExitTimer();
      setRendered(true);
      setClosingFromExpanded(false);
      setPlayCompactOpenAnimation(true);
      setCommandState("compact");
      setEntered(false);

      const enterTimer = window.setTimeout(() => {
        setEntered(true);
      }, 0);

      return () => {
        window.clearTimeout(enterTimer);
      };
    }

    if (!renderedRef.current) return;

    clearCollapseTimer();
    clearExitTimer();
    setClosingFromExpanded(commandStateRef.current === "expanded" || commandStateRef.current === "collapsing");
    setCommandState("closing");
    setEntered(false);

    exitTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      setClosingFromExpanded(false);
      setPlayCompactOpenAnimation(false);
      setCommandState("compact");
      exitTimerRef.current = null;
    }, exitDurationMs);
  }, [clearCollapseTimer, clearExitTimer, open]);

  useEffect(() => {
    return () => {
      clearCollapseTimer();
      clearExitTimer();
    };
  }, [clearCollapseTimer, clearExitTimer]);

  const expandCommand = useCallback(() => {
    if (!open || closing) return;

    clearCollapseTimer();
    clearExitTimer();
    setPlayCompactOpenAnimation(false);
    if (expanded) return;

    setCommandState("expanded");
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [clearCollapseTimer, clearExitTimer, closing, expanded, open]);

  const collapseCommand = useCallback(() => {
    if (!expanded) return;

    clearCollapseTimer();
    setPlayCompactOpenAnimation(false);
    setCommandState("collapsing");
    collapseTimerRef.current = window.setTimeout(() => {
      setCommandState("compact");
      collapseTimerRef.current = null;
    }, collapseDurationMs);
  }, [clearCollapseTimer, expanded]);

  useEffect(() => {
    if (!open || !expanded) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (commandRef.current?.contains(event.target as Node)) return;

      collapseCommand();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [collapseCommand, expanded, open]);

  useEffect(() => {
    if (!rendered) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "escape") return;

      const state = commandStateRef.current;
      if (state === "closing") return;

      event.preventDefault();

      if (state === "expanded") {
        collapseCommand();
        return;
      }

      if (state === "collapsing") return;

      onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [collapseCommand, onClose, rendered]);

  if (!rendered) return null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  };

  return (
    <section
      className={`ai-command-layer pointer-events-none fixed inset-x-0 bottom-12 z-40 flex justify-center px-6 transition-[opacity,transform] duration-200 ease-out will-change-transform max-[760px]:bottom-8 max-[760px]:px-4 motion-reduce:transition-none ${entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0"}`}
      role="dialog"
      aria-label={label("app.aiCommandDialog")}
      data-state={commandState}
    >
      <div ref={commandRef} className={`relative w-full max-w-205 ${closing ? "pointer-events-none" : "pointer-events-auto"}`}>
        {showingExpandedSurface ? (
          <div
            className={
              commandState === "collapsing" || closing
                ? "ai-command-actions absolute bottom-[104px] left-0 w-66 animate-[markra-ai-float-out_160ms_ease-in_both] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.14)] transition-[opacity,transform] duration-160 ease-in max-[760px]:hidden motion-reduce:animate-none motion-reduce:transition-none"
                : "ai-command-actions absolute bottom-[104px] left-0 w-66 animate-[markra-ai-float-in_180ms_ease-out_both] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.14)] transition-[opacity,transform] duration-180 ease-out max-[760px]:hidden motion-reduce:animate-none motion-reduce:transition-none"
            }
            aria-label={label("app.aiQuickActions")}
          >
            <div className="mb-2 px-2 text-[13px] leading-5 font-[700] text-(--text-heading)">
              {label("app.aiToolkit")}
            </div>
            <div className="grid gap-0.5">
              {aiCommandActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    className="inline-flex h-8 w-full cursor-pointer items-center gap-2 rounded-[4px] border-0 bg-transparent px-2 text-left text-[13px] leading-5 font-[560] text-(--text-primary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
                    key={action.labelKey}
                    type="button"
                    aria-label={label(action.labelKey)}
                  >
                    <Icon aria-hidden="true" size={15} />
                    <span className="min-w-0 truncate">{label(action.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <form
          className={
            showingExpandedSurface
              ? `ai-command-box flex min-h-21 origin-bottom ${closing ? "animate-[markra-ai-command-close_180ms_ease-in_both] " : ""}items-end gap-3 rounded-lg border border-(--accent) bg-(--bg-primary) p-3 shadow-[0_20px_64px_rgba(0,0,0,0.16)] transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none`
              : `ai-command-box flex h-14 origin-bottom ${closing ? "animate-[markra-ai-command-close_180ms_ease-in_both]" : playCompactOpenAnimation ? "animate-[markra-ai-command-open_220ms_ease-out_both]" : ""} items-center gap-3 rounded-xl border border-(--border-default) bg-(--bg-primary) px-4 py-2 shadow-[0_18px_52px_rgba(0,0,0,0.12)] transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none`
          }
          data-state={commandState}
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="markra-ai-command-input">
            {label("app.aiCommandInput")}
          </label>
          {!showingExpandedSurface ? <Sparkles aria-hidden="true" className="shrink-0 text-(--text-secondary)" size={18} /> : null}
          <textarea
            id="markra-ai-command-input"
            ref={inputRef}
            className={
              showingExpandedSurface
                ? "min-h-14 flex-1 resize-none border-0 bg-transparent p-0 text-[16px] leading-6 text-(--text-primary) outline-none placeholder:text-(--text-secondary)"
                : "h-8 min-h-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-[16px] leading-8 text-(--text-primary) outline-none placeholder:text-(--text-secondary)"
            }
            value={prompt}
            placeholder={
              showingExpandedSurface ? label("app.aiCommandPlaceholder") : label("app.aiCommandCompactPlaceholder")
            }
            rows={showingExpandedSurface ? 2 : 1}
            onClick={expandCommand}
            onChange={(event) => onPromptChange(event.target.value)}
            onFocus={expandCommand}
            aria-label={label("app.aiCommandInput")}
          />
          <button
            className={
              showingExpandedSurface
                ? "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--bg-active) p-0 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--accent) hover:text-(--bg-primary) focus-visible:bg-(--accent) focus-visible:text-(--bg-primary) focus-visible:outline-none disabled:cursor-default disabled:opacity-45 disabled:hover:bg-(--bg-active) disabled:hover:text-(--text-secondary)"
                : "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--bg-active) p-0 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--accent) hover:text-(--bg-primary) focus-visible:bg-(--accent) focus-visible:text-(--bg-primary) focus-visible:outline-none disabled:cursor-default disabled:opacity-45 disabled:hover:bg-(--bg-active) disabled:hover:text-(--text-secondary)"
            }
            type="submit"
            disabled={!canSubmit}
            aria-label={label("app.aiCommandSend")}
          >
            <ArrowUp aria-hidden="true" size={17} />
          </button>
        </form>
      </div>
    </section>
  );
}
