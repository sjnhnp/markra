import { useCallback } from "react";
import { MarkdownFileTreeDrawer } from "./components/MarkdownFileTreeDrawer";
import { MarkdownPaper } from "./components/MarkdownPaper";
import { NativeTitleBar } from "./components/NativeTitleBar";
import { QuietStatus } from "./components/QuietStatus";
import { SettingsWindow } from "./components/SettingsWindow";
import { useAppTheme } from "./hooks/useAppTheme";
import { useEditorController } from "./hooks/useEditorController";
import { useMarkdownDocument } from "./hooks/useMarkdownDocument";
import { useMarkdownFileTree } from "./hooks/useMarkdownFileTree";
import {
  useApplicationShortcuts,
  useNativeMarkdownDrop,
  useNativeMenuHandlers,
  useNativeMenus
} from "./hooks/useNativeBindings";

function isSettingsWindowRoute() {
  return new URLSearchParams(window.location.search).has("settings");
}

export default function App() {
  if (isSettingsWindowRoute()) {
    return <SettingsWindow />;
  }

  const appTheme = useAppTheme();
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
  const saveDocumentAs = useCallback(() => saveCurrentDocument(true), [saveCurrentDocument]);
  const handleFileTreeToggle = useCallback(() => toggleFileTree(document.path), [document.path, toggleFileTree]);
  const nativeMenuHandlers = useNativeMenuHandlers({
    insertMarkdownSnippet: editor.insertMarkdownSnippet,
    openDocument: openMarkdownFile,
    runEditorShortcut: editor.runEditorShortcut,
    saveDocument: handleSaveClick,
    saveDocumentAs
  });

  useNativeMarkdownDrop(handleDroppedMarkdownPath);
  useNativeMenus(nativeMenuHandlers);
  useApplicationShortcuts({
    openDocument: openMarkdownFile,
    openFolder: openMarkdownFolder,
    saveDocument: handleSaveClick,
    saveDocumentAs
  });

  return (
    <main className="app-shell group/app relative grid h-full w-full grid-rows-[minmax(0,1fr)] overflow-hidden bg-(--bg-primary) text-(--text-primary)">
      <NativeTitleBar
        dirty={document.dirty}
        documentName={document.name}
        theme={appTheme.theme}
        onOpenMarkdown={openMarkdownFile}
        onSaveMarkdown={handleSaveClick}
        onToggleTheme={appTheme.toggleTheme}
      />

      <span className="screen-reader-title sr-only">{document.name}</span>

      {!fileTreeOpen ? (
        <MarkdownFileTreeDrawer
          currentPath={document.path}
          files={fileTreeFiles}
          open={false}
          outlineItems={outlineItems}
          rootName={rootNameForDocument(document.path)}
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
            open
            outlineItems={outlineItems}
            rootName={rootNameForDocument(document.path)}
            onOpenFile={openTreeMarkdownFile}
            onSelectOutlineItem={editor.selectOutlineItem}
            onToggle={handleFileTreeToggle}
          />
        ) : null}

        <MarkdownPaper
          initialContent={document.content}
          onEditorReady={editor.handleEditorReady}
          onMarkdownChange={handleMarkdownChange}
          revision={document.revision}
        />
      </div>

      <QuietStatus dirty={document.dirty} wordCount={wordCount} />
    </main>
  );
}
