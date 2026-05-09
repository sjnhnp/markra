import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import {
  ArrowUp,
  BrainCircuit,
  FileText,
  Languages,
  LoaderCircle,
  PenLine,
  Plus,
  Sparkles,
  Square,
  type LucideIcon
} from "lucide-react";
import { AiModelPicker, type AiModelPickerOption } from "./AiModelPicker";
import { useImeInputGuard } from "../hooks/useImeInputGuard";
import type { AiDiffResult, AiEditIntent } from "@markra/ai";
import type { AiProviderApiStyle } from "../lib/settings/appSettings";
import { t, type AppLanguage, type I18nKey } from "@markra/shared";

type AiCommandAction = {
  icon: LucideIcon;
  intent: Exclude<AiEditIntent, "custom">;
  labelKey: I18nKey;
};

type AiCommandModelOption = AiModelPickerOption & {
  providerType?: AiProviderApiStyle;
};

type AiCommandSubmitOptions = {
  thinkingEnabled?: boolean;
};

type AiCommandState = "compact" | "expanded" | "collapsing" | "closing";

const collapseDurationMs = 160;
const exitDurationMs = 200;

const aiCommandActions: AiCommandAction[] = [
  {
    icon: Sparkles,
    intent: "polish",
    labelKey: "app.aiPolish"
  },
  {
    icon: PenLine,
    intent: "rewrite",
    labelKey: "app.aiRewrite"
  },
  {
    icon: Plus,
    intent: "continue",
    labelKey: "app.aiContinueWriting"
  },
  {
    icon: FileText,
    intent: "summarize",
    labelKey: "app.aiSummarize"
  },
  {
    icon: Languages,
    intent: "translate",
    labelKey: "app.aiTranslate"
  }
];

const aiCommandLoadingLabelKeys: Record<Exclude<AiEditIntent, "custom">, I18nKey> = {
  continue: "app.aiContinuingWriting",
  polish: "app.aiPolishing",
  rewrite: "app.aiRewriting",
  summarize: "app.aiSummarizing",
  translate: "app.aiTranslating"
};

type AiCommandBarProps = {
  aiResult?: AiDiffResult | null;
  availableModels?: AiCommandModelOption[];
  editorLeftInset?: string;
  editorRightInset?: string;
  language?: AppLanguage;
  open: boolean;
  prompt: string;
  selectedModelId?: string | null;
  selectedProviderId?: string | null;
  submitting?: boolean;
  supportsThinking?: boolean;
  onClose: () => unknown;
  onInterrupt?: () => unknown;
  onPromptChange: (prompt: string) => unknown;
  onSelectModel?: (providerId: string, modelId: string) => unknown;
  onSubmit: (promptOverride?: string, intent?: AiEditIntent, options?: AiCommandSubmitOptions) => unknown;
};

