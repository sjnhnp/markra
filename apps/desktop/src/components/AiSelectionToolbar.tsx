import { type CSSProperties } from "react";
import { FileText, Languages, PenLine, Plus, Sparkles, WandSparkles, type LucideIcon } from "lucide-react";
import type { AiEditIntent } from "@markra/ai";
import { t, type AppLanguage, type I18nKey } from "@markra/shared";
import type { SelectionAnchor } from "../lib/selection-anchor";

type AiSelectionAction = {
  icon: LucideIcon;
  intent: Exclude<AiEditIntent, "custom">;
  labelKey: I18nKey;
};

type AiSelectionToolbarProps = {
  anchor: SelectionAnchor | null;
  busy?: boolean;
  language?: AppLanguage;
  open: boolean;
  onOpenCommand: () => unknown;
  onRunAction: (intent: Exclude<AiEditIntent, "custom">, prompt: string) => unknown;
};

const toolbarOffsetPx = 12;

const aiSelectionActions: AiSelectionAction[] = [
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

export function AiSelectionToolbar({
  anchor,
  busy = false,
  language = "en",
  open,
  onOpenCommand,
  onRunAction
}: AiSelectionToolbarProps) {
  if (!open || !anchor) return null;

  const label = (key: I18nKey) => t(language, key);
  const style: CSSProperties = {
    left: `${Math.round((anchor.left + anchor.right) / 2)}px`,
    top: `${Math.max(12, Math.round(anchor.top - toolbarOffsetPx))}px`
  };

  return (
    <section
      className="ai-selection-toolbar pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full animate-[markra-ai-float-in_160ms_ease-out_both] motion-reduce:animate-none"
      style={style}
      role="toolbar"
      aria-label={label("app.aiQuickActions")}
    >
      <div className="pointer-events-auto inline-flex max-w-[calc(100vw-24px)] items-center gap-1 rounded-lg border border-(--border-default) bg-(--bg-primary) p-1 shadow-(--ai-command-popover-shadow)">
        <button
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-(--accent-soft) px-2.5 text-[13px] leading-5 font-[650] text-(--accent) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) disabled:cursor-default disabled:opacity-55"
          type="button"
          disabled={busy}
          title={label("app.aiCommandInput")}
          onClick={onOpenCommand}
          aria-label={label("app.aiCommandInput")}
        >
          <WandSparkles aria-hidden="true" size={15} />
          <span className="whitespace-nowrap">AI</span>
        </button>
        <span className="mx-0.5 h-5 w-px bg-(--border-default)" aria-hidden="true" />
        {aiSelectionActions.map((action) => {
          const Icon = action.icon;
          const actionLabel = label(action.labelKey);

          return (
            <button
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-[13px] leading-5 font-[560] text-(--text-primary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) disabled:cursor-default disabled:opacity-55 max-[720px]:px-2"
              key={action.labelKey}
              type="button"
              disabled={busy}
              title={actionLabel}
              onClick={() => onRunAction(action.intent, actionLabel)}
              aria-label={actionLabel}
            >
              <Icon aria-hidden="true" size={14} />
              <span className="hidden whitespace-nowrap sm:inline">{actionLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
