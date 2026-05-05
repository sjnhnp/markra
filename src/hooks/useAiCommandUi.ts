import { useCallback, useEffect, useRef, useState } from "react";
import { buildInlineAiMessages } from "../lib/agent/chatAdapters";
import { chatCompletion } from "../lib/agent/chatCompletion";
import { getProviderCapabilities } from "../lib/agent/providerCapabilities";
import type { AiDiffResult, AiSelectionContext } from "../lib/agent/inlineAi";
import type { AiProviderConfig } from "../lib/aiProviders";
import type { I18nKey } from "../lib/i18n";

type AiCommandContext = {
  getDocumentContent: () => string;
  getSelection: () => AiSelectionContext | null;
  model: string | null;
  onAiResult: (result: AiDiffResult) => void;
  provider: AiProviderConfig | null;
  settingsLoading: boolean;
  translate?: (key: I18nKey) => string;
};

export function useAiCommandUi(ctx: AiCommandContext) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestIdRef = useRef(0);

  const openAiCommand = useCallback(() => {
    setOpen(true);
  }, []);

  const closeAiCommand = useCallback(() => {
    setOpen(false);
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
      const selectedText = selection?.text ?? "";
      const response = await chatCompletion(
        ctx.provider,
        ctx.model,
        buildInlineAiMessages(trimmedPrompt, selectedText, ctx.getDocumentContent())
      );
      if (requestIdRef.current !== requestId) return;

      ctx.onAiResult(
        selectedText
          ? {
              from: selection?.from,
              original: selectedText,
              replacement: response.content,
              to: selection?.to,
              type: "replace"
            }
          : {
              from: selection?.from,
              original: "",
              replacement: response.content,
              to: selection?.to,
              type: "insert"
            }
      );
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

  useEffect(() => {
    const handleAiShortcut = (event: KeyboardEvent) => {
      const isModKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isModKey && !event.altKey && !event.shiftKey && key === "j") {
        event.preventDefault();
        openAiCommand();
        return;
      }

    };

    window.addEventListener("keydown", handleAiShortcut);
    return () => {
      window.removeEventListener("keydown", handleAiShortcut);
    };
  }, [openAiCommand]);

  return {
    closeAiCommand,
    interruptPrompt,
    openAiCommand,
    open,
    prompt,
    submitPrompt,
    submitting,
    updatePrompt
  };
}
