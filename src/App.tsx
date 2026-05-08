import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppToaster } from "./components/AppToaster";
import { AiCommandBar } from "./components/AiCommandBar";
import { AiAgentPanel } from "./components/AiAgentPanel";
import { MarkdownFileTreeDrawer } from "./components/MarkdownFileTreeDrawer";
import { MarkdownPaper } from "./components/MarkdownPaper";
import { NativeTitleBar } from "./components/NativeTitleBar";
import { QuietStatus } from "./components/QuietStatus";
import { SettingsWindow } from "./components/SettingsWindow";
import { useAppLanguage } from "./hooks/useAppLanguage";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAiCommandUi } from "./hooks/useAiCommandUi";
import { useAiAgentSessionList } from "./hooks/useAiAgentSessionList";
import { useAiAgentSession } from "./hooks/useAiAgentSession";
import { useAiSettings } from "./hooks/useAiSettings";
import { useEditorPreferences } from "./hooks/useEditorPreferences";
import { shouldFocusEditorOnReady, useEditorController } from "./hooks/useEditorController";
import { useMarkdownDocument } from "./hooks/useMarkdownDocument";
import { useMarkdownFileTree } from "./hooks/useMarkdownFileTree";
import {
  useApplicationShortcuts,
  useNativeMarkdownDrop,
  useNativeMenuHandlers,
  useNativeMenus
} from "./hooks/useNativeBindings";
import { aiTranslationLanguageName, t, type I18nKey } from "./lib/i18n";
import { openSettingsWindow } from "./lib/tauri/window";
import type { AiDiffResult, AiSelectionContext } from "./lib/ai/agent/inlineAi";
import {
  AI_EDITOR_PREVIEW_ACTION_EVENT,
  AI_EDITOR_PREVIEW_RESTORE_EVENT,
  type AiEditorPreviewActionDetail,
  type AiEditorPreviewRestoreDetail
} from "./lib/ai/editorPreview";
import {
  deleteStoredAiAgentSession,
  initializeStoredAiAgentSession,
  saveStoredAiAgentSessionTitle,
  setStoredAiAgentSessionArchived
} from "./lib/settings/appSettings";
import {
  confirmNativeMarkdownFileDelete,
  confirmNativeUnsavedMarkdownDocumentDiscard,
  readNativeMarkdownFile,
  type NativeMarkdownFolderFile
} from "./lib/tauri/file";
import { clampNumber } from "./lib/utils";

const aiAgentPanelDefaultWidth = 384;
const aiAgentPanelMinWidth = 320;
const aiAgentPanelMaxWidth = 760;
const aiResultSignatureSeparator = "\u001f";

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

