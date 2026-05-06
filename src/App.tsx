import { useCallback, useEffect, useRef, useState } from "react";
import { AppToaster } from "./components/AppToaster";
import { AiCommandBar } from "./components/AiCommandBar";
import { MarkdownFileTreeDrawer } from "./components/MarkdownFileTreeDrawer";
import { MarkdownPaper } from "./components/MarkdownPaper";
import { NativeTitleBar } from "./components/NativeTitleBar";
import { QuietStatus } from "./components/QuietStatus";
import { SettingsWindow } from "./components/SettingsWindow";
import { useAppLanguage } from "./hooks/useAppLanguage";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAiCommandUi } from "./hooks/useAiCommandUi";
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
  const [aiResult, setAiResult] = useState<AiDiffResult | null>(null);
  const [activeAiSelection, setActiveAiSelection] = useState<AiSelectionContext | null>(null);
  const aiResultRef = useRef<AiDiffResult | null>(null);
  const activeAiSelectionRef = useRef<AiSelectionContext | null>(null);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);
  const editor = useEditorController();
  const fileTree = useMarkdownFileTree();
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
    onTreeRootFromFilePath: setRootFromMarkdownFilePath
  });
  const {
    document,
    handleDroppedMarkdownPath,
    handleMarkdownChange,
    handleSaveClick,
    openMarkdownFile,
    openTreeMarkdownFile,
    outlineItems,
    saveCurrentDocument,
    wordCount
  } = markdownDocument;
  const getAiDocumentContent = useCallback(() => editor.getCurrentMarkdown(document.content), [document.content, editor]);
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
  const hasActiveAiSelection = Boolean(activeAiSelection?.text.trim());
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
  const aiCommand = useAiCommandUi({
    documentPath: document.path,
    getDocumentContent: getAiDocumentContent,
    getPendingResult: getPendingAiResult,
    getSelection: getActiveAiSelection,
    model: aiSettings.defaultModelId,
    onAiResult: handleAiResult,
    provider: aiSettings.activeProvider,
    settingsLoading: aiSettings.loading,
    translate,
    translationTargetLanguage: aiTranslationLanguageName(appLanguage.ready ? appLanguage.language : "en"),
    workspaceFiles: fileTreeFiles
  });
  const restoreAiCommand = aiCommand.restoreAiCommand;
  const handleAiCommandClose = useCallback(() => {
    aiCommand.closeAiCommand();
    editor.clearAiSelection();
  }, [aiCommand, editor]);
  const handleTextSelectionChange = useCallback((selection: AiSelectionContext | null) => {
    updateActiveAiSelection(selection);

    if (!selection?.text.trim()) {
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
    if (!result) return;
    if (editor.applyAiResult(result)) {
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
      restoreAiCommand();
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
          dirty={document.dirty}
          documentName={document.name}
          language={appLanguage.language}
          markdownFilesOpen={fileTreeOpen}
          theme={appTheme.resolvedTheme}
          onOpenMarkdown={openMarkdownFile}
          onSaveMarkdown={handleSaveClick}
          onToggleMarkdownFiles={handleFileTreeToggle}
          onToggleTheme={appTheme.toggleTheme}
        />

        <span className="screen-reader-title sr-only">{document.name}</span>

        {!fileTreeOpen ? (
          <MarkdownFileTreeDrawer
            currentPath={document.path}
            files={fileTreeFiles}
            language={appLanguage.language}
            open={false}
            outlineItems={outlineItems}
            rootName={fileTreeRootName}
            onOpenFile={openTreeMarkdownFile}
            onOpenSettings={handleOpenSettings}
            onSelectOutlineItem={editor.selectOutlineItem}
          />
        ) : null}

        <div className={workspaceLayoutClassName}>
          {fileTreeOpen ? (
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
          ) : null}

          <MarkdownPaper
            autoFocus={shouldFocusEditorOnReady(document.content)}
            initialContent={document.content}
            language={appLanguage.language}
            onEditorReady={editor.handleEditorReady}
            onMarkdownChange={handleMarkdownChange}
            onTextSelectionChange={handleTextSelectionChange}
            revision={document.revision}
          />
        </div>

        <AiCommandBar
          aiResult={aiResult}
          availableModels={aiSettings.availableTextModels}
          editorLeftInset={fileTreeOpen ? "18rem" : "0px"}
          language={appLanguage.language}
          open={aiCommand.open && (hasActiveAiSelection || Boolean(aiResult))}
          prompt={aiCommand.prompt}
          selectedModelId={aiSettings.defaultModelId}
          selectedProviderId={aiSettings.activeProvider?.id ?? null}
          submitting={aiCommand.submitting}
          onClose={handleAiCommandClose}
          onInterrupt={aiCommand.interruptPrompt}
          onPromptChange={aiCommand.updatePrompt}
          onSelectModel={aiSettings.selectEditorModel}
          onSubmit={aiCommand.submitPrompt}
        />

        <QuietStatus dirty={document.dirty} language={appLanguage.language} wordCount={wordCount} />
      </main>
    </>
  );
}
