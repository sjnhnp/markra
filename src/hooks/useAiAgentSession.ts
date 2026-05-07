import { useCallback, useEffect, useRef, useState } from "react";
import { runDocumentAiAgent, type DocumentAiHistoryMessage } from "../lib/ai/agent/documentAgent";
import { generateAiAgentSessionTitle } from "../lib/ai/agent/sessionTitle";
import {
  applyAgentEventToProcesses,
  cancelAgentProcesses,
  createInitialAgentProcesses,
  failAgentProcesses,
  finalizeAgentProcesses
} from "../lib/ai/agent/agentProcessTrace";
import {
  createDefaultAiAgentSessionState,
  type AiAgentSessionPreview,
  type AiAgentSessionMessage,
  type StoredAiAgentSessionState
} from "../lib/ai/agent/agentSessionState";
import type { AgentWorkspaceFile } from "../lib/ai/agent/agentTools";
import { getProviderCapabilities } from "../lib/ai/agent/providerCapabilities";
import type { AiDiffResult, AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "../lib/ai/agent/inlineAi";
import type { AiProviderConfig } from "../lib/ai/providers/aiProviders";
import type { I18nKey } from "../lib/i18n";
import {
  getStoredAiAgentSession,
  getStoredAiAgentSessionSummary,
  saveStoredAiAgentSession,
  saveStoredAiAgentSessionTitle
} from "../lib/settings/appSettings";

export type AiAgentPanelMessage = AiAgentSessionMessage;

type AiAgentSessionContext = {
  documentPath?: string | null;
  getDocumentContent: () => string;
  getDocumentEndPosition?: () => number;
  getHeadingAnchors?: () => AiHeadingAnchor[];
  getSelection?: () => AiSelectionContext | null;
  getTableAnchors?: () => AiDocumentAnchor[];
  model: string | null;
  onAiResult?: (result: AiDiffResult) => unknown;
  onSessionRestore?: (session: Pick<StoredAiAgentSessionState, "panelOpen" | "panelWidth">) => unknown;
  panelOpen?: boolean;
  panelWidth?: number | null;
  provider: AiProviderConfig | null;
  readWorkspaceFile?: (path: string) => Promise<string>;
  sessionId?: string | null;
  settingsLoading: boolean;
  translate?: (key: I18nKey) => string;
  workspaceKey?: string | null;
  workspaceFiles?: AgentWorkspaceFile[];
};

export function useAiAgentSession(ctx: AiAgentSessionContext) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<AiAgentPanelMessage[]>([]);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "thinking" | "streaming" | "error">("idle");
  const [titleVersion, setTitleVersion] = useState(0);
  const requestIdRef = useRef(0);
  const assistantMessageIdRef = useRef<number | null>(null);
  const hydratedSessionKeyRef = useRef<string | null>(null);
  const didRestorePanelStateRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const skipNextPersistRef = useRef(false);
  const sessionTitleSourceRef = useRef<"ai" | "fallback" | "manual" | null>(null);
  const titleGenerationSignatureRef = useRef<string | null>(null);
  const sessionKey = ctx.sessionId?.trim() ? ctx.sessionId : null;

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

  useEffect(() => {
    let active = true;

    requestIdRef.current += 1;
    const hydrationRequestId = requestIdRef.current;
    assistantMessageIdRef.current = null;
    hydratedSessionKeyRef.current = null;
    skipNextPersistRef.current = false;
    sessionTitleSourceRef.current = null;
    titleGenerationSignatureRef.current = null;
    setStatus("idle");
    const shouldRestorePanelState = !didRestorePanelStateRef.current;

    if (!sessionKey) {
      const defaultSession = createDefaultAiAgentSessionState();
      setDraft(defaultSession.draft);
      setMessages(defaultSession.messages);
      setThinkingEnabled(defaultSession.thinkingEnabled);
      setWebSearchEnabled(defaultSession.webSearchEnabled);
      hydratedSessionKeyRef.current = null;
      skipNextPersistRef.current = true;
      return () => {
        active = false;
      };
    }

    Promise.all([getStoredAiAgentSession(sessionKey), getStoredAiAgentSessionSummary(sessionKey)])
      .then(([storedSession, storedSummary]) => {
        if (!active) return;
        if (requestIdRef.current !== hydrationRequestId) {
          hydratedSessionKeyRef.current = sessionKey;
          return;
        }

        setDraft(storedSession.draft);
        setMessages(storedSession.messages);
        setThinkingEnabled(storedSession.thinkingEnabled);
        setWebSearchEnabled(storedSession.webSearchEnabled);
        sessionTitleSourceRef.current = storedSummary?.titleSource ?? null;
        if (shouldRestorePanelState) {
          ctx.onSessionRestore?.({
            panelOpen: storedSession.panelOpen,
            panelWidth: storedSession.panelWidth
          });
          didRestorePanelStateRef.current = true;
        }
        hydratedSessionKeyRef.current = sessionKey;
        skipNextPersistRef.current = true;
      })
      .catch(() => {
        if (!active) return;
        if (requestIdRef.current !== hydrationRequestId) {
          hydratedSessionKeyRef.current = sessionKey;
          return;
        }

        const defaultSession = createDefaultAiAgentSessionState();
        setDraft(defaultSession.draft);
        setMessages(defaultSession.messages);
        setThinkingEnabled(defaultSession.thinkingEnabled);
        setWebSearchEnabled(defaultSession.webSearchEnabled);
        sessionTitleSourceRef.current = null;
        if (shouldRestorePanelState) {
          ctx.onSessionRestore?.({
            panelOpen: defaultSession.panelOpen,
            panelWidth: defaultSession.panelWidth
          });
          didRestorePanelStateRef.current = true;
        }
        hydratedSessionKeyRef.current = sessionKey;
        skipNextPersistRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [ctx.onSessionRestore, sessionKey]);

  useEffect(() => {
    if (hydratedSessionKeyRef.current !== sessionKey) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      saveStoredAiAgentSession(sessionKey, {
        draft,
        messages,
        panelOpen: ctx.panelOpen === true,
        panelWidth: ctx.panelWidth ?? null,
        thinkingEnabled,
        webSearchEnabled
      }, {
        workspaceKey: ctx.workspaceKey ?? null
      }).catch(() => {});
    }, 120);

    return () => {
      if (persistTimerRef.current === null) return;
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    };
  }, [ctx.panelOpen, ctx.panelWidth, ctx.workspaceKey, draft, messages, sessionKey, thinkingEnabled, webSearchEnabled]);

  useEffect(() => {
    if (!sessionKey) return;
    if (hydratedSessionKeyRef.current !== sessionKey) return;
    if (ctx.settingsLoading) return;
    if (!ctx.provider || !ctx.model) return;
    if (status !== "idle") return;
    if (sessionTitleSourceRef.current === "ai" || sessionTitleSourceRef.current === "manual") return;

    const transcriptMessages = messages
      .filter((message) => !message.isError && message.text.trim().length > 0)
      .map((message) => ({
        role: message.role,
        text: message.text.trim()
      }));

    if (!transcriptMessages.some((message) => message.role === "user")) return;
    if (!transcriptMessages.some((message) => message.role === "assistant")) return;

    const generationSignature = JSON.stringify(transcriptMessages);
    if (titleGenerationSignatureRef.current === generationSignature) return;

    titleGenerationSignatureRef.current = generationSignature;
    let active = true;

    generateAiAgentSessionTitle({
      messages: transcriptMessages,
      model: ctx.model,
      provider: ctx.provider
    })
      .then((title) => {
        if (!active) return;
        if (!title) return;
        if (hydratedSessionKeyRef.current !== sessionKey) return;

        return saveStoredAiAgentSessionTitle(sessionKey, title, {
          workspaceKey: ctx.workspaceKey ?? null
        }).then(() => {
          sessionTitleSourceRef.current = "ai";
          setTitleVersion((currentVersion) => currentVersion + 1);
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [ctx.model, ctx.provider, ctx.settingsLoading, ctx.workspaceKey, messages, sessionKey, status]);

  const submit = useCallback(async (promptOverride?: string) => {
    const prompt = (promptOverride ?? draft).trim();
    if (!prompt) return;
    const message = (key: I18nKey) => ctx.translate?.(key) ?? key;
    const requestId = requestIdRef.current + 1;

    requestIdRef.current = requestId;
    assistantMessageIdRef.current = null;

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
        preview: item.preview,
        role: item.role,
        text: item.text
      }));
    assistantMessageIdRef.current = assistantMessageId;
    setDraft("");
    setStatus("thinking");
    let preparedEditorPreview = false;
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
          if (requestIdRef.current !== requestId) return;

          const preview = sessionPreviewFromAiResult(result);
          if (preview) {
            preparedEditorPreview = true;
            updateAssistantMessage((currentMessage) => ({
              ...currentMessage,
              preview
            }));
          }
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
        readWorkspaceFile: ctx.readWorkspaceFile,
        headingAnchors: ctx.getHeadingAnchors?.() ?? [],
        selection: ctx.getSelection?.() ?? null,
        tableAnchors: ctx.getTableAnchors?.(),
        thinkingEnabled,
        webSearchEnabled,
        workspaceFiles: ctx.workspaceFiles ?? []
      });

      if (requestIdRef.current !== requestId) return;

      if (!response.content.trim()) {
        if (preparedEditorPreview || response.preparedPreview) {
          updateAssistantMessage((currentMessage) => ({
            ...currentMessage,
            activities: finalizeAgentProcesses(currentMessage.activities ?? [], message, true),
            text: message("app.aiAgentPreviewReady")
          }));
          setStatus("idle");
          return;
        }

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
    titleVersion,
    webSearchEnabled
  };
}

function sessionPreviewFromAiResult(result: AiDiffResult): AiAgentSessionPreview | undefined {
  if (result.type === "error") return undefined;

  return {
    from: result.from,
    original: result.original,
    replacement: result.replacement,
    to: result.to,
    type: result.type
  };
}
