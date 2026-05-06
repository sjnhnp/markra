import { useCallback, useRef, useState } from "react";
import { runDocumentAiAgent, type DocumentAiHistoryMessage } from "../lib/ai/agent/documentAgent";
import {
  applyAgentEventToProcesses,
  cancelAgentProcesses,
  createInitialAgentProcesses,
  failAgentProcesses,
  finalizeAgentProcesses,
  type AiAgentProcessItem
} from "../lib/ai/agent/agentProcessTrace";
import type { AgentWorkspaceFile } from "../lib/ai/agent/agentTools";
import { getProviderCapabilities } from "../lib/ai/agent/providerCapabilities";
import type { AiDiffResult, AiHeadingAnchor, AiSelectionContext } from "../lib/ai/agent/inlineAi";
import type { AiProviderConfig } from "../lib/ai/providers/aiProviders";
import type { I18nKey } from "../lib/i18n";

export type AiAgentPanelMessage = {
  activities?: AiAgentProcessItem[];
  id: number;
  isError?: boolean;
  role: "assistant" | "user";
  text: string;
  thinking?: string;
};

type AiAgentSessionContext = {
  documentPath?: string | null;
  getDocumentContent: () => string;
  getDocumentEndPosition?: () => number;
  getHeadingAnchors?: () => AiHeadingAnchor[];
  getSelection?: () => AiSelectionContext | null;
  model: string | null;
  onAiResult?: (result: AiDiffResult) => unknown;
  provider: AiProviderConfig | null;
  settingsLoading: boolean;
  translate?: (key: I18nKey) => string;
  workspaceFiles?: AgentWorkspaceFile[];
};

export function useAiAgentSession(ctx: AiAgentSessionContext) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AiAgentPanelMessage[]>([]);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "thinking" | "streaming" | "error">("idle");
  const requestIdRef = useRef(0);
  const assistantMessageIdRef = useRef<number | null>(null);

  const updateAssistantMessage = useCallback((updater: (message: AiAgentPanelMessage) => AiAgentPanelMessage) => {
    const assistantId = assistantMessageIdRef.current;
    if (assistantId === null) return;

    setMessages((currentMessages) =>
      currentMessages.map((message) => (message.id === assistantId ? updater(message) : message))
    );
  }, []);

  const interrupt = useCallback(() => {
    requestIdRef.current += 1;
    updateAssistantMessage((currentMessage) => ({
      ...currentMessage,
      activities: cancelAgentProcesses(currentMessage.activities ?? [])
    }));
    assistantMessageIdRef.current = null;
    setStatus("idle");
  }, [updateAssistantMessage]);

  const submit = useCallback(async (promptOverride?: string) => {
    const prompt = (promptOverride ?? draft).trim();
    if (!prompt) return;
    const message = (key: I18nKey) => ctx.translate?.(key) ?? key;

    if (ctx.settingsLoading) {
      setStatus("error");
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          isError: true,
          role: "assistant",
          text: message("app.aiSettingsLoading")
        }
      ]);
      return;
    }

    if (!ctx.provider || !ctx.model) {
      setStatus("error");
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          isError: true,
          role: "assistant",
          text: message("app.aiMissingProvider")
        }
      ]);
      return;
    }

    const capabilities = getProviderCapabilities(ctx.provider.id, ctx.provider.type);
    if (!capabilities.chat) {
      setStatus("error");
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: Date.now(),
          isError: true,
          role: "assistant",
          text: message("app.aiProviderUnsupported")
        }
      ]);
      return;
    }

    const userMessageId = Date.now();
    const assistantMessageId = userMessageId + 1;
    const history: DocumentAiHistoryMessage[] = messages
      .filter((item) => !item.isError)
      .map((item) => ({
        role: item.role,
        text: item.text
      }));
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    assistantMessageIdRef.current = assistantMessageId;
    setDraft("");
    setStatus("thinking");
    setMessages((currentMessages) => [
      ...currentMessages,
      { id: userMessageId, role: "user", text: prompt },
      {
        activities: createInitialAgentProcesses(message),
        id: assistantMessageId,
        role: "assistant",
        text: "",
        thinking: ""
      }
    ]);

    try {
      const response = await runDocumentAiAgent({
        documentContent: ctx.getDocumentContent(),
        documentEndPosition: ctx.getDocumentEndPosition?.() ?? 0,
        documentPath: ctx.documentPath ?? null,
        history,
        model: ctx.model,
        onPreviewResult: (result) => {
          ctx.onAiResult?.(result);
        },
        onEvent: (event) => {
          if (requestIdRef.current !== requestId) return;

          updateAssistantMessage((currentMessage) => ({
            ...currentMessage,
            activities: applyAgentEventToProcesses(currentMessage.activities ?? [], event, message)
          }));
        },
        onTextDelta: (text) => {
          if (requestIdRef.current !== requestId) return;
          setStatus("streaming");
          updateAssistantMessage((currentMessage) => ({
            ...currentMessage,
            text
          }));
        },
        onThinkingDelta: (thinking) => {
          if (requestIdRef.current !== requestId) return;

          setStatus("thinking");
          updateAssistantMessage((currentMessage) => ({
            ...currentMessage,
            thinking
          }));
        },
        prompt,
        provider: ctx.provider,
        headingAnchors: ctx.getHeadingAnchors?.() ?? [],
        selection: ctx.getSelection?.() ?? null,
        thinkingEnabled,
        webSearchEnabled,
        workspaceFiles: ctx.workspaceFiles ?? []
      });

      if (requestIdRef.current !== requestId) return;

      if (!response.content.trim()) {
        updateAssistantMessage((currentMessage) => ({
          ...currentMessage,
          activities: failAgentProcesses(currentMessage.activities ?? []),
          isError: true,
          text: message("app.aiEmptyResponse")
        }));
        setStatus("error");
        return;
      }

      updateAssistantMessage((currentMessage) => ({
        ...currentMessage,
        activities: finalizeAgentProcesses(currentMessage.activities ?? [], message, response.content.trim().length > 0),
        text: response.content
      }));
      setStatus("idle");
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      updateAssistantMessage((currentMessage) => ({
        ...currentMessage,
        activities: failAgentProcesses(currentMessage.activities ?? []),
        isError: true,
        text: error instanceof Error ? error.message : message("app.aiRequestFailed")
      }));
      setStatus("error");
    } finally {
      if (requestIdRef.current === requestId) assistantMessageIdRef.current = null;
    }
  }, [ctx, draft, messages, thinkingEnabled, updateAssistantMessage, webSearchEnabled]);

  return {
    draft,
    interrupt,
    messages,
    setDraft,
    setThinkingEnabled,
    setWebSearchEnabled,
    status,
    submit,
    thinkingEnabled,
    webSearchEnabled
  };
}
