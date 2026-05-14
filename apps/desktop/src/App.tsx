import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AppToaster } from "./components/AppToaster";
import { AiCommandBar } from "./components/AiCommandBar";
import { AiAgentPanel } from "./components/AiAgentPanel";
import { ImagePreview } from "./components/ImagePreview";
import {
  MarkdownExportDocument,
  type RenderedMarkdownExport,
  type MarkdownExportSnapshot
} from "./components/MarkdownExportDocument";
import { MarkdownFileTreeDrawer } from "./components/MarkdownFileTreeDrawer";
import { MarkdownPaper } from "./components/MarkdownPaper";
import { MarkdownSourceEditor } from "./components/MarkdownSourceEditor";
import { MarkdownTabsBar, type MarkdownTabsBarItem } from "./components/MarkdownTabsBar";
import { NativeTitleBar } from "./components/NativeTitleBar";
import { QuietStatus } from "./components/QuietStatus";
import { SettingsWindow } from "./components/SettingsWindow";
import { useAppLanguage } from "./hooks/useAppLanguage";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAiCommandUi } from "./hooks/useAiCommandUi";
import {
  shouldCloseAiCommandOnAgentPanelOpen,
  shouldHideAiCommandForAiAgentPanel
} from "./hooks/ai-agent-panel-visibility";
import { useAiAgentSessionList } from "./hooks/useAiAgentSessionList";
import { useAiAgentSession } from "./hooks/useAiAgentSession";
import { useAiSettings } from "./hooks/useAiSettings";
import { useEditorPreferences } from "./hooks/useEditorPreferences";
import { useExportSettings } from "./hooks/useExportSettings";
import { shouldFocusEditorOnReady, useEditorController } from "./hooks/useEditorController";
import { useMarkdownDocument } from "./hooks/useMarkdownDocument";
import { useMarkdownFileTree } from "./hooks/useMarkdownFileTree";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import { useDefaultContextMenuBlocker } from "./hooks/useDefaultContextMenuBlocker";
import { useWebSearchSettings } from "./hooks/useWebSearchSettings";
import {
  useApplicationShortcuts,
  useNativeMarkdownDrop,
  useNativeMenuHandlers,
  useNativeMenus
} from "./hooks/useNativeBindings";
import { aiTranslationLanguageName, t, type I18nKey } from "@markra/shared";
import { showAppToast } from "./lib/app-toast";
import { createMarkdownImageSrcResolver } from "@markra/markdown";
import { buildMarkdownHtmlDocument, exportDocumentFileName, localFileUrlFromPath } from "./lib/document-export";
import type { EditorContentWidth } from "./lib/editor-width";
import { openNativeExternalUrl, openSettingsWindow } from "./lib/tauri";
import type { AiDiffResult, AiEditIntent, AiSelectionContext } from "@markra/ai";
import {
  AI_EDITOR_PREVIEW_APPLIED_EVENT,
  AI_EDITOR_PREVIEW_ACTION_EVENT,
  AI_EDITOR_PREVIEW_RESTORE_EVENT,
  type AiEditorPreviewAppliedDetail,
  type AiEditorPreviewActionDetail,
  type AiEditorPreviewRestoreDetail
} from "@markra/editor";
import { aiAgentWebSearchAvailable } from "@markra/ai";
import {
  deleteStoredAiAgentSession,
  initializeStoredAiAgentSession,
  saveStoredEditorPreferences,
  saveStoredAiAgentSessionTitle,
  setStoredAiAgentSessionArchived,
  type TitlebarActionPreference
} from "./lib/settings/app-settings";
import { notifyAppEditorPreferencesChanged } from "./lib/settings/settings-events";
import {
  confirmNativeMarkdownFileDelete,
  confirmNativeUnsavedMarkdownDocumentDiscard,
  readNativeMarkdownImageFile,
  readNativeMarkdownFile,
  saveNativeClipboardImage,
  saveNativeHtmlFile,
  saveNativePdfFile,
  type NativeMarkdownFolderFile
} from "./lib/tauri";
import { debug } from "@markra/shared";
import { clampNumber } from "@markra/shared";

const aiAgentPanelDefaultWidth = 384;
const aiAgentPanelMinWidth = 320;
const aiAgentPanelMaxWidth = 760;
const aiResultSignatureSeparator = "\u001f";

type ImageDocumentTab = NativeMarkdownFolderFile & {
  id: string;
};

function imageDocumentTabId(path: string) {
  return `image:${path}`;
}

function createImageDocumentTab(file: NativeMarkdownFolderFile): ImageDocumentTab {
  return {
    ...file,
    id: imageDocumentTabId(file.path)
  };
}

function documentTabAsFolderFile(tab: MarkdownTabsBarItem): NativeMarkdownFolderFile | null {
  if (!tab.path) return null;

  return {
    ...(tab.displayKind === "image" ? { kind: "asset" as const } : {}),
    name: tab.name || "Untitled.md",
    path: tab.path,
    relativePath: tab.path
  };
}
type AiQuickActionIntent = Exclude<AiEditIntent, "custom">;

function isSettingsWindowRoute() {
  return new URLSearchParams(window.location.search).has("settings");
}

function aiResultSignature(result: AiDiffResult) {
  if (result.type === "error") return `error${aiResultSignatureSeparator}${result.message}`;

  return [
    result.type,
    result.from,
    result.to,
    result.original,
    result.replacement
  ].join(aiResultSignatureSeparator);
}

function aiPreviewActionKey(result: AiDiffResult, previewId?: string) {
  return previewId ? `preview${aiResultSignatureSeparator}${previewId}` : `result${aiResultSignatureSeparator}${aiResultSignature(result)}`;
}

function explicitAiTextSelection(selection: AiSelectionContext | null | undefined) {
  if (selection?.source !== "selection" || !selection.text.trim()) return null;

  return selection;
}

function aiCommandTextSelection(selection: AiSelectionContext | null | undefined) {
  if (!selection?.text.trim()) return null;

  return selection;
}

