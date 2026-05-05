import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowUp,
  FileText,
  Languages,
  LoaderCircle,
  PenLine,
  Plus,
  Sparkles,
  Square,
  type LucideIcon
} from "lucide-react";
import type { AiDiffResult } from "../lib/ai/agent/inlineAi";
import { t, type AppLanguage, type I18nKey } from "../lib/i18n";

type AiCommandAction = {
  icon: LucideIcon;
  labelKey: I18nKey;
};

type AiCommandModelOption = {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
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
  aiResult?: AiDiffResult | null;
  availableModels?: AiCommandModelOption[];
  editorLeftInset?: string;
  language?: AppLanguage;
  open: boolean;
  prompt: string;
  selectedModelId?: string | null;
  selectedProviderId?: string | null;
  submitting?: boolean;
  onClose: () => unknown;
  onInterrupt?: () => unknown;
  onPromptChange: (prompt: string) => unknown;
  onSelectModel?: (providerId: string, modelId: string) => unknown;
  onSubmit: () => unknown;
};

export function AiCommandBar({
  aiResult = null,
  availableModels = [],
  editorLeftInset = "0px",
  language = "en",
  open,
  prompt,
  selectedModelId = null,
  selectedProviderId = null,
  submitting = false,
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
  const [playCompactOpenAnimation, setPlayCompactOpenAnimation] = useState(open);
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const [rendered, setRendered] = useState(open);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  };

  const handlePromptChange = (nextPrompt: string) => {
    if (submitting) return;
    if (nextPrompt.trim().length > 0) setQuickActionsVisible(false);
    onPromptChange(nextPrompt);
  };

  const handleQuickAction = (action: AiCommandAction) => {
    if (submitting) return;

    const quickPrompt = label(action.labelKey);
    setQuickActionsVisible(false);
    onPromptChange(quickPrompt);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const showQuickActions = showingExpandedSurface && !aiResult && quickActionsVisible && !submitting;
  const showExpandedInput = showingExpandedSurface || Boolean(aiResult);
  const commandLayerStyle: CSSProperties = {
    left: editorLeftInset,
    right: 0
  };
  const inputPlaceholder =
    aiResult && aiResult.type !== "error"
      ? label("app.aiCommandCompactPlaceholder")
      : showExpandedInput
        ? label("app.aiCommandPlaceholder")
        : label("app.aiCommandCompactPlaceholder");
  const selectedModelValue =
    selectedProviderId && selectedModelId ? getAiModelOptionValue(selectedProviderId, selectedModelId) : "";
  const hasSelectedModel = availableModels.some(
    (model) => getAiModelOptionValue(model.providerId, model.id) === selectedModelValue
  );
  const modelSelectValue = hasSelectedModel ? selectedModelValue : "";
  const showModelSelector = showExpandedInput && availableModels.length > 1 && Boolean(onSelectModel);
  const handleModelChange = (value: string) => {
    if (!onSelectModel) return;

    const modelSelection = parseAiModelOptionValue(value);
    if (!modelSelection) return;

    onSelectModel(modelSelection.providerId, modelSelection.modelId);
  };
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
  const commandForm = (
    <form
      className={
        aiResult
          ? "ai-command-box flex min-h-14 flex-col gap-2 border-0 border-t border-(--border-default) bg-transparent p-3 shadow-none"
          : showingExpandedSurface
            ? `ai-command-box flex min-h-21 origin-bottom ${closing ? "animate-[markra-ai-command-close_180ms_ease-in_both] " : ""}flex-col gap-2 rounded-lg border border-(--accent) bg-(--bg-primary) p-3 shadow-[var(--ai-command-expanded-shadow)] transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none`
            : `ai-command-box flex h-14 origin-bottom ${closing ? "animate-[markra-ai-command-close_180ms_ease-in_both]" : playCompactOpenAnimation ? "animate-[markra-ai-command-open_220ms_ease-out_both]" : ""} items-center gap-3 rounded-xl border border-(--border-default) bg-(--bg-primary) px-4 py-2 shadow-[var(--ai-command-shadow)] transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none`
      }
      data-state={commandState}
      onSubmit={handleSubmit}
    >
      <div className={showExpandedInput ? "flex w-full min-w-0 items-end gap-3" : "flex w-full min-w-0 items-center gap-3"}>
        <label className="sr-only" htmlFor="markra-ai-command-input">
          {label("app.aiCommandInput")}
        </label>
        {!showExpandedInput ? <Sparkles aria-hidden="true" className="shrink-0 self-center text-(--text-secondary)" size={18} /> : null}
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
          onFocus={expandCommand}
          aria-label={label("app.aiCommandInput")}
        />
        {!showExpandedInput ? renderSubmitButton(false) : null}
      </div>
      {showExpandedInput ? (
        <div className="ai-command-footer flex w-full items-center justify-end gap-2">
          {showModelSelector ? (
            <div className="flex min-w-0 items-center">
              <label className="sr-only" htmlFor="markra-ai-model-select">
                {label("app.aiModelSelector")}
              </label>
              <select
                id="markra-ai-model-select"
                className="h-7 max-w-68 cursor-pointer rounded-md border border-(--border-default) bg-(--bg-secondary) px-2 text-[12px] leading-5 font-[560] text-(--text-secondary) outline-none transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus:border-(--accent) focus:text-(--text-primary) disabled:cursor-default disabled:opacity-50"
                value={modelSelectValue}
                disabled={submitting}
                aria-label={label("app.aiModelSelector")}
                onChange={(event) => handleModelChange(event.target.value)}
              >
                <option value="" disabled>
                  {label("app.aiModelSelector")}
                </option>
                {availableModels.map((model) => (
                  <option
                    key={getAiModelOptionValue(model.providerId, model.id)}
                    value={getAiModelOptionValue(model.providerId, model.id)}
                  >
                    {model.providerName} · {model.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {renderSubmitButton(true)}
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
      <div ref={commandRef} className={`relative w-full max-w-205 ${closing ? "pointer-events-none" : "pointer-events-auto"}`}>
        {showQuickActions ? (
          <div
            className={
              commandState === "collapsing" || closing
                ? "ai-command-actions absolute bottom-[calc(100%+10px)] left-0 w-66 animate-[markra-ai-float-out_160ms_ease-in_both] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-3 shadow-[var(--ai-command-popover-shadow)] transition-[opacity,transform] duration-160 ease-in max-[760px]:hidden motion-reduce:animate-none motion-reduce:transition-none"
                : "ai-command-actions absolute bottom-[calc(100%+10px)] left-0 w-66 animate-[markra-ai-float-in_180ms_ease-out_both] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-3 shadow-[var(--ai-command-popover-shadow)] transition-[opacity,transform] duration-180 ease-out max-[760px]:hidden motion-reduce:animate-none motion-reduce:transition-none"
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

        {aiResult ? (
          <div className="ai-command-panel origin-bottom overflow-hidden rounded-lg border border-(--border-default) bg-(--bg-primary) shadow-[var(--ai-command-panel-shadow)]">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] leading-5 font-bold text-(--text-heading)">
                  {aiResult.type === "error" ? label("app.aiSuggestionError") : label("app.aiSuggestionReady")}
                </div>
                {aiResult.type === "error" ? (
                  <p className="m-0 truncate text-[12px] leading-4 text-(--text-secondary)">{aiResult.message}</p>
                ) : null}
              </div>
            </div>
            {commandForm}
          </div>
        ) : (
          commandForm
        )}
      </div>
    </section>
  );
}

function getAiModelOptionValue(providerId: string, modelId: string) {
  return `${providerId}::${modelId}`;
}

function parseAiModelOptionValue(value: string) {
  const [providerId, ...modelIdParts] = value.split("::");
  const modelId = modelIdParts.join("::");

  if (!providerId || !modelId) return null;

  return { modelId, providerId };
}