export function AiCommandBar({
  aiResult = null,
  availableModels = [],
  editorLeftInset = "0px",
  editorRightInset = "0px",
  language = "en",
  open,
  prompt,
  selectedModelId = null,
  selectedProviderId = null,
  submitting = false,
  supportsThinking = false,
  onClose,
  onInterrupt,
  onPromptChange,
  onSelectModel,
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
  const [activeQuickActionIntent, setActiveQuickActionIntent] = useState<Exclude<AiEditIntent, "custom"> | null>(null);
  const [playCompactOpenAnimation, setPlayCompactOpenAnimation] = useState(open);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [rendered, setRendered] = useState(open);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const previousSubmittingRef = useRef(submitting);
  const { handleCompositionEnd, handleCompositionStart, isComposingEnter } = useImeInputGuard();
  const label = (key: I18nKey) => t(language, key);
  const canSubmit = prompt.trim().length > 0 && !submitting;
  const closing = commandState === "closing";
  const expanded = commandState === "expanded";
  const showingExpandedSurface = commandState === "expanded" || commandState === "collapsing" || (closing && closingFromExpanded);

  const setCommandStateValue = useCallback((nextState: AiCommandState) => {
    commandStateRef.current = nextState;
    setCommandState(nextState);
  }, []);

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
      setActiveQuickActionIntent(null);
      setClosingFromExpanded(false);
      setPlayCompactOpenAnimation(true);
      setQuickActionsVisible(false);
      setCommandStateValue("compact");
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
    setCommandStateValue("closing");
    setEntered(false);

    exitTimerRef.current = window.setTimeout(() => {
      setRendered(false);
      setClosingFromExpanded(false);
      setPlayCompactOpenAnimation(false);
      setCommandStateValue("compact");
      exitTimerRef.current = null;
    }, exitDurationMs);
  }, [clearCollapseTimer, clearExitTimer, open, setCommandStateValue]);

  useEffect(() => {
    if (previousSubmittingRef.current && !submitting) setActiveQuickActionIntent(null);
    previousSubmittingRef.current = submitting;
  }, [submitting]);

  useEffect(() => {
    if (supportsThinking) return;

    setThinkingEnabled(false);
  }, [supportsThinking]);

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

    setQuickActionsVisible(prompt.trim().length === 0);
    setCommandStateValue("expanded");
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [clearCollapseTimer, clearExitTimer, closing, expanded, open, prompt, setCommandStateValue]);

  const collapseCommand = useCallback(() => {
    if (!expanded) return;

    clearCollapseTimer();
    setPlayCompactOpenAnimation(false);
    setCommandStateValue("collapsing");
    collapseTimerRef.current = window.setTimeout(() => {
      setCommandStateValue("compact");
      collapseTimerRef.current = null;
    }, collapseDurationMs);
  }, [clearCollapseTimer, expanded, setCommandStateValue]);

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

  const thinkingOptions = () => (supportsThinking && thinkingEnabled ? { thinkingEnabled: true } : undefined);

  const submitCurrentPrompt = () => {
    const options = thinkingOptions();
    if (options) {
      onSubmit(undefined, "custom", options);
      return;
    }

    onSubmit();
  };

  const submitPromptOverride = (promptOverride: string, intent: AiEditIntent) => {
    const options = thinkingOptions();
    if (options) {
      onSubmit(promptOverride, intent, options);
      return;
    }

    onSubmit(promptOverride, intent);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setActiveQuickActionIntent(null);
    submitCurrentPrompt();
  };

  const handlePromptChange = (nextPrompt: string) => {
    if (submitting) return;
    if (nextPrompt.trim().length > 0) {
      setActiveQuickActionIntent(null);
      setQuickActionsVisible(false);
    }
    onPromptChange(nextPrompt);
  };

  const insertPromptNewline = (input: HTMLTextAreaElement) => {
    if (submitting) return;

    const start = input.selectionStart ?? prompt.length;
    const end = input.selectionEnd ?? start;
    const cursor = start + 1;
    const nextPrompt = `${prompt.slice(0, start)}\n${prompt.slice(end)}`;

    handlePromptChange(nextPrompt);
    window.setTimeout(() => {
      input.focus();
      input.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const handlePromptKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || isComposingEnter(event)) return;

    event.preventDefault();
    if (event.ctrlKey) {
      insertPromptNewline(event.currentTarget);
      return;
    }

    if (!canSubmit) return;
    setActiveQuickActionIntent(null);
    submitCurrentPrompt();
  };

  const handleQuickAction = (action: AiCommandAction) => {
    if (submitting) return;

    const quickPrompt = label(action.labelKey);
    setActiveQuickActionIntent(action.intent);
    setQuickActionsVisible(false);
    onPromptChange(quickPrompt);
    submitPromptOverride(quickPrompt, action.intent);
  };

  const quickActionSubmitting = submitting && activeQuickActionIntent !== null;
  const activeExpandedSurface = showingExpandedSurface || (submitting && !quickActionSubmitting);
  const unifiedExpandedSurface = quickActionSubmitting ? false : activeExpandedSurface || Boolean(aiResult);
  const showQuickActions = showingExpandedSurface && !aiResult && quickActionsVisible && !submitting;
  const showExpandedInput = unifiedExpandedSurface;
  const showCompactLoading = quickActionSubmitting && !showExpandedInput;
  const commandWidthClassName = showExpandedInput ? "max-w-205" : "max-w-176";
  const commandLayerStyle: CSSProperties = {
    left: editorLeftInset,
    right: editorRightInset
  };
  const inputPlaceholder =
    aiResult && aiResult.type !== "error"
      ? label("app.aiCommandCompactPlaceholder")
      : showExpandedInput
        ? label("app.aiCommandPlaceholder")
        : label("app.aiCommandCompactPlaceholder");
  const showModelSelector = showExpandedInput && availableModels.length > 1 && Boolean(onSelectModel);
  const showAgentStatus = showExpandedInput && submitting;
  const showThinkingToggle = showExpandedInput && supportsThinking;
  const compactLoadingText = activeQuickActionIntent
    ? label(aiCommandLoadingLabelKeys[activeQuickActionIntent])
    : label("app.aiAgentThinking");
  const renderSubmitButton = (compactSize: boolean) => (
    <button
      className={
        compactSize
          ? "inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--bg-active) p-0 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--accent) hover:text-(--bg-primary) focus-visible:bg-(--accent) focus-visible:text-(--bg-primary) focus-visible:outline-none disabled:cursor-default disabled:opacity-45 disabled:hover:bg-(--bg-active) disabled:hover:text-(--text-secondary)"
          : "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--bg-active) p-0 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--accent) hover:text-(--bg-primary) focus-visible:bg-(--accent) focus-visible:text-(--bg-primary) focus-visible:outline-none disabled:cursor-default disabled:opacity-45 disabled:hover:bg-(--bg-active) disabled:hover:text-(--text-secondary)"
      }
      type={submitting ? "button" : "submit"}
      disabled={!submitting && !canSubmit}
      aria-label={submitting ? label("app.aiCommandStop") : label("app.aiCommandSend")}
      onClick={submitting ? onInterrupt : undefined}
    >
      {submitting ? (
        <span className="relative inline-flex items-center justify-center">
          <LoaderCircle aria-hidden="true" className="ai-command-loading-icon animate-spin" size={17} />
          <Square aria-hidden="true" className="absolute" size={7} fill="currentColor" strokeWidth={0} />
        </span>
      ) : (
        <ArrowUp aria-hidden="true" size={17} />
      )}
    </button>
  );
  const renderAgentStatus = () => (
    <div
      className="flex min-w-0 flex-1 items-center text-[12px] leading-5 font-[560] text-(--text-secondary)"
      role="status"
      aria-live="polite"
    >
      <span className="ai-command-thinking-text truncate">{label("app.aiAgentThinking")}</span>
    </div>
  );
  const renderCompactLoadingStatus = () => (
    <div className="flex h-10 min-w-0 flex-1 items-center overflow-hidden text-[16px] leading-10" role="status" aria-live="polite">
      <span className="ai-command-inline-loading-text truncate">{compactLoadingText}</span>
    </div>
  );
  const commandForm = (
    <form
      className={
        unifiedExpandedSurface
            ? `ai-command-box flex min-h-21 origin-bottom ${closing ? "animate-[markra-ai-command-close_180ms_ease-in_both] " : ""}flex-col gap-2 rounded-lg border border-(--accent) bg-(--bg-primary) p-3 shadow-(--ai-command-expanded-shadow) transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none`
            : `ai-command-box flex h-14 origin-bottom ${closing ? "animate-[markra-ai-command-close_180ms_ease-in_both]" : playCompactOpenAnimation ? "animate-[markra-ai-command-open_220ms_ease-out_both]" : ""} items-center gap-3 rounded-xl border border-(--border-default) bg-(--bg-primary) px-4 py-2 shadow-(--ai-command-shadow) transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none`
      }
      data-state={commandState}
      onSubmit={handleSubmit}
    >
      <div className={showExpandedInput ? "flex w-full min-w-0 items-end gap-3" : "flex w-full min-w-0 items-center gap-3"}>
        <label className="sr-only" htmlFor="markra-ai-command-input">
          {label("app.aiCommandInput")}
        </label>
        {!showExpandedInput ? <Sparkles aria-hidden="true" className="shrink-0 self-center text-(--text-secondary)" size={18} /> : null}
        {showCompactLoading ? (
          renderCompactLoadingStatus()
        ) : (
          <textarea
            id="markra-ai-command-input"
            ref={inputRef}
            className={
              showExpandedInput
                ? "min-h-10 flex-1 resize-none border-0 bg-transparent p-0 text-[16px] leading-6 text-(--text-primary) outline-none placeholder:text-(--text-secondary)"
                : "h-10 min-h-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-[16px] leading-10 text-(--text-primary) outline-none placeholder:text-(--text-secondary)"
            }
            value={prompt}
            placeholder={inputPlaceholder}
            readOnly={submitting}
            aria-busy={submitting}
            rows={showExpandedInput ? 2 : 1}
            onClick={expandCommand}
            onChange={(event) => handlePromptChange(event.target.value)}
            onCompositionEnd={handleCompositionEnd}
            onCompositionStart={handleCompositionStart}
            onFocus={expandCommand}
            onKeyDown={handlePromptKeyDown}
            aria-label={label("app.aiCommandInput")}
          />
        )}
        {!showExpandedInput ? renderSubmitButton(false) : null}
      </div>
      {showExpandedInput ? (
        <div
          className={
            showAgentStatus
              ? "ai-command-footer flex w-full items-center justify-between gap-3"
              : showThinkingToggle
                ? "ai-command-footer flex w-full items-center justify-between gap-3"
                : "ai-command-footer flex w-full items-center justify-end gap-2"
          }
        >
          {showAgentStatus ? renderAgentStatus() : null}
          {!showAgentStatus && showThinkingToggle ? (
            <button
              className={`inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12px] leading-5 font-[620] transition-[background-color,border-color,color,opacity] duration-150 ease-out focus-visible:outline-none disabled:cursor-default disabled:opacity-50 ${
                thinkingEnabled
                  ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                  : "border-(--border-default) bg-(--bg-secondary) text-(--text-secondary) hover:border-(--accent) hover:text-(--accent)"
              }`}
              type="button"
              aria-label={label("app.aiDeepThinking")}
              aria-pressed={thinkingEnabled}
              disabled={submitting}
              onClick={() => setThinkingEnabled((enabled) => !enabled)}
            >
              <BrainCircuit aria-hidden="true" size={14} />
              <span>{label("app.aiDeepThinking")}</span>
            </button>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">
            {showModelSelector ? (
              <AiModelPicker
                ariaLabel={label("app.aiModelSelector")}
                disabled={submitting}
                models={availableModels}
                selectedModelId={selectedModelId}
                selectedProviderId={selectedProviderId}
                variant="footer"
                onSelect={onSelectModel}
                translate={(key) => label(key)}
              />
            ) : null}
            {renderSubmitButton(true)}
          </div>
        </div>
      ) : null}
    </form>
  );

  return (
    <section
      className={`ai-command-layer pointer-events-none fixed bottom-12 z-40 flex justify-center px-6 transition-[opacity,transform] duration-200 ease-out will-change-transform max-[760px]:bottom-8 max-[760px]:px-4 motion-reduce:transition-none ${entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0"}`}
      style={commandLayerStyle}
      role="dialog"
      aria-label={label("app.aiCommandDialog")}
      data-state={commandState}
    >
      <div
        ref={commandRef}
        className={`relative w-full ${commandWidthClassName} ${closing ? "pointer-events-none" : "pointer-events-auto"}`}
      >
        {showQuickActions ? (
          <div
            className={
              commandState === "collapsing" || closing
                ? "ai-command-actions absolute bottom-[calc(100%+10px)] left-0 w-66 animate-[markra-ai-float-out_160ms_ease-in_both] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-3 shadow-(--ai-command-popover-shadow) transition-[opacity,transform] duration-160 ease-in max-[760px]:hidden motion-reduce:animate-none motion-reduce:transition-none"
                : "ai-command-actions absolute bottom-[calc(100%+10px)] left-0 w-66 animate-[markra-ai-float-in_180ms_ease-out_both] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-3 shadow-(--ai-command-popover-shadow) transition-[opacity,transform] duration-180 ease-out max-[760px]:hidden motion-reduce:animate-none motion-reduce:transition-none"
            }
            aria-label={label("app.aiQuickActions")}
          >
            <div className="mb-2 px-2 text-[13px] leading-5 font-bold text-(--text-heading)">
              {label("app.aiToolkit")}
            </div>
            <div className="grid gap-0.5">
              {aiCommandActions.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    className="inline-flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-[13px] leading-5 font-[560] text-(--text-primary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
                    key={action.labelKey}
                    type="button"
                    onClick={() => handleQuickAction(action)}
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

        {commandForm}
      </div>
    </section>
  );
}
