import { useCallback, useEffect, useRef, useState } from "react";
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
import { initializeStoredAiAgentSession } from "./lib/settings/appSettings";
import { readNativeMarkdownFile } from "./lib/tauri/file";
import { clampNumber } from "./lib/utils";

const aiAgentPanelDefaultWidth = 384;
const aiAgentPanelMinWidth = 320;
const aiAgentPanelMaxWidth = 760;

function isSettingsWindowRoute() {
  return new URLSearchParams(window.location.search).has("settings");
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
  const activeAiSelectionRef = useRef<AiSelectionContext | null>(null);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);
  const editor = useEditorController();
  const fileTree = useMarkdownFileTree({
    onWorkspaceSessionChange: setAiAgentSessionId
  });
  const {
    files: fileTreeFiles,
    open: fileTreeOpen,
    openFolderPath,
    openMarkdownFolder,
    rootNameForDocument,
    setRootFromMarkdownFilePath,
    toggle: toggleFileTree,
    workspaceLayoutClassName
  } = fileTree;
  const markdownDocument = useMarkdownDocument({
    getCurrentMarkdown: editor.getCurrentMarkdown,
    onTreeRootFromFolderPath: openFolderPath,
    onTreeRootFromFilePath: setRootFromMarkdownFilePath,
    onWorkspaceSessionChange: setAiAgentSessionId,
    preferencesReady: !editorPreferences.loading,
    restoreWorkspaceOnStartup: editorPreferences.preferences.restoreWorkspaceOnStartup
  });
  const {
    createWorkspaceSession,
    document,
    handleDroppedMarkdownPath,
    handleMarkdownChange,
    handleSaveClick,
    openMarkdownFile,
    openTreeMarkdownFile,
    outlineItems,
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
      updateAiResult(result);
      editor.previewAiResult(result, {
        apply: translate("app.aiApply"),
        copied: translate("app.aiCopied"),
        copy: translate("app.aiCopy"),
        reject: translate("app.aiReject")
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
    getSelection: getActiveAiSelection,
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

    const applied = editor.applyAiResult(result);
    console.debug("[markra-ai-preview] app apply result", { applied });

    if (applied) {
      editor.clearAiSelection();
      updateAiResult(null);
      handleAiCommandClose();
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
    openFolder: openMarkdownFolder,
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
          theme={appTheme.resolvedTheme}
          onOpenMarkdown={openMarkdownFile}
          onSaveMarkdown={handleSaveClick}
          onToggleAiAgent={handleAiAgentToggle}
          onToggleMarkdownFiles={handleFileTreeToggle}
          onToggleTheme={appTheme.toggleTheme}
        />

        <span className="screen-reader-title sr-only">{document.name}</span>

        <div className={workspaceLayoutClassName}>
          <div className="markdown-file-tree-slot min-h-0 overflow-hidden">
            <MarkdownFileTreeDrawer
              currentPath={document.path}
              files={fileTreeFiles}
              language={appLanguage.language}
              open
              outlineItems={outlineItems}
              rootName={fileTreeRootName}
              onOpenFile={openTreeMarkdownFile}
              onOpenSettings={handleOpenSettings}
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
                onClose={() => setAiAgentOpen(false)}
                onCreateSession={handleCreateAiAgentSession}
                onDraftChange={aiAgent.setDraft}
                onInterrupt={aiAgent.interrupt}
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
          editorLeftInset={fileTreeOpen ? "18rem" : "0px"}
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