export default function App() {
  if (isSettingsWindowRoute()) {
    return <SettingsWindow />;
  }

  const appTheme = useAppTheme();
  const appLanguage = useAppLanguage();
  const aiSettings = useAiSettings();
  const editorPreferences = useEditorPreferences();
  const [aiAgentSessionId, setAiAgentSessionId] = useState<string | null>(null);
  const [aiAgentOpen, setAiAgentOpen] = useState(false);
  const [aiAgentPanelWidth, setAiAgentPanelWidth] = useState(aiAgentPanelDefaultWidth);
  const [aiAgentPanelResizing, setAiAgentPanelResizing] = useState(false);
  const [aiResult, setAiResult] = useState<AiDiffResult | null>(null);
  const [activeAiSelection, setActiveAiSelection] = useState<AiSelectionContext | null>(null);
  const aiResultRef = useRef<AiDiffResult | null>(null);
  const appliedAiResultSignaturesRef = useRef(new Set<string>());
  const activeAiSelectionRef = useRef<AiSelectionContext | null>(null);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);
  const editor = useEditorController();
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
    getCurrentMarkdown: editor.getCurrentMarkdown,
    onTreeRootFromFolderPath: openFolderPath,
    onTreeRootFromFilePath: setRootFromMarkdownFilePath,
    onWorkspaceSessionChange: setAiAgentSessionId,
    preferencesReady: !editorPreferences.loading,
    restoreWorkspaceOnStartup: editorPreferences.preferences.restoreWorkspaceOnStartup
  });
  const {
    createBlankDocument,
    createWorkspaceSession,
    confirmCanDiscardCurrentDocument,
    detachDeletedDocumentFile,
    document,
    handleDroppedMarkdownPath,
    handleMarkdownChange,
    handleSaveClick,
    openMarkdownFile,
    openTreeMarkdownFile,
    outlineItems,
    replaceOpenDocumentFile,
    saveCurrentDocument,
    selectWorkspaceSession,
    workspaceSessionId,
    wordCount
  } = markdownDocument;
  const workspaceKey = fileTree.sourcePath ?? document.path ?? null;
  const activeAiAgentSessionId = workspaceSessionId ?? aiAgentSessionId;
  const getAiDocumentContent = useCallback(() => editor.getCurrentMarkdown(document.content), [document.content, editor]);
  const readAiWorkspaceFile = useCallback(async (path: string) => {
    const file = await readNativeMarkdownFile(path);

    return file.content;
  }, []);
  const getActiveAiSelection = useCallback(() => activeAiSelectionRef.current, []);
  const updateActiveAiSelection = useCallback((selection: AiSelectionContext | null) => {
    activeAiSelectionRef.current = selection;
    setActiveAiSelection(selection);
  }, []);
  const updateAiResult = useCallback((result: AiDiffResult | null) => {
    aiResultRef.current = result;
    setAiResult(result);
  }, []);
  const getPendingAiResult = useCallback(() => aiResultRef.current, []);
  const hasActiveAiSelection = activeAiSelection?.source === "selection" && Boolean(activeAiSelection.text.trim());
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
  const aiAgentInset = aiAgentOpen ? `${aiAgentPanelWidth}px` : "0px";
  const editorAgentLayoutClassName = `editor-agent-layout grid min-h-0 ${
    aiAgentPanelResizing
      ? "transition-none"
      : "transition-[grid-template-columns] duration-220 ease-out motion-reduce:transition-none"
  }`;
  const handleAiResult = useCallback(
    (result: AiDiffResult) => {
      editor.clearAiSelection();
      appliedAiResultSignaturesRef.current.clear();
      updateAiResult(result);
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
      });
    },
    [editor, translate, updateAiResult]
  );
  const handleAiAgentSessionRestore = useCallback((session: { panelOpen: boolean; panelWidth: number | null }) => {
    setAiAgentOpen(session.panelOpen);
    setAiAgentPanelWidth(clampNumber(session.panelWidth, aiAgentPanelMinWidth, aiAgentPanelMaxWidth) ?? aiAgentPanelDefaultWidth);
  }, []);
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
    onAiResult: handleAiResult,
    onSessionRestore: handleAiAgentSessionRestore,
    panelOpen: aiAgentOpen,
    panelWidth: aiAgentPanelWidth,
    provider: aiSettings.agentProvider,
    readWorkspaceFile: readAiWorkspaceFile,
    sessionId: activeAiAgentSessionId,
    settingsLoading: aiSettings.loading,
    translate,
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
  const restoreAiCommand = aiCommand.restoreAiCommand;
  const handleAiCommandClose = useCallback(() => {
    aiCommand.closeAiCommand();
    editor.clearAiSelection();
  }, [aiCommand, editor]);
  const handleCreateAiAgentSession = useCallback(() => {
    const sessionId = createWorkspaceSession();

    setAiAgentOpen(true);
    initializeStoredAiAgentSession(sessionId, workspaceKey).then(() => {
      aiAgentSessions.refresh().catch(() => {});
    }).catch(() => {});
  }, [aiAgentSessions, createWorkspaceSession, workspaceKey]);
  const handleSelectAiAgentSession = useCallback((sessionId: string) => {
    selectWorkspaceSession(sessionId);
    setAiAgentOpen(true);
  }, [selectWorkspaceSession]);
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
        await initializeStoredAiAgentSession(nextSessionId, workspaceKey);
      }
    }

    await aiAgentSessions.refresh();
    setAiAgentOpen(true);
  }, [activeAiAgentSessionId, aiAgentSessions, createWorkspaceSession, selectWorkspaceSession, workspaceKey]);
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
        await initializeStoredAiAgentSession(nextSessionId, workspaceKey);
      }
    }

    await aiAgentSessions.refresh();
    setAiAgentOpen(true);
  }, [activeAiAgentSessionId, aiAgentSessions, createWorkspaceSession, selectWorkspaceSession, workspaceKey]);
  const handleTextSelectionChange = useCallback((selection: AiSelectionContext | null) => {
    updateActiveAiSelection(selection);

    if (!selection?.text.trim()) {
      editor.clearAiSelection();
      if (!aiResultRef.current) aiCommand.closeAiCommand();
      return;
    }

    if (selection.source !== "selection") {
      editor.clearAiSelection();
      if (!aiResultRef.current) aiCommand.closeAiCommand();
      return;
    }

    editor.holdAiSelection(selection);

    if (!editorPreferences.preferences.autoOpenAiOnSelection || aiCommand.open || aiCommand.submitting) return;

    aiCommand.openAiCommand(selection);
  }, [aiCommand, editor, editorPreferences.preferences.autoOpenAiOnSelection, updateActiveAiSelection]);
  const saveDocumentAs = useCallback(() => saveCurrentDocument(true), [saveCurrentDocument]);
  const handleApplyAiResult = useCallback((restoredResult?: AiDiffResult | null) => {
    const result = restoredResult ?? aiResult;
    if (!result) {
      console.warn("[markra-ai-preview] apply ignored: no pending result", {
        aiResult,
        restoredResult
      });
      return;
    }

    console.debug("[markra-ai-preview] app handle apply", {
      from: result.type === "error" ? null : result.from,
      replacementLength: result.type === "error" ? null : result.replacement.length,
      to: result.type === "error" ? null : result.to,
      type: result.type
    });

    const signature = aiResultSignature(result);
    if (appliedAiResultSignaturesRef.current.has(signature)) {
      console.debug("[markra-ai-preview] apply ignored: duplicate result", {
        type: result.type
      });
      editor.confirmAiResultApplied(result);
      editor.clearAiSelection();
      updateAiResult(null);
      handleAiCommandClose();
      return;
    }

    const applied = editor.applyAiResult(result);
    console.debug("[markra-ai-preview] app apply result", { applied });

    if (applied) {
      const confirmAppliedPreview = () => {
        editor.confirmAiResultApplied(result);
      };

      appliedAiResultSignaturesRef.current.add(signature);
      editor.clearAiSelection();
      updateAiResult(null);
      handleAiCommandClose();
      confirmAppliedPreview();
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(confirmAppliedPreview);
      } else {
        window.setTimeout(confirmAppliedPreview, 0);
      }
    }
  }, [aiResult, editor, handleAiCommandClose, updateAiResult]);
  const handleRejectAiResult = useCallback(() => {
    editor.clearAiSelection();
    updateAiResult(null);
    editor.clearAiPreview();
  }, [editor, updateAiResult]);
  const handleCopyAiResult = useCallback((restoredResult?: AiDiffResult | null) => {
    const result = restoredResult ?? aiResult;
    if (!result || result.type === "error") return;
    navigator.clipboard?.writeText(result.replacement);
  }, [aiResult]);
  const handleCreateMarkdownTreeFile = useCallback(async (fileName: string) => {
    try {
      const file = await createMarkdownTreeFile(fileName);
      if (file) await openTreeMarkdownFile(file);
    } catch {
      // Native file errors are surfaced by the platform operation when possible.
    }
  }, [createMarkdownTreeFile, openTreeMarkdownFile]);
  const handleQuickCreateMarkdownTreeFile = useCallback(() => {
    createBlankDocument().catch(() => {});
  }, [createBlankDocument]);
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
      if (renamedFile) replaceOpenDocumentFile(file.path, renamedFile);
    } catch {
      // Keep the existing tree state if the native rename fails.
    }
  }, [renameMarkdownTreeFile, replaceOpenDocumentFile]);
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
  const handleFileTreeToggle = useCallback(() => toggleFileTree(document.path), [document.path, toggleFileTree]);
  const handleAiAgentToggle = useCallback(() => {
    setAiAgentOpen((open) => !open);
  }, []);
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
  const supportsAiThinking = selectedInlineAiModel?.capabilities.includes("reasoning") ?? false;
  const handleOpenMarkdownFolder = useCallback(async () => {
    const canDiscard = await confirmCanDiscardCurrentDocument();
    if (!canDiscard) return;

    await openMarkdownFolder();
  }, [confirmCanDiscardCurrentDocument, openMarkdownFolder]);
  const aiAgentContext = useMemo(() => ({
    documentName: document.name,
    headingCount: editor.getHeadingAnchors().length,
    messageCount: aiAgent.messages.length,
    sectionCount: editor.getSectionAnchors().length,
    selectionChars: activeAiSelection?.text.trim().length ?? 0,
    sessionId: activeAiAgentSessionId,
    tableCount: editor.getTableAnchors().length
  }), [
    activeAiAgentSessionId,
    activeAiSelection,
    aiAgent.messages.length,
    document.content,
    document.name,
    document.revision,
    editor
  ]);
  const nativeMenuHandlers = useNativeMenuHandlers({
    insertMarkdownSnippet: editor.insertMarkdownSnippet,
    openDocument: openMarkdownFile,
    runEditorShortcut: editor.runEditorShortcut,
    saveDocument: handleSaveClick,
    saveDocumentAs
  });

  useNativeMarkdownDrop(handleDroppedMarkdownPath);
  useNativeMenus(nativeMenuHandlers, appLanguage.ready ? appLanguage.language : null);
  useApplicationShortcuts({
    openDocument: openMarkdownFile,
    openFolder: handleOpenMarkdownFolder,
    saveDocument: handleSaveClick,
    saveDocumentAs
  });

  useEffect(() => {
    const handlePreviewAction = (event: Event) => {
      const detail = (event as CustomEvent<Partial<AiEditorPreviewActionDetail>>).detail;
      const action = detail?.action;
      console.debug("[markra-ai-preview] app received action event", detail);

      if (action === "apply") {
        handleApplyAiResult(detail.result);
        return;
      }

      if (action === "copy") {
        handleCopyAiResult(detail.result);
        return;
      }

      if (action === "reject") {
        handleRejectAiResult();
      }
    };

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, handlePreviewAction);
    return () => {
      window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, handlePreviewAction);
    };
  }, [handleApplyAiResult, handleCopyAiResult, handleRejectAiResult]);

  useEffect(() => {
    const handlePreviewRestore = (event: Event) => {
      const result = (event as CustomEvent<Partial<AiEditorPreviewRestoreDetail>>).detail?.result;
      if (!result || (result.type !== "insert" && result.type !== "replace")) return;

      appliedAiResultSignaturesRef.current.delete(aiResultSignature(result));
      updateAiResult(result);
      restoreAiCommand({ reopen: false });
    };

    window.addEventListener(AI_EDITOR_PREVIEW_RESTORE_EVENT, handlePreviewRestore);
    return () => {
      window.removeEventListener(AI_EDITOR_PREVIEW_RESTORE_EVENT, handlePreviewRestore);
    };
  }, [restoreAiCommand, updateAiResult]);

  return (
    <>
      <AppToaster language={appLanguage.language} />
      <main className="app-shell group/app relative grid h-full w-full grid-rows-[minmax(0,1fr)] overflow-hidden overscroll-none bg-(--bg-primary) text-(--text-primary)">
        <NativeTitleBar
          aiAgentOpen={aiAgentOpen}
          aiAgentResizing={aiAgentPanelResizing}
          aiAgentWidth={aiAgentPanelWidth}
          dirty={document.dirty}
          documentName={document.name}
          language={appLanguage.language}
          markdownFilesOpen={fileTreeOpen}
          markdownFilesResizing={fileTreeResizing}
          markdownFilesWidth={fileTreeWidth}
          quickCreateMarkdownFileVisible={!fileTreeOpen}
          theme={appTheme.resolvedTheme}
          onCreateMarkdownFile={handleQuickCreateMarkdownTreeFile}
          onOpenMarkdown={openMarkdownFile}
          onSaveMarkdown={handleSaveClick}
          onToggleAiAgent={handleAiAgentToggle}
          onToggleMarkdownFiles={handleFileTreeToggle}
          onToggleTheme={appTheme.toggleTheme}
        />

        <span className="screen-reader-title sr-only">{document.name}</span>

        <div className={workspaceLayoutClassName} style={workspaceLayoutStyle}>
          <div className="markdown-file-tree-slot min-h-0 overflow-hidden">
            <MarkdownFileTreeDrawer
              currentPath={document.path}
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
              onOpenFile={openTreeMarkdownFile}
              onOpenSettings={handleOpenSettings}
              onRenameFile={handleRenameMarkdownTreeFile}
              onResize={resizeFileTree}
              onResizeEnd={endFileTreeResize}
              onResizeStart={startFileTreeResize}
              onSelectOutlineItem={editor.selectOutlineItem}
            />
          </div>

          <div
            className={editorAgentLayoutClassName}
            style={{ gridTemplateColumns: `minmax(0,1fr) ${aiAgentInset}` }}
          >
            <div className="editor-content-slot relative h-full min-h-0 overflow-hidden">
              <MarkdownPaper
                autoFocus={shouldFocusEditorOnReady(document.content)}
                bodyFontSize={editorPreferences.preferences.bodyFontSize}
                contentWidth={editorPreferences.preferences.contentWidth}
                initialContent={document.content}
                language={appLanguage.language}
                lineHeight={editorPreferences.preferences.lineHeight}
                onEditorReady={editor.handleEditorReady}
                onMarkdownChange={handleMarkdownChange}
                onTextSelectionChange={handleTextSelectionChange}
                revision={document.revision}
              />
              <QuietStatus
                dirty={document.dirty}
                language={appLanguage.language}
                showWordCount={editorPreferences.preferences.showWordCount}
                wordCount={wordCount}
              />
            </div>
            <div className="ai-agent-panel-slot relative z-20 min-h-0 overflow-hidden">
              <AiAgentPanel
                activeSessionId={activeAiAgentSessionId}
                availableModels={aiSettings.availableTextModels}
                context={aiAgentContext}
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
                webSearchEnabled={aiAgent.webSearchEnabled}
                maxWidth={aiAgentPanelMaxWidth}
                minWidth={aiAgentPanelMinWidth}
                width={aiAgentPanelWidth}
                onArchiveSession={(sessionId, archived) => {
                  handleArchiveAiAgentSession(sessionId, archived).catch(() => {});
                }}
                onClose={() => setAiAgentOpen(false)}
                onCreateSession={handleCreateAiAgentSession}
                onDeleteSession={(sessionId) => {
                  handleDeleteAiAgentSession(sessionId).catch(() => {});
                }}
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
          language={appLanguage.language}
          open={aiCommand.open && (hasActiveAiSelection || Boolean(aiResult))}
          prompt={aiCommand.prompt}
          selectedModelId={aiSettings.inlineModelId}
          selectedProviderId={aiSettings.inlineProviderId}
          submitting={aiCommand.submitting}
          supportsThinking={supportsAiThinking}
          onClose={handleAiCommandClose}
          onInterrupt={aiCommand.interruptPrompt}
          onPromptChange={aiCommand.updatePrompt}
          onSelectModel={aiSettings.selectInlineModel}
          onSubmit={aiCommand.submitPrompt}
        />
      </main>
    </>
  );
}
