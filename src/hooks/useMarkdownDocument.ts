import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialMarkdown } from "../constants/initialMarkdown";
import { consumeWelcomeDocumentState, getStoredWorkspaceState, saveStoredWorkspaceState } from "../lib/settings/appSettings";
import { getMarkdownOutline, getWordCount } from "../lib/markdown/markdown";
import {
  openNativeMarkdownFileInNewWindow,
  openNativeMarkdownPath,
  readNativeMarkdownFile,
  saveNativeMarkdownFile,
  watchNativeMarkdownFile,
  type NativeMarkdownFile,
  type NativeMarkdownFolderFile
} from "../lib/tauri/file";
import { setNativeWindowTitle } from "../lib/tauri/window";
import type { DocumentState } from "../types/document";

function isBlankEditorWindow() {
  return new URLSearchParams(window.location.search).has("blank");
}

function initialMarkdownFilePath() {
  return new URLSearchParams(window.location.search).get("path");
}

function createInitialDocumentState(): DocumentState {
  return {
    path: null,
    name: "Untitled.md",
    content: "",
    dirty: false,
    revision: 0
  };
}

function isPristineUntitledDocument(document: DocumentState) {
  return document.path === null && document.content === "" && !document.dirty && document.revision === 0;
}

type UseMarkdownDocumentOptions = {
  getCurrentMarkdown: (fallbackContent: string) => string;
  onTreeRootFromFolderPath: (path: string, name: string) => unknown;
  onTreeRootFromFilePath: (path: string) => unknown;
  preferencesReady?: boolean;
  restoreWorkspaceOnStartup?: boolean;
};

function persistWorkspaceState(patch: Parameters<typeof saveStoredWorkspaceState>[0]) {
  saveStoredWorkspaceState(patch).catch(() => {});
}

