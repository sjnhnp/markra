import { useCallback, useEffect, useState } from "react";
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
import { t, type I18nKey } from "./lib/i18n";
import type { AiDiffResult } from "./lib/agent/inlineAi";
import { AI_EDITOR_PREVIEW_ACTION_EVENT, type AiEditorPreviewAction } from "./lib/aiEditorPreview";

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
  const handleAiResult = useCallback(
    (result: AiDiffResult) => {
      setAiResult(result);
      editor.previewAiResult(result, {
        apply: translate("app.aiApply"),
        copy: translate("app.aiCopy"),
        reject: translate("app.aiReject")
      });
    },
    [editor, translate]
  );
  const aiCommand = useAiCommandUi({
    getDocumentContent: getAiDocumentContent,
    getSelection: editor.getSelection,
    model: aiSettings.defaultModelId,
    onAiResult: handleAiResult,
    provider: aiSettings.activeProvider,
    settingsLoading: aiSettings.loading,
    translate
  });
  const handleTextSelectionChange = useCallback(() => {
    if (!editorPreferences.preferences.autoOpenAiOnSelection || aiCommand.open || aiCommand.submitting) return;

    aiCommand.openAiCommand();
  }, [aiCommand, editorPreferences.preferences.autoOpenAiOnSelection]);
  const saveDocumentAs = useCallback(() => saveCurrentDocument(true), [saveCurrentDocument]);
  const handleApplyAiResult = useCallback(() => {
    if (!aiResult) return;
    if (editor.applyAiResult(aiResult)) {
      setAiResult(null);
      aiCommand.closeAiCommand();
    }
  }, [aiCommand, aiResult, editor]);
  const handleRejectAiResult = useCallback(() => {
    setAiResult(null);
    editor.clearAiPreview();
  }, [editor]);
  const handleCopyAiResult = useCallback(() => {
    if (!aiResult || aiResult.type === "error") return;
    void navigator.clipboard?.writeText(aiResult.replacement);
  }, [aiResult]);
  const handleFileTreeToggle = useCallback(() => toggleFileTree(document.path), [document.path, toggleFileTree]);
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
      const action = (event as CustomEvent<{ action?: AiEditorPreviewAction }>).detail?.action;

      if (action === "apply") {
        handleApplyAiResult();
        return;
      }

      if (action === "copy") {
        handleCopyAiResult();
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

  return (
    <main className="app-shell group/app relative grid h-full w-full grid-rows-[minmax(0,1fr)] overflow-hidden overscroll-none bg-(--bg-primary) text-(--text-primary)">
      <NativeTitleBar
        dirty={document.dirty}
        documentName={document.name}
        language={appLanguage.language}
        theme={appTheme.resolvedTheme}
        onOpenMarkdown={openMarkdownFile}
        onSaveMarkdown={handleSaveClick}
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
          onSelectOutlineItem={editor.selectOutlineItem}
          onToggle={handleFileTreeToggle}
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
            onSelectOutlineItem={editor.selectOutlineItem}
            onToggle={handleFileTreeToggle}
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
        open={aiCommand.open}
        prompt={aiCommand.prompt}
        selectedModelId={aiSettings.defaultModelId}
        selectedProviderId={aiSettings.activeProvider?.id ?? null}
        submitting={aiCommand.submitting}
        onClose={aiCommand.closeAiCommand}
        onInterrupt={aiCommand.interruptPrompt}
        onPromptChange={aiCommand.updatePrompt}
        onSelectModel={aiSettings.selectEditorModel}
        onSubmit={aiCommand.submitPrompt}
      />

      <QuietStatus dirty={document.dirty} language={appLanguage.language} wordCount={wordCount} />
    </main>
  );
}
