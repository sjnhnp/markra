import { useCallback, useRef, useState } from "react";
import { buildInlineAiMessages } from "../lib/ai/agent/chatAdapters";
import { chatCompletion } from "../lib/ai/agent/chatCompletion";
import { getProviderCapabilities } from "../lib/ai/agent/providerCapabilities";
import type { AiDiffResult, AiSelectionContext } from "../lib/ai/agent/inlineAi";
import type { AiProviderConfig } from "../lib/ai/providers/aiProviders";
import type { I18nKey } from "../lib/i18n";

type AiTextDiffResult = Extract<AiDiffResult, { type: "insert" | "replace" }>;

type AiCommandContext = {
  getDocumentContent: () => string;
  getPendingResult?: () => AiDiffResult | null;
  getSelection: () => AiSelectionContext | null;
  model: string | null;
  onAiResult: (result: AiDiffResult) => unknown;
  provider: AiProviderConfig | null;
  settingsLoading: boolean;
  translate?: (key: I18nKey) => string;
};

export function useAiCommandUi(ctx: AiCommandContext) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef(0);

  const openAiCommand = useCallback((selectionOverride?: AiSelectionContext | null) => {
    const selection = selectionOverride === undefined ? ctx.getSelection() : selectionOverride;
    if (!hasSelectedText(selection)) return false;

    setOpen(true);
    return true;
  }, [ctx]);

  const closeAiCommand = useCallback(() => {
    setOpen(false);
  }, []);

  const restoreAiCommand = useCallback(() => {
    setOpen(true);
  }, []);

  const interruptPrompt = useCallback(() => {
    requestIdRef.current += 1;
    setSubmitting(false);
  }, []);

  const updatePrompt = useCallback((nextPrompt: string) => {
    setPrompt(nextPrompt);
  }, []);

  const submitPrompt = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || submitting) return;
    const message = (key: I18nKey) => ctx.translate?.(key) ?? key;

    if (ctx.settingsLoading) {
      ctx.onAiResult({ message: message("app.aiSettingsLoading"), type: "error" });
      return;
    }

    if (!ctx.provider || !ctx.model) {
      ctx.onAiResult({ message: message("app.aiMissingProvider"), type: "error" });
      return;
    }

    const capabilities = getProviderCapabilities(ctx.provider.id, ctx.provider.type);
    if (!capabilities.chat) {
      ctx.onAiResult({ message: message("app.aiProviderUnsupported"), type: "error" });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSubmitting(true);
    try {
      const selection = ctx.getSelection();
      const target = getAiCommandTarget(selection, ctx.getPendingResult?.());
      if (!target) return;

      const response = await chatCompletion(
        ctx.provider,
        ctx.model,
        buildInlineAiMessages(trimmedPrompt, target.promptText, ctx.getDocumentContent(), target.suggestionContext)
      );
      if (requestIdRef.current !== requestId) return;

      ctx.onAiResult({
        from: target.from,
        original: target.original,
        replacement: response.content,
        to: target.to,
        type: target.type
      });
      setPrompt("");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      ctx.onAiResult({
        message: error instanceof Error ? error.message : message("app.aiRequestFailed"),
        type: "error"
      });
    } finally {
      if (requestIdRef.current === requestId) setSubmitting(false);
    }
  }, [ctx, prompt, submitting]);

  return {
    closeAiCommand,
    interruptPrompt,
    openAiCommand,
    open,
    prompt,
    restoreAiCommand,
    submitPrompt,
    submitting,
    updatePrompt
  };
}

function hasSelectedText(selection: AiSelectionContext | null | undefined): selection is AiSelectionContext {
  return Boolean(selection?.text.trim());
}

function getAiCommandTarget(selection: AiSelectionContext | null, pendingResult: AiDiffResult | null | undefined) {
  if (hasSelectedText(selection)) {
    return {
      from: selection.from,
      original: selection.text,
      promptText: selection.text,
      to: selection.to,
      type: "replace" as const
    };
  }

  if (!isTextDiffResult(pendingResult)) return null;

  // Follow-up prompts should refine the visible suggestion while keeping the original diff anchor intact.
  return {
    from: pendingResult.from,
    original: pendingResult.original,
    promptText: pendingResult.replacement,
    suggestionContext: {
      original: pendingResult.original,
      replacement: pendingResult.replacement
    },
    to: pendingResult.to,
    type: pendingResult.type
  };
}

function isTextDiffResult(result: AiDiffResult | null | undefined): result is AiTextDiffResult {
  return result?.type === "insert" || result?.type === "replace";
}