export default function App() {
  if (isSettingsWindowRoute()) {
    return <SettingsWindow />;
  }

  const appTheme = useAppTheme();
  const appLanguage = useAppLanguage();
  const aiSettings = useAiSettings();
  const editorPreferences = useEditorPreferences();
  const exportSettings = useExportSettings();
  const webSearchSettings = useWebSearchSettings();
  const [aiAgentSessionId, setAiAgentSessionId] = useState<string | null>(null);
  const [aiAgentOpen, setAiAgentOpen] = useState(false);
  const [aiAgentPanelWidth, setAiAgentPanelWidth] = useState(aiAgentPanelDefaultWidth);
  const [aiAgentPanelResizing, setAiAgentPanelResizing] = useState(false);
  const [editorContentWidth, setEditorContentWidth] = useState<EditorContentWidth>("default");
  const [editorContentWidthPx, setEditorContentWidthPx] = useState<number | null>(null);
  const [aiResults, setAiResults] = useState<AiDiffResult[]>([]);
  const [activeImageFile, setActiveImageFile] = useState<NativeMarkdownFolderFile | null>(null);
  const [imageTabs, setImageTabs] = useState<ImageDocumentTab[]>([]);
  const [activeAiSelection, setActiveAiSelection] = useState<AiSelectionContext | null>(null);
  const [aiContextMenuActionPending, setAiContextMenuActionPending] = useState(false);
  const [editorMode, setEditorMode] = useState<"source" | "visual">("visual");
  const [exportSnapshot, setExportSnapshot] = useState<MarkdownExportSnapshot | null>(null);
  const sourceMode = editorMode === "source";
  const aiResultsRef = useRef<AiDiffResult[]>([]);
  const appliedAiPreviewKeysRef = useRef(new Set<string>());
  const activeAiSelectionRef = useRef<AiSelectionContext | null>(null);
  const aiContextMenuActionIdRef = useRef(0);
  const exportRequestIdRef = useRef(0);
  const pendingEditorContentWidthPxRef = useRef<number | null>(null);
  const exportContextRef = useRef({
    activeImageFile: false,
    content: "",
    hasOpenDocument: false,
    name: "Untitled.md"
  });
  const reconciledAiWorkspaceKeyRef = useRef<string | null | undefined>(undefined);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);
  const editor = useEditorController();
  useDefaultContextMenuBlocker();
  const fileTree = useMarkdownFileTree({
    onWorkspaceSessionChange: setAiAgentSessionId
  });
  const {
    files: fileTreeFiles,
    createFile: createMarkdownTreeFile,
    createFolder: createMarkdownTreeFolder,
    deleteFile: deleteMarkdownTreeFile,
    open: fileTreeOpen,
    openFolderPath,
    openMarkdownFolder,
    renameFile: renameMarkdownTreeFile,
    refresh: refreshMarkdownFileTree,
    resizing: fileTreeResizing,
    resize: resizeFileTree,
    endResize: endFileTreeResize,
    rootNameForDocument,
    setRootFromMarkdownFilePath,
    startResize: startFileTreeResize,
    toggle: toggleFileTree,
    width: fileTreeWidth,
    maxWidth: fileTreeMaxWidth,
    minWidth: fileTreeMinWidth,
    workspaceLayoutClassName,
    workspaceLayoutStyle
  } = fileTree;
  const confirmDiscardUnsavedChanges = useCallback((currentDocument: { name: string }) => {
    return confirmNativeUnsavedMarkdownDocumentDiscard(currentDocument.name, {
      cancelLabel: translate("app.cancelDiscardUnsavedMarkdownDocument"),
      message: translate("app.confirmDiscardUnsavedMarkdownDocument"),
      okLabel: translate("app.confirmDiscardUnsavedMarkdownDocumentAction")
    });
  }, [translate]);
  const markdownDocument = useMarkdownDocument({
    confirmDiscardUnsavedChanges,
    documentTabsEnabled: editorPreferences.preferences.showDocumentTabs,
    getCurrentMarkdown: editor.getCurrentMarkdown,
    isCurrentMarkdownEquivalent: editor.isCurrentMarkdownEquivalent,
    onMarkdownTreeChange: refreshMarkdownFileTree,
    onTreeRootFromFolderPath: openFolderPath,
    onTreeRootFromFilePath: setRootFromMarkdownFilePath,
    onWorkspaceSessionChange: setAiAgentSessionId,
    preferencesReady: !editorPreferences.loading,
    restoreWorkspaceOnStartup: editorPreferences.preferences.restoreWorkspaceOnStartup
  });
  const {
    clearOpenDocument,
    createBlankDocument,
    createWorkspaceSession,
    confirmCanDiscardCurrentDocument,
    detachDeletedDocumentFile,
    document,
    tabs: documentTabs,
    activeTabId,
    closeMarkdownTab,
    handleDroppedMarkdownPath,
    handleMarkdownChange,
    handleSaveClick,
    openMarkdownFile,
    openTreeMarkdownFile,
    outlineItems,
    replaceOpenDocumentFile,
    saveCurrentDocument,
    selectMarkdownTab,
    selectWorkspaceSession,
    workspaceSessionId,
    wordCount
  } = markdownDocument;
  const workspaceKey = document.path ?? fileTree.sourcePath ?? null;
  const hasOpenDocument = document.open;
  const activeAiAgentSessionId = workspaceSessionId ?? aiAgentSessionId;
  const aiResult = aiResults.at(-1) ?? null;
  const activeEditorContentWidth = editorContentWidth;
  const activeEditorContentWidthPx = editorContentWidthPx ?? editorPreferences.preferences.contentWidthPx ?? null;
  const resolveImageSrc = useMemo(() => createMarkdownImageSrcResolver(document.path), [document.path]);
  const resolveExportImageSrc = useMemo(
    () => createMarkdownImageSrcResolver(document.path, { convertFileSrc: localFileUrlFromPath }),
    [document.path]
  );
  const imagePreviewSrc = useMemo(() => {
    if (!activeImageFile) return "";

    return createMarkdownImageSrcResolver(activeImageFile.path)(activeImageFile.path);
  }, [activeImageFile]);
  const getAiDocumentContent = useCallback(
    () => (document.open ? editor.getCurrentMarkdown(document.content) : document.content),
    [document.content, document.open, editor]
  );
  const readAiWorkspaceFile = useCallback(async (path: string) => {
    const file = await readNativeMarkdownFile(path);

    return file.content;
  }, []);
  const readAiDocumentImage = useCallback(async (src: string) => {
    if (!document.path) return null;

    return readNativeMarkdownImageFile({
      documentPath: document.path,
      src
    });
  }, [document.path]);
  const getActiveAiSelection = useCallback(() => activeAiSelectionRef.current, []);
  const updateActiveAiSelection = useCallback((selection: AiSelectionContext | null) => {
    activeAiSelectionRef.current = selection;
    setActiveAiSelection(selection);
  }, []);
  const updateAiResults = useCallback((results: AiDiffResult[]) => {
    aiResultsRef.current = results;
    setAiResults(results);
  }, []);
  const getPendingAiResult = useCallback(() => aiResultsRef.current.at(-1) ?? null, []);
  const hasAiCommandContext = !sourceMode && Boolean(activeAiSelection?.text.trim());
  const selectedInlineAiModel =
    aiSettings.availableTextModels.find(
      (model) => model.providerId === aiSettings.inlineProvider?.id && model.id === aiSettings.inlineModelId
    ) ?? aiSettings.availableTextModels[0];
  const selectedAiAgentModel =
    aiSettings.availableTextModels.find(
      (model) => model.providerId === aiSettings.agentProvider?.id && model.id === aiSettings.agentModelId
    ) ?? aiSettings.availableTextModels[0];
  const aiAgentProviderName = selectedAiAgentModel?.providerName ?? aiSettings.agentProvider?.name ?? null;
  const aiAgentModelName = selectedAiAgentModel?.name ?? aiSettings.agentModelId ?? null;
  const webSearchAvailable = aiAgentWebSearchAvailable({
    model: selectedAiAgentModel,
    provider: aiSettings.agentProvider,
    settings: webSearchSettings.settings,
    settingsLoading: webSearchSettings.loading
  });
  const aiAgentInset = aiAgentOpen ? `${aiAgentPanelWidth}px` : "0px";
  const editorAgentLayoutClassName = `editor-agent-layout grid min-h-0 ${
    aiAgentPanelResizing
      ? "transition-none"
      : "transition-[grid-template-columns] duration-220 ease-out motion-reduce:transition-none"
  }`;
  const handleAiResult = useCallback(
    (result: AiDiffResult, previewId?: string) => {
      editor.clearAiSelection();
      appliedAiPreviewKeysRef.current.clear();
      editor.previewAiResult(result, {
        apply: translate("app.aiApply"),
        chars: translate("app.aiPreviewChars"),
        copied: translate("app.aiCopied"),
        copy: translate("app.aiCopy"),
        insertScope: translate("app.aiPreviewInsert"),
        reject: translate("app.aiReject"),
        replaceDocumentScope: translate("app.aiPreviewReplaceDocument"),
        replaceRegionScope: translate("app.aiPreviewReplaceRegion"),
        replaceSelectionScope: translate("app.aiPreviewReplaceSelection")
      }, {
        previewId
      });
      updateAiResults(editor.listAiPreviews());
    },
    [editor, translate, updateAiResults]
  );
  const handleAiPreviewReady = useCallback((result: AiDiffResult, previewId?: string) => {
    editor.scrollToAiPreview(result, { previewId });
  }, [editor]);
  const createAiAgentInitialSessionOptions = useCallback(() => ({
    agentModelId: aiSettings.agentModelId,
    agentProviderId: aiSettings.agentProviderId
  }), [aiSettings.agentModelId, aiSettings.agentProviderId]);
  const handleAiAgentSessionRestore = useCallback((session: { panelOpen: boolean; panelWidth: number | null }) => {
    setAiAgentOpen(session.panelOpen);
    setAiAgentPanelWidth(clampNumber(session.panelWidth, aiAgentPanelMinWidth, aiAgentPanelMaxWidth) ?? aiAgentPanelDefaultWidth);
  }, []);
  const handleAiAgentSessionModelRestore = useCallback((selection: { agentModelId: string | null; agentProviderId: string | null }) => {
    if (!selection.agentProviderId || !selection.agentModelId) return;
    if (selection.agentProviderId === aiSettings.agentProviderId && selection.agentModelId === aiSettings.agentModelId) return;

    aiSettings.selectAgentModel(selection.agentProviderId, selection.agentModelId).catch(() => {});
  }, [aiSettings.agentModelId, aiSettings.agentProviderId, aiSettings.selectAgentModel]);
  const aiCommand = useAiCommandUi({
    documentPath: document.path,
    getDocumentContent: getAiDocumentContent,
    getPendingResult: getPendingAiResult,
    getSelection: getActiveAiSelection,
    model: aiSettings.inlineModelId,
    onAiResult: handleAiResult,
    provider: aiSettings.inlineProvider,
    settingsLoading: aiSettings.loading,
    translate,
    translationTargetLanguage: aiTranslationLanguageName(appLanguage.ready ? appLanguage.language : "en"),
    workspaceFiles: fileTreeFiles
  });
  const aiAgent = useAiAgentSession({
    documentPath: document.path,
    getDocumentContent: getAiDocumentContent,
    getDocumentEndPosition: editor.getDocumentEndPosition,
    getHeadingAnchors: editor.getHeadingAnchors,
    getSectionAnchors: editor.getSectionAnchors,
    getSelection: getActiveAiSelection,
    getTableAnchors: editor.getTableAnchors,
    model: aiSettings.agentModelId,
    onAiPreviewReady: handleAiPreviewReady,
    onAiResult: handleAiResult,
    onSessionModelRestore: handleAiAgentSessionModelRestore,
    onSessionRestore: handleAiAgentSessionRestore,
    panelOpen: aiAgentOpen,
    panelWidth: aiAgentPanelWidth,
    provider: aiSettings.agentProvider,
    readDocumentImage: readAiDocumentImage,
    readWorkspaceFile: readAiWorkspaceFile,
    sessionId: activeAiAgentSessionId,
    settingsLoading: aiSettings.loading,
    translate,
    webSearchSettings: webSearchSettings.settings,
    workspaceKey,
    workspaceFiles: fileTreeFiles
  });
  const aiAgentSessionRefreshKey = [
    activeAiAgentSessionId ?? "none",
    workspaceKey ?? "none",
    aiAgent.messages.length,
    aiAgent.draft.trim().slice(0, 24),
    aiAgent.titleVersion
  ].join(":");
  const aiAgentSessions = useAiAgentSessionList(workspaceKey, aiAgentSessionRefreshKey);
  useEffect(() => {
    if (!workspaceKey || !activeAiAgentSessionId || !aiAgentSessions.ready) return;

    const activeSessions = aiAgentSessions.sessions.filter((session) => session.archivedAt === null);
    const activeSessionBelongsToWorkspace = activeSessions.some((session) => session.id === activeAiAgentSessionId);
    if (activeSessionBelongsToWorkspace) {
      reconciledAiWorkspaceKeyRef.current = workspaceKey;
      return;
    }

    const previousWorkspaceKey = reconciledAiWorkspaceKeyRef.current;
    if (previousWorkspaceKey === workspaceKey) return;

    reconciledAiWorkspaceKeyRef.current = workspaceKey;

    const newestSession = activeSessions[0];
    if (newestSession) {
      selectWorkspaceSession(newestSession.id);
      return;
    }

    if (previousWorkspaceKey === undefined) {
      initializeStoredAiAgentSession(activeAiAgentSessionId, workspaceKey, createAiAgentInitialSessionOptions()).then(() => {
        aiAgentSessions.refresh().catch(() => {});
      }).catch(() => {});
      return;
    }

    const nextSessionId = createWorkspaceSession();
    initializeStoredAiAgentSession(nextSessionId, workspaceKey, createAiAgentInitialSessionOptions()).then(() => {
      aiAgentSessions.refresh().catch(() => {});
    }).catch(() => {});
  }, [activeAiAgentSessionId, aiAgentSessions, createAiAgentInitialSessionOptions, createWorkspaceSession, selectWorkspaceSession, workspaceKey]);
  const closeAiCommand = aiCommand.closeAiCommand;
  const restoreAiCommand = aiCommand.restoreAiCommand;
  const handleAiCommandClose = useCallback(() => {
    aiContextMenuActionIdRef.current += 1;
    setAiContextMenuActionPending(false);
    closeAiCommand();
    editor.clearAiSelection();
  }, [closeAiCommand, editor]);
  const shouldCloseAiCommandForAiAgentOpen = useCallback(
    (nextOpen: boolean) => shouldCloseAiCommandOnAgentPanelOpen({
      closeAiCommandOnAgentPanelOpen: editorPreferences.preferences.closeAiCommandOnAgentPanelOpen,
      currentOpen: aiAgentOpen,
      nextOpen
    }),
    [aiAgentOpen, editorPreferences.preferences.closeAiCommandOnAgentPanelOpen]
  );
  const setAiAgentPanelOpen = useCallback((nextOpen: boolean) => {
    if (shouldCloseAiCommandForAiAgentOpen(nextOpen)) handleAiCommandClose();
    setAiAgentOpen(nextOpen);
  }, [handleAiCommandClose, shouldCloseAiCommandForAiAgentOpen]);
  const openAiAgentPanel = useCallback(() => {
    setAiAgentPanelOpen(true);
  }, [setAiAgentPanelOpen]);
  const closeAiAgentPanel = useCallback(() => {
    setAiAgentPanelOpen(false);
  }, [setAiAgentPanelOpen]);
  const toggleAiAgentPanel = useCallback(() => {
    setAiAgentPanelOpen(!aiAgentOpen);
  }, [aiAgentOpen, setAiAgentPanelOpen]);
  useEffect(() => {
    if (!shouldHideAiCommandForAiAgentPanel({
      aiAgentOpen,
      closeAiCommandOnAgentPanelOpen: editorPreferences.preferences.closeAiCommandOnAgentPanelOpen
    })) {
      return;
    }

    aiCommand.closeAiCommand();
  }, [aiAgentOpen, aiCommand.closeAiCommand, editorPreferences.preferences.closeAiCommandOnAgentPanelOpen]);
  const handleCreateAiAgentSession = useCallback(() => {
    const sessionId = createWorkspaceSession();

    openAiAgentPanel();
    initializeStoredAiAgentSession(sessionId, workspaceKey, createAiAgentInitialSessionOptions()).then(() => {
      aiAgentSessions.refresh().catch(() => {});
    }).catch(() => {});
  }, [aiAgentSessions, createAiAgentInitialSessionOptions, createWorkspaceSession, openAiAgentPanel, workspaceKey]);
  const handleSelectAiAgentSession = useCallback((sessionId: string) => {
    selectWorkspaceSession(sessionId);
    openAiAgentPanel();
  }, [openAiAgentPanel, selectWorkspaceSession]);
  const handleRenameAiAgentSession = useCallback(async (sessionId: string, title: string) => {
    await saveStoredAiAgentSessionTitle(sessionId, title, {
      source: "manual",
      workspaceKey
    });
    await aiAgentSessions.refresh();
  }, [aiAgentSessions, workspaceKey]);
  const handleDeleteAiAgentSession = useCallback(async (sessionId: string) => {
    const remainingSessions = aiAgentSessions.sessions.filter(
      (session) => session.id !== sessionId && session.archivedAt === null
    );

    await deleteStoredAiAgentSession(sessionId);

    if (sessionId === activeAiAgentSessionId) {
      if (remainingSessions[0]) {
        selectWorkspaceSession(remainingSessions[0].id);
      } else {
        const nextSessionId = createWorkspaceSession();
        await initializeStoredAiAgentSession(nextSessionId, workspaceKey, createAiAgentInitialSessionOptions());
      }
    }

    await aiAgentSessions.refresh();
    openAiAgentPanel();
  }, [activeAiAgentSessionId, aiAgentSessions, createAiAgentInitialSessionOptions, createWorkspaceSession, openAiAgentPanel, selectWorkspaceSession, workspaceKey]);
  const handleArchiveAiAgentSession = useCallback(async (sessionId: string, archived: boolean) => {
    const remainingSessions = aiAgentSessions.sessions.filter(
      (session) => session.id !== sessionId && session.archivedAt === null
    );

    await setStoredAiAgentSessionArchived(sessionId, archived);

    if (archived && sessionId === activeAiAgentSessionId) {
      if (remainingSessions[0]) {
        selectWorkspaceSession(remainingSessions[0].id);
      } else {
        const nextSessionId = createWorkspaceSession();
        await initializeStoredAiAgentSession(nextSessionId, workspaceKey, createAiAgentInitialSessionOptions());
      }
    }

    await aiAgentSessions.refresh();
    openAiAgentPanel();
  }, [activeAiAgentSessionId, aiAgentSessions, createAiAgentInitialSessionOptions, createWorkspaceSession, openAiAgentPanel, selectWorkspaceSession, workspaceKey]);
  const handleTextSelectionChange = useCallback((selection: AiSelectionContext | null) => {
    updateActiveAiSelection(selection);

    if (!selection?.text.trim()) {
      editor.clearAiSelection();
      if (aiResultsRef.current.length === 0) aiCommand.closeAiCommand();
      return;
    }

    if (selection.source !== "selection") {
      editor.clearAiSelection();
      if (aiResultsRef.current.length === 0) aiCommand.closeAiCommand();
      return;
    }

    editor.holdAiSelection(selection);

    if (shouldHideAiCommandForAiAgentPanel({
      aiAgentOpen,
      closeAiCommandOnAgentPanelOpen: editorPreferences.preferences.closeAiCommandOnAgentPanelOpen
    })) {
      aiCommand.closeAiCommand();
      return;
    }

    if (!editorPreferences.preferences.autoOpenAiOnSelection || aiCommand.open || aiCommand.submitting) return;

    aiCommand.openAiCommand(selection);
  }, [
    aiAgentOpen,
    aiCommand,
    editor,
    editorPreferences.preferences.autoOpenAiOnSelection,
    editorPreferences.preferences.closeAiCommandOnAgentPanelOpen,
    updateActiveAiSelection
  ]);
  const getEditorSelection = editor.getSelection;
  const holdAiSelection = editor.holdAiSelection;
  const interruptAiCommandPrompt = aiCommand.interruptPrompt;
  const openAiCommand = aiCommand.openAiCommand;
  const submitAiCommandPrompt = aiCommand.submitPrompt;
  const updateAiCommandPrompt = aiCommand.updatePrompt;
  const aiContextMenuActionRef = useRef<((intent: AiQuickActionIntent, prompt: string) => unknown) | null>(null);
  useEffect(() => {
    aiContextMenuActionRef.current = (intent: AiQuickActionIntent, prompt: string) => {
      const selection = explicitAiTextSelection(getActiveAiSelection()) ?? explicitAiTextSelection(getEditorSelection());
      if (!selection) return;

      holdAiSelection(selection);
      const actionId = aiContextMenuActionIdRef.current + 1;
      let opened = false;
      aiContextMenuActionIdRef.current = actionId;

      flushSync(() => {
        updateActiveAiSelection(selection);
        setAiContextMenuActionPending(true);
        opened = openAiCommand(selection);
        updateAiCommandPrompt(prompt);
      });

      if (!opened) {
        setAiContextMenuActionPending(false);
        return;
      }

      window.setTimeout(() => {
        if (aiContextMenuActionIdRef.current !== actionId) return;

        Promise.resolve(submitAiCommandPrompt(prompt, intent)).finally(() => {
          if (aiContextMenuActionIdRef.current !== actionId) return;

          setAiContextMenuActionPending(false);
        });
      }, 0);
    };
  }, [
    getEditorSelection,
    getActiveAiSelection,
    holdAiSelection,
    openAiCommand,
    submitAiCommandPrompt,
    updateActiveAiSelection,
    updateAiCommandPrompt
  ]);
  const handleAiContextMenuAction = useCallback((intent: AiQuickActionIntent, prompt: string) => {
    return aiContextMenuActionRef.current?.(intent, prompt);
  }, []);
  const getAiContextMenuAvailable = useCallback(() => {
    const selection = explicitAiTextSelection(getActiveAiSelection()) ?? explicitAiTextSelection(getEditorSelection());

    return Boolean(selection);
  }, [getActiveAiSelection, getEditorSelection]);
  const handleAiCommandToggle = useCallback(() => {
    if (aiCommand.open) {
      handleAiCommandClose();
      return;
    }

    const selection = aiCommandTextSelection(getActiveAiSelection()) ?? aiCommandTextSelection(getEditorSelection());
    if (!selection) return;

    holdAiSelection(selection);
    updateActiveAiSelection(selection);
    openAiCommand(selection);
  }, [
    aiCommand.open,
    getActiveAiSelection,
    getEditorSelection,
    handleAiCommandClose,
    holdAiSelection,
    openAiCommand,
    updateActiveAiSelection
  ]);
  const handleAiCommandInterrupt = useCallback(() => {
    aiContextMenuActionIdRef.current += 1;
    setAiContextMenuActionPending(false);
    interruptAiCommandPrompt();
  }, [interruptAiCommandPrompt]);
  const saveDocumentAs = useCallback(() => saveCurrentDocument(true), [saveCurrentDocument]);
  const handleApplyAiResult = useCallback((restoredResult?: AiDiffResult | null, previewId?: string) => {
    const result = restoredResult ?? aiResults.at(-1) ?? null;
    if (!result) {
      console.warn("[markra-ai-preview] apply ignored: no pending result", {
        aiResults,
        previewId,
        restoredResult
      });
      return;
    }

    debug(() => ["[markra-ai-preview] app handle apply", {
      from: result.type === "error" ? null : result.from,
      replacementLength: result.type === "error" ? null : result.replacement.length,
      to: result.type === "error" ? null : result.to,
      type: result.type
    }]);

    const actionKey = aiPreviewActionKey(result, previewId);
    if (appliedAiPreviewKeysRef.current.has(actionKey)) {
      debug(() => ["[markra-ai-preview] apply ignored: duplicate result", {
        previewId,
        type: result.type
      }]);
      editor.confirmAiResultApplied(result, { previewId });
      return;
    }

    appliedAiPreviewKeysRef.current.add(actionKey);
    const applied = editor.applyAiResult(result, { previewId });
    debug(() => ["[markra-ai-preview] app apply result", { applied }]);

    if (!applied) {
      appliedAiPreviewKeysRef.current.delete(actionKey);
      return;
    }

    const remainingPreviews = editor.listAiPreviews();
    updateAiResults(remainingPreviews);
    if (remainingPreviews.length === 0) {
      editor.clearAiSelection();
      handleAiCommandClose();
    }
  }, [aiResults, editor, handleAiCommandClose, updateAiResults]);
  const handleRejectAiResult = useCallback((result?: AiDiffResult | null, previewId?: string) => {
    editor.clearAiSelection();
    editor.clearAiPreview(result ?? undefined, { previewId });
    const remainingPreviews = editor.listAiPreviews();
    updateAiResults(remainingPreviews);
    if (remainingPreviews.length === 0) handleAiCommandClose();
  }, [editor, handleAiCommandClose, updateAiResults]);
  const handleCopyAiResult = useCallback((restoredResult?: AiDiffResult | null) => {
    const result = restoredResult ?? aiResults.at(-1) ?? null;
    if (!result || result.type === "error") return;
    navigator.clipboard?.writeText(result.replacement);
  }, [aiResults]);
  const handleSaveClipboardImage = useCallback(async (image: File) => {
    if (!document.path) {
      showAppToast({
        message: translate("app.clipboardImageRequiresSavedDocument"),
        status: "error"
      });
      return null;
    }

    try {
      const savedImage = await saveNativeClipboardImage({
        documentPath: document.path,
        folder: editorPreferences.preferences.clipboardImageFolder,
        image
      });
      await refreshMarkdownFileTree(document.path);
      return savedImage;
    } catch {
      showAppToast({
        message: translate("app.clipboardImageSaveFailed"),
        status: "error"
      });
      return null;
    }
  }, [document.path, editorPreferences.preferences.clipboardImageFolder, refreshMarkdownFileTree, translate]);

  useEffect(() => {
    const storedWidth = editorPreferences.preferences.contentWidthPx ?? null;
    setEditorContentWidth(editorPreferences.preferences.contentWidth);
    setEditorContentWidthPx(storedWidth);
    pendingEditorContentWidthPxRef.current = storedWidth;
  }, [editorPreferences.preferences.contentWidth, editorPreferences.preferences.contentWidthPx]);

  const handleEditorContentWidthChange = useCallback((width: number) => {
    pendingEditorContentWidthPxRef.current = width;
    setEditorContentWidthPx(width);
  }, []);

  const handleEditorContentWidthResizeEnd = useCallback(() => {
    const nextWidth = pendingEditorContentWidthPxRef.current;
    if (nextWidth === null) return;

    const nextPreferences = {
      ...editorPreferences.preferences,
      contentWidth: activeEditorContentWidth,
      contentWidthPx: nextWidth
    };

    saveStoredEditorPreferences(nextPreferences)
      .then(() => notifyAppEditorPreferencesChanged(nextPreferences))
      .catch(() => {});
  }, [activeEditorContentWidth, editorPreferences.preferences]);
  const handleTitlebarActionsChange = useCallback((titlebarActions: TitlebarActionPreference[]) => {
    const nextPreferences = {
      ...editorPreferences.preferences,
      titlebarActions
    };

    saveStoredEditorPreferences(nextPreferences)
      .then(() => notifyAppEditorPreferencesChanged(nextPreferences))
      .catch(() => {});
  }, [editorPreferences.preferences]);
  const handleCreateMarkdownTreeFile = useCallback(async (fileName: string) => {
    try {
      const file = await createMarkdownTreeFile(fileName);
      if (file) {
        setActiveImageFile(null);
        await openTreeMarkdownFile(file);
      }
    } catch {
      // Native file errors are surfaced by the platform operation when possible.
    }
  }, [createMarkdownTreeFile, openTreeMarkdownFile]);
  const handleQuickCreateMarkdownTreeFile = useCallback(() => {
    setActiveImageFile(null);
    createBlankDocument().catch(() => {});
  }, [createBlankDocument]);
  const openImageTab = useCallback((file: NativeMarkdownFolderFile) => {
    const tab = createImageDocumentTab(file);
    setImageTabs((currentTabs) =>
      currentTabs.some((currentTab) => currentTab.id === tab.id)
        ? currentTabs.map((currentTab) => currentTab.id === tab.id ? tab : currentTab)
        : [...currentTabs, tab]
    );
    setActiveImageFile(file);
  }, []);
  const applyRenamedTreeFile = useCallback((previousPath: string, renamedFile: NativeMarkdownFolderFile) => {
    replaceOpenDocumentFile(previousPath, renamedFile);
    setImageTabs((currentTabs) => currentTabs.map((tab) =>
      tab.path === previousPath ? createImageDocumentTab(renamedFile) : tab
    ));
    setActiveImageFile((currentFile) => currentFile?.path === previousPath ? renamedFile : currentFile);
  }, [replaceOpenDocumentFile]);
  const handleCreateMarkdownTreeFolder = useCallback(async (folderName: string) => {
    try {
      await createMarkdownTreeFolder(folderName);
    } catch {
      // Native folder errors are surfaced by the platform operation when possible.
    }
  }, [createMarkdownTreeFolder]);
  const handleRenameMarkdownTreeFile = useCallback(async (file: NativeMarkdownFolderFile, fileName: string) => {
    try {
      const renamedFile = await renameMarkdownTreeFile(file, fileName);
      if (renamedFile) applyRenamedTreeFile(file.path, renamedFile);
    } catch {
      // Keep the existing tree state if the native rename fails.
    }
  }, [applyRenamedTreeFile, renameMarkdownTreeFile]);
  const handleDeleteMarkdownTreeFile = useCallback(async (file: NativeMarkdownFolderFile) => {
    const confirmed = await confirmNativeMarkdownFileDelete(file.name, {
      cancelLabel: translate("app.cancelDeleteMarkdownFile"),
      message: translate("app.confirmDeleteMarkdownFile"),
      okLabel: translate("app.confirmDeleteMarkdownFileAction")
    });
    if (!confirmed) return;

    try {
      const deleted = await deleteMarkdownTreeFile(file);
      if (deleted) detachDeletedDocumentFile(file.path);
    } catch {
      // Leave the file visible when native deletion fails.
    }
  }, [deleteMarkdownTreeFile, detachDeletedDocumentFile, translate]);
  const handleOpenTreeFile = useCallback(async (file: NativeMarkdownFolderFile) => {
    if (file.kind === "asset") {
      openImageTab(file);
      return;
    }

    setActiveImageFile(null);
    await openTreeMarkdownFile(file);
  }, [openImageTab, openTreeMarkdownFile]);
  const handleOpenMarkdownFile = useCallback(async () => {
    setActiveImageFile(null);
    await openMarkdownFile({
      pickerTitle: translate("app.openMarkdownOrFolder")
    });
  }, [openMarkdownFile, translate]);
  const handleCloseCurrentFile = useCallback(async () => {
    if (activeImageFile) {
      const closingTabId = imageDocumentTabId(activeImageFile.path);
      setImageTabs((currentTabs) => currentTabs.filter((tab) => tab.id !== closingTabId));
      setActiveImageFile(null);
      return;
    }

    if (activeTabId) {
      const closed = await closeMarkdownTab(activeTabId);
      if (!closed) return;

      updateActiveAiSelection(null);
      handleAiCommandClose();
      return;
    }

    const canDiscard = await confirmCanDiscardCurrentDocument();
    if (!canDiscard) return;

    updateActiveAiSelection(null);
    handleAiCommandClose();
    clearOpenDocument();
  }, [
    activeImageFile,
    activeTabId,
    clearOpenDocument,
    closeMarkdownTab,
    confirmCanDiscardCurrentDocument,
    handleAiCommandClose,
    updateActiveAiSelection
  ]);
  const handleFileTreeToggle = useCallback(() => toggleFileTree(document.path), [document.path, toggleFileTree]);
  const handleAiAgentToggle = useCallback(() => {
    toggleAiAgentPanel();
  }, [toggleAiAgentPanel]);
  const handleOpenSettings = useCallback(() => {
    openSettingsWindow().catch(() => {});
  }, []);
  const rawFileTreeRootName = rootNameForDocument(document.path);
  const fileTreeRootName =
    rawFileTreeRootName === "No folder"
      ? translate("app.noFolder")
      : rawFileTreeRootName === "Files"
        ? translate("app.files")
        : rawFileTreeRootName;
  const titlebarTabs = useMemo<MarkdownTabsBarItem[]>(() => [
    ...documentTabs,
    ...imageTabs.map((tab) => ({
      dirty: false,
      displayKind: "image" as const,
      id: tab.id,
      name: tab.name,
      path: tab.path
    }))
  ], [documentTabs, imageTabs]);
  const activeTitlebarTabId = activeImageFile ? imageDocumentTabId(activeImageFile.path) : activeTabId;
  const documentTabsVisible =
    editorPreferences.preferences.showDocumentTabs &&
    (hasOpenDocument || Boolean(activeImageFile)) &&
    titlebarTabs.some((tab) => titlebarTabs.length > 1 || tab.path !== null || tab.dirty);
  const titleDocumentName = activeImageFile ? activeImageFile.name : hasOpenDocument ? document.name : fileTreeRootName;
  const titleDocumentKind = activeImageFile ? "image" : hasOpenDocument ? "file" : "folder";
  const sourceModeAvailable = hasOpenDocument && !activeImageFile;
  const supportsAiThinking = selectedInlineAiModel?.capabilities.includes("reasoning") ?? false;
  useEffect(() => {
    exportContextRef.current = {
      activeImageFile: Boolean(activeImageFile),
      content: document.content,
      hasOpenDocument,
      name: document.name || "Untitled.md"
    };
  }, [activeImageFile, document.content, document.name, hasOpenDocument]);
  const handleEditorModeToggle = useCallback(() => {
    if (!sourceModeAvailable) return;

    if (sourceMode) {
      setEditorMode("visual");
      return;
    }

    updateActiveAiSelection(null);
    handleAiCommandClose();
    setEditorMode("source");
  }, [
    handleAiCommandClose,
    sourceMode,
    sourceModeAvailable,
    updateActiveAiSelection
  ]);
  const handleOpenMarkdownFolder = useCallback(async () => {
    const canDiscard = await confirmCanDiscardCurrentDocument();
    if (!canDiscard) return;

    const folder = await openMarkdownFolder({
      pickerTitle: translate("app.openFolder")
    });
    if (folder) {
      setActiveImageFile(null);
      clearOpenDocument();
    }
  }, [clearOpenDocument, confirmCanDiscardCurrentDocument, openMarkdownFolder, translate]);
  const clearExportSnapshot = useCallback((id: number) => {
    setExportSnapshot((current) => current?.id === id ? null : current);
  }, []);
  const getCurrentMarkdown = editor.getCurrentMarkdown;
  const beginDocumentExport = useCallback((kind: MarkdownExportSnapshot["kind"]) => {
    const context = exportContextRef.current;
    if (!context.hasOpenDocument || context.activeImageFile) return;

    exportRequestIdRef.current += 1;
    setExportSnapshot({
      id: exportRequestIdRef.current,
      kind,
      markdown: getCurrentMarkdown(context.content),
      title: context.name
    });
  }, [getCurrentMarkdown]);
  const handleRenderedExport = useCallback((exported: RenderedMarkdownExport) => {
    if (exportSnapshot?.id !== exported.id) return;

    const pdfSettings = exported.kind === "pdf" ? exportSettings.settings : null;
    const contents = buildMarkdownHtmlDocument({
      bodyHtml: exported.bodyHtml,
      language: appLanguage.language,
      pdfAuthor: pdfSettings?.pdfAuthor,
      pdfFooter: pdfSettings?.pdfFooter,
      pdfHeader: pdfSettings?.pdfHeader,
      pdfHeightMm: pdfSettings?.pdfHeightMm,
      pdfMarginMm: pdfSettings?.pdfMarginMm,
      pdfPageBreakOnH1: pdfSettings?.pdfPageBreakOnH1,
      pdfWidthMm: pdfSettings?.pdfWidthMm,
      title: exported.title
    });
    const suggestedName = exportDocumentFileName(exported.title, exported.kind);

    if (exported.kind === "html") {
      saveNativeHtmlFile({
        contents,
        suggestedName
      }).catch(() => {}).finally(() => {
        clearExportSnapshot(exported.id);
      });
      return;
    }

    saveNativePdfFile({
      contents,
      suggestedName
    }).catch(() => {}).finally(() => {
      clearExportSnapshot(exported.id);
    });
  }, [appLanguage.language, clearExportSnapshot, exportSettings.settings, exportSnapshot?.id]);
  const exportHtmlDocument = useCallback(() => beginDocumentExport("html"), [beginDocumentExport]);
  const exportPdfDocument = useCallback(() => beginDocumentExport("pdf"), [beginDocumentExport]);
  useEffect(() => {
    if (sourceModeAvailable) return;

    setEditorMode("visual");
  }, [sourceModeAvailable]);
  const aiAgentContext = useMemo(() => ({
    documentName: titleDocumentName,
    headingCount: outlineItems.length,
    messageCount: aiAgent.messages.length,
    sectionCount: outlineItems.length,
    selectionChars: activeAiSelection?.text.trim().length ?? 0,
    sessionId: activeAiAgentSessionId,
    tableCount: editor.getTableAnchors().length
  }), [
    activeAiAgentSessionId,
    activeAiSelection,
    aiAgent.messages.length,
    document.content,
    titleDocumentName,
    document.revision,
    editor,
    outlineItems.length
  ]);
  const appUpdater = useAutoUpdater(appLanguage.language, appLanguage.ready, {
    confirmRestart: confirmCanDiscardCurrentDocument
  });
  const nativeMenuHandlers = useNativeMenuHandlers({
    checkForUpdates: appUpdater.checkForUpdates,
    closeDocument: handleCloseCurrentFile,
    exportHtml: exportHtmlDocument,
    exportPdf: exportPdfDocument,
    insertMarkdownSnippet: editor.insertMarkdownSnippet,
    insertMarkdownTable: editor.insertMarkdownTable,
    language: appLanguage.language,
    markdownShortcuts: editorPreferences.preferences.markdownShortcuts,
    openDocument: handleOpenMarkdownFile,
    openFolder: handleOpenMarkdownFolder,
    runAiQuickAction: handleAiContextMenuAction,
    runEditorShortcut: editor.runEditorShortcut,
    saveDocument: handleSaveClick,
    saveDocumentAs,
    toggleAiAgent: handleAiAgentToggle,
    toggleAiCommand: handleAiCommandToggle,
    toggleMarkdownFiles: handleFileTreeToggle,
    toggleSourceMode: handleEditorModeToggle
  });

  useNativeMarkdownDrop(handleDroppedMarkdownPath);
  useNativeMenus(nativeMenuHandlers, appLanguage.ready ? appLanguage.language : null, {
    getAiCommandsAvailable: getAiContextMenuAvailable,
    markdownShortcuts: editorPreferences.preferences.markdownShortcuts
  });
  useApplicationShortcuts({
    closeDocument: handleCloseCurrentFile,
    exportHtml: exportHtmlDocument,
    exportPdf: exportPdfDocument,
    markdownShortcuts: editorPreferences.preferences.markdownShortcuts,
    openDocument: handleOpenMarkdownFile,
    openFolder: handleOpenMarkdownFolder,
    saveDocument: handleSaveClick,
    saveDocumentAs,
    toggleAiAgent: handleAiAgentToggle,
    toggleAiCommand: handleAiCommandToggle,
    toggleMarkdownFiles: handleFileTreeToggle,
    toggleSourceMode: handleEditorModeToggle
  });

  useEffect(() => {
    const handlePreviewAction = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AiEditorPreviewActionDetail>>).detail;
      const action = detail?.action;
      debug(() => ["[markra-ai-preview] app received action event", detail]);

      if (action === "apply") {
        handleApplyAiResult(detail.result, detail.previewId);
        return;
      }

      if (action === "copy") {
        handleCopyAiResult(detail.result);
        return;
      }

      if (action === "reject") {
        handleRejectAiResult(detail.result, detail.previewId);
      }
    };

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, handlePreviewAction);
    return () => {
      window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, handlePreviewAction);
    };
  }, [handleApplyAiResult, handleCopyAiResult, handleRejectAiResult]);

  useEffect(() => {
    const handlePreviewApplied = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AiEditorPreviewAppliedDetail>>).detail;
      const result = detail?.result;
      if (!result || (result.type !== "insert" && result.type !== "replace")) return;

      const actionKey = aiPreviewActionKey(result, detail?.previewId);
      if (!appliedAiPreviewKeysRef.current.has(actionKey)) return;

      debug(() => ["[markra-ai-preview] app observed preview applied", {
        actionKey,
        pendingPreviewCount: detail?.previews?.length ?? 0,
        previewId: detail?.previewId,
        resultSignature: aiResultSignature(result)
      }]);
      editor.confirmAiResultApplied(result, { previewId: detail?.previewId });
      const remainingPreviews = editor.listAiPreviews();
      updateAiResults(remainingPreviews);
      if (remainingPreviews.length === 0) {
        editor.clearAiSelection();
        handleAiCommandClose();
      }
    };

    window.addEventListener(AI_EDITOR_PREVIEW_APPLIED_EVENT, handlePreviewApplied);
    return () => {
      window.removeEventListener(AI_EDITOR_PREVIEW_APPLIED_EVENT, handlePreviewApplied);
    };
  }, [editor, handleAiCommandClose, updateAiResults]);

  useEffect(() => {
    const handlePreviewRestore = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AiEditorPreviewRestoreDetail>>).detail;
      const result = detail?.result;
      if (!result || (result.type !== "insert" && result.type !== "replace")) return;

      debug(() => ["[markra-ai-preview] app observed preview restore", {
        pendingPreviewCount: detail?.previews?.length ?? 0,
        previewId: detail?.previewId,
        resultSignature: aiResultSignature(result)
      }]);
      appliedAiPreviewKeysRef.current.delete(aiPreviewActionKey(result, detail?.previewId));
      updateAiResults(editor.listAiPreviews());
      restoreAiCommand({ reopen: false });
    };

    window.addEventListener(AI_EDITOR_PREVIEW_RESTORE_EVENT, handlePreviewRestore);
    return () => {
      window.removeEventListener(AI_EDITOR_PREVIEW_RESTORE_EVENT, handlePreviewRestore);
    };
  }, [editor, restoreAiCommand, updateAiResults]);

  const handleCloseTitlebarTab = useCallback((tabId: string) => {
    const imageTab = imageTabs.find((tab) => tab.id === tabId);
    if (imageTab) {
      const closingActiveImage = activeImageFile ? imageDocumentTabId(activeImageFile.path) === tabId : false;
      setImageTabs((currentTabs) => currentTabs.filter((tab) => tab.id !== tabId));
      if (closingActiveImage) setActiveImageFile(null);
      updateActiveAiSelection(null);
      handleAiCommandClose();
      return;
    }

    closeMarkdownTab(tabId).then((closed) => {
      if (!closed) return;

      updateActiveAiSelection(null);
      handleAiCommandClose();
    }).catch(() => {});
  }, [
    activeImageFile,
    closeMarkdownTab,
    handleAiCommandClose,
    imageTabs,
    updateActiveAiSelection
  ]);

  const handleSelectTitlebarTab = useCallback((tabId: string) => {
    const imageTab = imageTabs.find((tab) => tab.id === tabId);
    if (imageTab) {
      setActiveImageFile(imageTab);
      updateActiveAiSelection(null);
      handleAiCommandClose();
      return;
    }

    setActiveImageFile(null);
    updateActiveAiSelection(null);
    handleAiCommandClose();
    selectMarkdownTab(tabId);
  }, [
    handleAiCommandClose,
    imageTabs,
    selectMarkdownTab,
    updateActiveAiSelection
  ]);
  const handleRenameTitlebarTab = useCallback(async (tab: MarkdownTabsBarItem, fileName: string) => {
    const file = documentTabAsFolderFile(tab);
    if (!file) return;

    try {
      const renamedFile = await renameMarkdownTreeFile(file, fileName);
      if (renamedFile) applyRenamedTreeFile(file.path, renamedFile);
    } catch {
      // Keep the existing tab state if the native rename fails.
    }
  }, [applyRenamedTreeFile, renameMarkdownTreeFile]);

  const titlebarDocumentTabs = documentTabsVisible ? (
    <MarkdownTabsBar
      activeTabId={activeTitlebarTabId}
      language={appLanguage.language}
      placement="titlebar"
      tabs={titlebarTabs}
      onCloseTab={handleCloseTitlebarTab}
      onNewTab={() => {
        setActiveImageFile(null);
        createBlankDocument().catch(() => {});
      }}
      onRenameTab={handleRenameTitlebarTab}
      onSelectTab={handleSelectTitlebarTab}
    />
  ) : null;

  return (
    <>
      <AppToaster language={appLanguage.language} />
      <main className="app-shell group/app relative grid h-full w-full grid-rows-[minmax(0,1fr)] overflow-hidden overscroll-none bg-(--bg-primary) text-(--text-primary)">
        <NativeTitleBar
          aiAgentOpen={aiAgentOpen}
          aiAgentResizing={aiAgentPanelResizing}
          aiAgentWidth={aiAgentPanelWidth}
          dirty={!activeImageFile && hasOpenDocument && document.dirty}
          documentKind={titleDocumentKind}
          documentName={titleDocumentName}
          language={appLanguage.language}
          markdownFilesOpen={fileTreeOpen}
          markdownFilesResizing={fileTreeResizing}
          markdownFilesWidth={fileTreeWidth}
          quickCreateMarkdownFileVisible={!fileTreeOpen}
          saveDisabled={!hasOpenDocument || Boolean(activeImageFile)}
          sourceMode={sourceMode}
          sourceModeDisabled={!sourceModeAvailable}
          theme={appTheme.resolvedTheme}
          titlebarActions={editorPreferences.preferences.titlebarActions}
          titleContent={titlebarDocumentTabs}
          onCreateMarkdownFile={handleQuickCreateMarkdownTreeFile}
          onOpenMarkdown={handleOpenMarkdownFile}
          onOpenMarkdownFolder={handleOpenMarkdownFolder}
          onSaveMarkdown={handleSaveClick}
          onTitlebarActionsChange={handleTitlebarActionsChange}
          onToggleAiAgent={handleAiAgentToggle}
          onToggleMarkdownFiles={handleFileTreeToggle}
          onToggleSourceMode={handleEditorModeToggle}
          onToggleTheme={appTheme.toggleTheme}
        />

        <span className="screen-reader-title sr-only">{titleDocumentName}</span>

        <div className={workspaceLayoutClassName} style={workspaceLayoutStyle}>
          <div className="markdown-file-tree-slot min-h-0 overflow-hidden">
            <MarkdownFileTreeDrawer
              currentPath={activeImageFile?.path ?? (hasOpenDocument ? document.path : null)}
              files={fileTreeFiles}
              language={appLanguage.language}
              maxWidth={fileTreeMaxWidth}
              minWidth={fileTreeMinWidth}
              open={fileTreeOpen}
              outlineItems={outlineItems}
              rootName={fileTreeRootName}
              width={fileTreeWidth}
              onCreateFile={handleCreateMarkdownTreeFile}
              onCreateFolder={handleCreateMarkdownTreeFolder}
              onDeleteFile={handleDeleteMarkdownTreeFile}
              onOpenFile={handleOpenTreeFile}
              onOpenSettings={handleOpenSettings}
              onRenameFile={handleRenameMarkdownTreeFile}
              onResize={resizeFileTree}
              onResizeEnd={endFileTreeResize}
              onResizeStart={startFileTreeResize}
              onSelectOutlineItem={editor.selectOutlineItem}
              onToggleMarkdownFiles={handleFileTreeToggle}
            />
          </div>

          <div
            className={editorAgentLayoutClassName}
            style={{ gridTemplateColumns: `minmax(0,1fr) ${aiAgentInset}` }}
          >
            <div className="editor-content-slot relative h-full min-h-0 overflow-hidden">
              {activeImageFile ? (
                <ImagePreview
                  alt={activeImageFile.name}
                  language={appLanguage.language}
                  src={imagePreviewSrc}
                />
              ) : hasOpenDocument ? (
                <>
                  {sourceMode ? (
                    <MarkdownSourceEditor
                      autoFocus
                      bodyFontSize={editorPreferences.preferences.bodyFontSize}
                      content={document.content}
                      contentWidth={activeEditorContentWidth}
                      contentWidthPx={activeEditorContentWidthPx}
                      language={appLanguage.language}
                      lineHeight={editorPreferences.preferences.lineHeight}
                      onChange={handleMarkdownChange}
                      onContentWidthChange={handleEditorContentWidthChange}
                      onContentWidthResizeEnd={handleEditorContentWidthResizeEnd}
                      topInset="titlebar"
                    />
                  ) : (
                    <MarkdownPaper
                      autoFocus={shouldFocusEditorOnReady(document.content)}
                      bodyFontSize={editorPreferences.preferences.bodyFontSize}
                      contentWidth={activeEditorContentWidth}
                      contentWidthPx={activeEditorContentWidthPx}
                      initialContent={document.content}
                      language={appLanguage.language}
                      lineHeight={editorPreferences.preferences.lineHeight}
                      markdownShortcuts={editorPreferences.preferences.markdownShortcuts}
                      onEditorReady={editor.handleEditorReady}
                      onMarkdownChange={handleMarkdownChange}
                      onContentWidthChange={handleEditorContentWidthChange}
                      onContentWidthResizeEnd={handleEditorContentWidthResizeEnd}
                      onSaveClipboardImage={handleSaveClipboardImage}
                      openExternalUrl={openNativeExternalUrl}
                      onTextSelectionChange={handleTextSelectionChange}
                      resolveImageSrc={resolveImageSrc}
                      revision={document.revision}
                      topInset="titlebar"
                    />
                  )}
                  <QuietStatus
                    dirty={document.dirty}
                    language={appLanguage.language}
                    showWordCount={editorPreferences.preferences.showWordCount}
                    wordCount={wordCount}
                  />
                </>
              ) : null}
            </div>
            <div className="ai-agent-panel-slot relative z-20 min-h-0 overflow-hidden">
              <AiAgentPanel
                activeSessionId={activeAiAgentSessionId}
                availableModels={aiSettings.availableTextModels}
                context={aiAgentContext}
                documentAvailable={hasOpenDocument && !activeImageFile}
                draft={aiAgent.draft}
                language={appLanguage.language}
                messages={aiAgent.messages}
                modelName={aiAgentModelName}
                open={aiAgentOpen}
                providerName={aiAgentProviderName}
                sessions={aiAgentSessions.sessions}
                selectedModelId={aiSettings.agentModelId}
                selectedProviderId={aiSettings.agentProviderId}
                status={aiAgent.status}
                thinkingEnabled={aiAgent.thinkingEnabled}
                webSearchAvailable={webSearchAvailable}
                webSearchEnabled={aiAgent.webSearchEnabled}
                maxWidth={aiAgentPanelMaxWidth}
                minWidth={aiAgentPanelMinWidth}
                width={aiAgentPanelWidth}
                onArchiveSession={(sessionId, archived) => {
                  handleArchiveAiAgentSession(sessionId, archived).catch(() => {});
                }}
                onClose={closeAiAgentPanel}
                onCreateSession={handleCreateAiAgentSession}
                onDeleteSession={(sessionId) => {
                  handleDeleteAiAgentSession(sessionId).catch(() => {});
                }}
                onDisableThinking={() => aiAgent.setSessionThinkingEnabled(false)}
                onDraftChange={aiAgent.setDraft}
                onInterrupt={aiAgent.interrupt}
                onRenameSession={(sessionId, title) => {
                  handleRenameAiAgentSession(sessionId, title).catch(() => {});
                }}
                onResize={setAiAgentPanelWidth}
                onResizeEnd={() => setAiAgentPanelResizing(false)}
                onResizeStart={() => setAiAgentPanelResizing(true)}
                onSelectSession={handleSelectAiAgentSession}
                onSelectModel={aiSettings.selectAgentModel}
                onSubmit={aiAgent.submit}
                onToggleThinking={() => aiAgent.setThinkingEnabled((enabled) => !enabled)}
                onToggleWebSearch={() => aiAgent.setWebSearchEnabled((enabled) => !enabled)}
              />
            </div>
          </div>
        </div>

        <AiCommandBar
          aiResult={aiResult}
          availableModels={aiSettings.availableTextModels}
          editorLeftInset={fileTreeOpen ? `${fileTreeWidth}px` : "0px"}
          editorRightInset={aiAgentInset}
          externalActionPending={aiContextMenuActionPending}
          language={appLanguage.language}
          open={aiCommand.open && (hasAiCommandContext || Boolean(aiResult) || aiContextMenuActionPending)}
          prompt={aiCommand.prompt}
          selectedModelId={aiSettings.inlineModelId}
          selectedProviderId={aiSettings.inlineProviderId}
          submitting={aiCommand.submitting}
          supportsThinking={supportsAiThinking}
          onClose={handleAiCommandClose}
          onInterrupt={handleAiCommandInterrupt}
          onPromptChange={aiCommand.updatePrompt}
          onSelectModel={aiSettings.selectInlineModel}
          onSubmit={aiCommand.submitPrompt}
        />
      </main>
      <MarkdownExportDocument
        snapshot={exportSnapshot}
        resolveImageSrc={resolveExportImageSrc}
        onRendered={handleRenderedExport}
      />
    </>
  );
}