export function useMarkdownDocument({
  getCurrentMarkdown,
  onTreeRootFromFolderPath,
  onTreeRootFromFilePath,
  preferencesReady = true,
  restoreWorkspaceOnStartup = true
}: UseMarkdownDocumentOptions) {
  const [document, setDocument] = useState<DocumentState>(() => createInitialDocumentState());
  const documentRef = useRef(document);
  const outlineItems = useMemo(() => getMarkdownOutline(document.content), [document.content]);
  const wordCount = useMemo(() => getWordCount(document.content), [document.content]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const currentMarkdown = useCallback(() => {
    const current = documentRef.current;
    return getCurrentMarkdown(current.content);
  }, [getCurrentMarkdown]);

  const handleMarkdownChange = useCallback((content: string) => {
    setDocument((current) => (current.content === content ? current : { ...current, content, dirty: true }));
  }, []);

  const applyNativeMarkdownFile = useCallback(
    (file: NativeMarkdownFile, updateTreeRoot = true) => {
      setDocument((current) => ({
        path: file.path,
        name: file.name,
        content: file.content,
        dirty: false,
        revision: current.revision + 1
      }));

      if (updateTreeRoot) onTreeRootFromFilePath(file.path);
      persistWorkspaceState({
        filePath: file.path,
        ...(updateTreeRoot ? { folderName: null, folderPath: null } : {})
      });
    },
    [onTreeRootFromFilePath]
  );

  const loadNativeMarkdownPath = useCallback(
    async (path: string, updateTreeRoot = true) => {
      const file = await readNativeMarkdownFile(path);
      applyNativeMarkdownFile(file, updateTreeRoot);
    },
    [applyNativeMarkdownFile]
  );

  const openMarkdownFile = useCallback(async () => {
    const target = await openNativeMarkdownPath();
    if (!target) return;

    if (target.kind === "folder") {
      onTreeRootFromFolderPath(target.folder.path, target.folder.name);
      return;
    }

    applyNativeMarkdownFile(target.file);
  }, [applyNativeMarkdownFile, onTreeRootFromFolderPath]);

  const openTreeMarkdownFile = useCallback(
    async (file: NativeMarkdownFolderFile) => {
      try {
        await loadNativeMarkdownPath(file.path, false);
      } catch {
        // Missing or moved files should leave the tree available for another choice.
      }
    },
    [loadNativeMarkdownPath]
  );

  const saveCurrentDocument = useCallback(
    async (saveAs = false) => {
      const current = documentRef.current;
      const contents = currentMarkdown();
      const savedFile = await saveNativeMarkdownFile({
        path: saveAs ? null : current.path,
        suggestedName: current.name || "Untitled.md",
        contents
      });

      if (!savedFile) return;

      setDocument((latest) => ({
        ...latest,
        path: savedFile.path,
        name: savedFile.name,
        content: contents,
        dirty: false
      }));
      if (saveAs || current.path === null) onTreeRootFromFilePath(savedFile.path);
      persistWorkspaceState({
        filePath: savedFile.path,
        ...(saveAs || current.path === null ? { folderName: null, folderPath: null } : {})
      });
    },
    [currentMarkdown, onTreeRootFromFilePath]
  );

  const handleSaveClick = useCallback(() => {
    saveCurrentDocument(false);
  }, [saveCurrentDocument]);

  const handleDroppedMarkdownPath = useCallback(
    async (path: string) => {
      const current = documentRef.current;
      const isEmptyUntitledDocument = current.path === null && currentMarkdown().trim() === "";

      if (isEmptyUntitledDocument) {
        await loadNativeMarkdownPath(path);
        return;
      }

      await openNativeMarkdownFileInNewWindow(path);
    },
    [currentMarkdown, loadNativeMarkdownPath]
  );

  useEffect(() => {
    const title = document.dirty ? `${document.name} *` : document.name;
    setNativeWindowTitle(title);
  }, [document.name, document.dirty]);

  useEffect(() => {
    const path = initialMarkdownFilePath();
    if (!path) return;

    let active = true;

    readNativeMarkdownFile(path).then((file) => {
      if (!active) return;
      applyNativeMarkdownFile(file);
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [applyNativeMarkdownFile]);

  useEffect(() => {
    if (isBlankEditorWindow() || initialMarkdownFilePath()) return;
    if (!preferencesReady) return;

    let active = true;

    (async () => {
      let restoredWorkspace = false;

      if (restoreWorkspaceOnStartup) {
        try {
          const workspace = await getStoredWorkspaceState();

          if (workspace.folderPath && workspace.fileTreeOpen) {
            onTreeRootFromFolderPath(workspace.folderPath, workspace.folderName ?? workspace.folderPath);
            restoredWorkspace = true;
          }

          if (workspace.filePath) {
            try {
              const file = await readNativeMarkdownFile(workspace.filePath);
              if (!active) return;

              applyNativeMarkdownFile(file, !restoredWorkspace);
              restoredWorkspace = true;
            } catch {
              // A deleted or moved file should not block the normal launch fallback.
            }
          }
        } catch {
          // Store issues should not prevent Markra from opening a usable document.
        }
      }

      if (!active || restoredWorkspace) return;

      const shouldShowWelcomeDocument = await consumeWelcomeDocumentState();
      if (!active || !shouldShowWelcomeDocument) return;

      setDocument((current) => {
        if (!isPristineUntitledDocument(current)) return current;

        return {
          ...current,
          content: initialMarkdown,
          revision: current.revision + 1
        };
      });
    })().catch(() => {});

    return () => {
      active = false;
    };
  }, [applyNativeMarkdownFile, onTreeRootFromFolderPath, preferencesReady, restoreWorkspaceOnStartup]);

  useEffect(() => {
    if (!document.path) return;

    let active = true;
    let unwatch: (() => unknown) | null = null;

    watchNativeMarkdownFile(document.path, async (changedPath) => {
      if (!active) return;

      // External edits rebuild the editor so the visible document mirrors disk.
      const file = await readNativeMarkdownFile(changedPath);
      const current = documentRef.current;
      if (!active || current.path !== file.path || current.content === file.content) return;

      setDocument((latest) => {
        if (latest.path !== file.path || latest.content === file.content) return latest;

        return {
          path: file.path,
          name: file.name,
          content: file.content,
          dirty: false,
          revision: latest.revision + 1
        };
      });
    }).then((stopWatching) => {
      if (!active) {
        stopWatching();
        return;
      }

      unwatch = stopWatching;
    }).catch(() => {});

    return () => {
      active = false;
      unwatch?.();
    };
  }, [document.path]);

  return {
    document,
    handleDroppedMarkdownPath,
    handleMarkdownChange,
    handleSaveClick,
    openMarkdownFile,
    openTreeMarkdownFile,
    outlineItems,
    saveCurrentDocument,
    wordCount
  };
}
