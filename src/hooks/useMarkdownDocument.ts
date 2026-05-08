import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialMarkdown } from "../constants/initialMarkdown";
import {
  consumeWelcomeDocumentState,
  createAiAgentSessionId,
  getStoredWorkspaceState,
  saveStoredWorkspaceState
} from "../lib/settings/appSettings";
import { getMarkdownOutline, getWordCount } from "../lib/markdown/markdown";
import {
  openNativeMarkdownFolderInNewWindow,
  openNativeMarkdownFileInNewWindow,
  openNativeMarkdownPath,
  readNativeMarkdownFile,
  saveNativeMarkdownFile,
  watchNativeMarkdownFile,
  type NativeMarkdownDroppedTarget,
  type NativeMarkdownFile,
  type NativeMarkdownFolderFile
} from "../lib/tauri/file";
import { setNativeWindowTitle } from "../lib/tauri/window";
import { pathNameFromPath } from "../lib/utils";
import type { DocumentState } from "../types/document";

function isBlankEditorWindow() {
  return new URLSearchParams(window.location.search).has("blank");
}

function initialMarkdownFilePath() {
  return new URLSearchParams(window.location.search).get("path");
}

function initialMarkdownFolderPath() {
  return new URLSearchParams(window.location.search).get("folder");
}

function createInitialDocumentState(): DocumentState {
  return {
    path: null,
    name: "Untitled.md",
    content: "",
    dirty: false,
    open: true,
    revision: 0
  };
}

function isPristineUntitledDocument(document: DocumentState) {
  return document.open && document.path === null && document.content === "" && !document.dirty && document.revision === 0;
}

function comparableMarkdown(content: string) {
  return content
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+$/gmu, "")
    .trim();
}

function isEquivalentEditorMarkdown(left: string, right: string) {
  return comparableMarkdown(left) === comparableMarkdown(right);
}

type UseMarkdownDocumentOptions = {
  confirmDiscardUnsavedChanges?: (document: DocumentState) => boolean | Promise<boolean>;
  getCurrentMarkdown: (fallbackContent: string) => string;
  onMarkdownTreeChange?: (path: string) => unknown | Promise<unknown>;
  onTreeRootFromFolderPath: (path: string, name: string, sessionId?: string | null) => unknown;
  onTreeRootFromFilePath: (path: string) => unknown;
  onWorkspaceSessionChange?: (sessionId: string) => unknown;
  preferencesReady?: boolean;
  restoreWorkspaceOnStartup?: boolean;
};

function persistWorkspaceState(patch: Parameters<typeof saveStoredWorkspaceState>[0]) {
  saveStoredWorkspaceState(patch).catch(() => {});
}

export function useMarkdownDocument({
  confirmDiscardUnsavedChanges,
  getCurrentMarkdown,
  onMarkdownTreeChange,
  onTreeRootFromFolderPath,
  onTreeRootFromFilePath,
  onWorkspaceSessionChange,
  preferencesReady = true,
  restoreWorkspaceOnStartup = true
}: UseMarkdownDocumentOptions) {
  const [document, setDocument] = useState<DocumentState>(() => createInitialDocumentState());
  const [workspaceSessionId, setWorkspaceSessionId] = useState<string | null>(null);
  const documentRef = useRef(document);
  const workspaceSessionIdRef = useRef<string | null>(null);
  const outlineItems = useMemo(() => getMarkdownOutline(document.content), [document.content]);
  const wordCount = useMemo(() => getWordCount(document.content), [document.content]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    workspaceSessionIdRef.current = workspaceSessionId;
  }, [workspaceSessionId]);

  const assignWorkspaceSessionId = useCallback((sessionId: string) => {
    workspaceSessionIdRef.current = sessionId;
    setWorkspaceSessionId(sessionId);
    onWorkspaceSessionChange?.(sessionId);
    return sessionId;
  }, [onWorkspaceSessionChange]);

  const resolveWorkspaceSessionId = useCallback((preferredSessionId?: string | null) => {
    return assignWorkspaceSessionId(preferredSessionId?.trim() ? preferredSessionId : createAiAgentSessionId());
  }, [assignWorkspaceSessionId]);

  const selectWorkspaceSession = useCallback((sessionId: string) => {
    const nextSessionId = assignWorkspaceSessionId(sessionId);
    persistWorkspaceState({ aiAgentSessionId: nextSessionId });
    return nextSessionId;
  }, [assignWorkspaceSessionId]);

  const createWorkspaceSession = useCallback(() => {
    return selectWorkspaceSession(createAiAgentSessionId());
  }, [selectWorkspaceSession]);

  const currentMarkdown = useCallback(() => {
    const current = documentRef.current;
    if (!current.open) return current.content;

    return getCurrentMarkdown(current.content);
  }, [getCurrentMarkdown]);

  const hasDiscardableUnsavedChanges = useCallback(() => {
    const current = documentRef.current;
    if (!current.open) return false;
    if (current.path === null && current.content.trim().length === 0) return false;

    const editorMarkdown = currentMarkdown();
    if (!current.dirty) {
      return !isEquivalentEditorMarkdown(editorMarkdown, current.content) && (current.path !== null || editorMarkdown.trim().length > 0);
    }
    if (current.path) return true;

    return editorMarkdown.trim().length > 0;
  }, [currentMarkdown]);

  const confirmCanDiscardCurrentDocument = useCallback(() => {
    if (!hasDiscardableUnsavedChanges()) return true;

    return confirmDiscardUnsavedChanges?.(documentRef.current) ?? true;
  }, [confirmDiscardUnsavedChanges, hasDiscardableUnsavedChanges]);

  const handleMarkdownChange = useCallback((content: string) => {
    setDocument((current) => {
      if (!current.open || current.content === content) return current;
      if (!current.dirty && isEquivalentEditorMarkdown(current.content, content)) {
        return { ...current, content, dirty: false };
      }

      return { ...current, content, dirty: true };
    });
  }, []);

  const resetToBlankDocument = useCallback(() => {
    setDocument((current) => ({
      path: null,
      name: "Untitled.md",
      content: "",
      dirty: true,
      open: true,
      revision: current.revision + 1
    }));
    persistWorkspaceState({ filePath: null });
    return true;
  }, []);

  const createBlankDocument = useCallback(() => {
    const canDiscard = confirmCanDiscardCurrentDocument();
    if (typeof canDiscard === "boolean") {
      if (!canDiscard) return Promise.resolve(false);

      return Promise.resolve(resetToBlankDocument());
    }

    return canDiscard.then((confirmed) => {
      if (!confirmed) return false;

      return resetToBlankDocument();
    });
  }, [confirmCanDiscardCurrentDocument, resetToBlankDocument]);

  const clearOpenDocument = useCallback(() => {
    setDocument((current) => ({
      path: null,
      name: "",
      content: "",
      dirty: false,
      open: false,
      revision: current.revision + 1
    }));
    persistWorkspaceState({ filePath: null });
  }, []);

  const applyNativeMarkdownFile = useCallback(
    (file: NativeMarkdownFile, updateTreeRoot = true, preferredSessionId?: string | null) => {
      const sessionId = updateTreeRoot
        ? resolveWorkspaceSessionId(preferredSessionId)
        : resolveWorkspaceSessionId(preferredSessionId ?? workspaceSessionIdRef.current);

      setDocument((current) => ({
        path: file.path,
        name: file.name,
        content: file.content,
        dirty: false,
        open: true,
        revision: current.revision + 1
      }));

      if (updateTreeRoot) onTreeRootFromFilePath(file.path);
      persistWorkspaceState({
        aiAgentSessionId: sessionId,
        filePath: file.path,
        ...(updateTreeRoot ? { folderName: null, folderPath: null } : {})
      });
    },
    [onTreeRootFromFilePath, resolveWorkspaceSessionId]
  );

  const loadNativeMarkdownPath = useCallback(
    async (path: string, updateTreeRoot = true, preferredSessionId?: string | null) => {
      const file = await readNativeMarkdownFile(path);
      applyNativeMarkdownFile(file, updateTreeRoot, preferredSessionId);
    },
    [applyNativeMarkdownFile]
  );

  const openMarkdownFile = useCallback(async () => {
    const target = await openNativeMarkdownPath();
    if (!target) return;

    if (target.kind === "folder") {
      const canDiscard = await confirmCanDiscardCurrentDocument();
      if (!canDiscard) return;

      const sessionId = resolveWorkspaceSessionId();
      clearOpenDocument();
      onTreeRootFromFolderPath(target.folder.path, target.folder.name, sessionId);
      return;
    }

    const canDiscard = await confirmCanDiscardCurrentDocument();
    if (!canDiscard) return;

    applyNativeMarkdownFile(target.file);
  }, [applyNativeMarkdownFile, clearOpenDocument, confirmCanDiscardCurrentDocument, onTreeRootFromFolderPath, resolveWorkspaceSessionId]);

  const openTreeMarkdownFile = useCallback(
    async (file: NativeMarkdownFolderFile) => {
      try {
        const canDiscard = await confirmCanDiscardCurrentDocument();
        if (!canDiscard) return;

        await loadNativeMarkdownPath(file.path, false);
      } catch {
        // Missing or moved files should leave the tree available for another choice.
      }
    },
    [confirmCanDiscardCurrentDocument, loadNativeMarkdownPath]
  );

  const replaceOpenDocumentFile = useCallback((previousPath: string, file: NativeMarkdownFolderFile) => {
    if (documentRef.current.path !== previousPath) return false;

    setDocument((current) => {
      if (current.path !== previousPath) return current;

      return {
        ...current,
        name: file.name,
        path: file.path
      };
    });
    persistWorkspaceState({ filePath: file.path });
    return true;
  }, []);

  const detachDeletedDocumentFile = useCallback((path: string) => {
    if (documentRef.current.path !== path) return false;

    setDocument((current) => {
      if (current.path !== path) return current;

      return {
        ...current,
        dirty: true,
        name: "Untitled.md",
        open: true,
        path: null,
        revision: current.revision + 1
      };
    });
    persistWorkspaceState({ filePath: null });
    return true;
  }, []);

  const saveCurrentDocument = useCallback(
    async (saveAs = false) => {
      const current = documentRef.current;
      if (!current.open) return;

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
    async (target: NativeMarkdownDroppedTarget) => {
      const current = documentRef.current;
      const isEmptyUntitledDocument = !current.open || (current.path === null && currentMarkdown().trim() === "");

      if (target.kind === "folder") {
        if (!isEmptyUntitledDocument) {
          await openNativeMarkdownFolderInNewWindow(target.path);
          return;
        }

        const sessionId = resolveWorkspaceSessionId();
        clearOpenDocument();
        onTreeRootFromFolderPath(target.path, target.name, sessionId);
        return;
      }

      if (isEmptyUntitledDocument) {
        await loadNativeMarkdownPath(target.path);
        return;
      }

      await openNativeMarkdownFileInNewWindow(target.path);
    },
    [clearOpenDocument, currentMarkdown, loadNativeMarkdownPath, onTreeRootFromFolderPath, resolveWorkspaceSessionId]
  );

  useEffect(() => {
    const title = document.open && document.dirty ? `${document.name} *` : document.name;
    setNativeWindowTitle(title);
  }, [document.name, document.dirty, document.open]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDiscardableUnsavedChanges()) return;

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasDiscardableUnsavedChanges]);

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
    const folderPath = initialMarkdownFolderPath();
    if (!folderPath) return;

    const sessionId = resolveWorkspaceSessionId();
    clearOpenDocument();
    onTreeRootFromFolderPath(folderPath, pathNameFromPath(folderPath), sessionId);
  }, [clearOpenDocument, onTreeRootFromFolderPath, resolveWorkspaceSessionId]);

  useEffect(() => {
    if (isBlankEditorWindow() || initialMarkdownFilePath() || initialMarkdownFolderPath()) return;
    if (!preferencesReady) return;

    let active = true;

    (async () => {
      let restoredWorkspace = false;

      if (restoreWorkspaceOnStartup) {
        try {
          const workspace = await getStoredWorkspaceState();
          const sessionId = workspace.aiAgentSessionId ?? createAiAgentSessionId();

          assignWorkspaceSessionId(sessionId);

          if (workspace.folderPath && workspace.fileTreeOpen) {
            clearOpenDocument();
            onTreeRootFromFolderPath(workspace.folderPath, workspace.folderName ?? workspace.folderPath, sessionId);
            restoredWorkspace = true;
          }

          if (workspace.filePath) {
            try {
              const file = await readNativeMarkdownFile(workspace.filePath);
              if (!active) return;

              applyNativeMarkdownFile(file, !restoredWorkspace, sessionId);
              restoredWorkspace = true;
            } catch {
              // A deleted or moved file should not block the normal launch fallback.
            }
          }

          if (workspace.aiAgentSessionId !== sessionId) {
            persistWorkspaceState({ aiAgentSessionId: sessionId });
          }
        } catch {
          // Store issues should not prevent Markra from opening a usable document.
        }
      }

      if (!active || restoredWorkspace) return;

      const sessionId = resolveWorkspaceSessionId();
      persistWorkspaceState({ aiAgentSessionId: sessionId });

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
  }, [
    applyNativeMarkdownFile,
    assignWorkspaceSessionId,
    clearOpenDocument,
    onTreeRootFromFolderPath,
    preferencesReady,
    resolveWorkspaceSessionId,
    restoreWorkspaceOnStartup
  ]);

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
          open: true,
          revision: latest.revision + 1
        };
      });
    }, (changedPath) => {
      if (!active) return;
      onMarkdownTreeChange?.(changedPath);
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
  }, [document.path, onMarkdownTreeChange]);

  return {
    clearOpenDocument,
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
  };
}
