import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createAiAgentSessionId, saveStoredWorkspaceState } from "../lib/settings/appSettings";
import {
  createNativeMarkdownTreeFile,
  createNativeMarkdownTreeFolder,
  deleteNativeMarkdownTreeFile,
  listNativeMarkdownFilesForPath,
  openNativeMarkdownFolder,
  renameNativeMarkdownTreeFile,
  type NativeMarkdownFolderFile
} from "../lib/tauri";
import { clampNumber, folderNameFromDocumentPath, pathNameFromPath } from "@markra/shared";

export const markdownFileTreeDefaultWidth = 288;
export const markdownFileTreeMinWidth = 220;
export const markdownFileTreeMaxWidth = 440;

function persistWorkspaceState(patch: Parameters<typeof saveStoredWorkspaceState>[0]) {
  saveStoredWorkspaceState(patch).catch(() => {});
}

type UseMarkdownFileTreeOptions = {
  onWorkspaceSessionChange?: (sessionId: string) => unknown;
};

export function useMarkdownFileTree({ onWorkspaceSessionChange }: UseMarkdownFileTreeOptions = {}) {
  const [files, setFiles] = useState<NativeMarkdownFolderFile[]>([]);
  const [rootName, setRootName] = useState("No folder");
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(markdownFileTreeDefaultWidth);
  const [resizing, setResizing] = useState(false);
  const workspaceLayoutClassName = `workspace-layout grid h-full min-h-0 overflow-hidden ${
    resizing
      ? "transition-none"
      : "transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
  }`;
  const workspaceLayoutStyle = {
    gridTemplateColumns: open ? `${width}px minmax(0,1fr)` : "0px minmax(0,1fr)"
  } satisfies CSSProperties;

  const resize = useCallback((nextWidth: number) => {
    const clampedWidth = clampNumber(nextWidth, markdownFileTreeMinWidth, markdownFileTreeMaxWidth);
    if (clampedWidth === null) return;

    setWidth(clampedWidth);
  }, []);

  const startResize = useCallback(() => {
    setResizing(true);
  }, []);

  const endResize = useCallback(() => {
    setResizing(false);
  }, []);

  const refresh = useCallback(
    async (fallbackPath: string | null = null) => {
      const path = sourcePath ?? fallbackPath;
      if (!path) {
        setFiles([]);
        return;
      }

      try {
        setFiles(await listNativeMarkdownFilesForPath(path));
      } catch {
        setFiles([]);
      }
    },
    [sourcePath]
  );

  const setRootFromMarkdownFilePath = useCallback((path: string) => {
    setSourcePath(path);
    setRootName(folderNameFromDocumentPath(path));
  }, []);

  const openFolderPath = useCallback((path: string, name = pathNameFromPath(path), preferredSessionId?: string | null) => {
    const folderName = name || pathNameFromPath(path);
    const sessionId = preferredSessionId?.trim() ? preferredSessionId : createAiAgentSessionId();
    setSourcePath(path);
    setRootName(folderName);
    setOpen(true);
    onWorkspaceSessionChange?.(sessionId);
    // Folder navigation is restored independently from the last active document.
    persistWorkspaceState({
      aiAgentSessionId: sessionId,
      fileTreeOpen: true,
      folderName,
      folderPath: path
    });
  }, [onWorkspaceSessionChange]);

  const openMarkdownFolder = useCallback(async () => {
    const folder = await openNativeMarkdownFolder();
    if (!folder) return null;

    openFolderPath(folder.path, folder.name);
    return folder;
  }, [openFolderPath]);

  const createFile = useCallback(async (fileName: string) => {
    if (!sourcePath) return null;

    const file = await createNativeMarkdownTreeFile(sourcePath, fileName);
    await refresh(sourcePath);
    return file;
  }, [refresh, sourcePath]);

  const createFolder = useCallback(async (folderName: string) => {
    if (!sourcePath) return null;

    const folder = await createNativeMarkdownTreeFolder(sourcePath, folderName);
    await refresh(sourcePath);
    return folder;
  }, [refresh, sourcePath]);

  const renameFile = useCallback(async (file: NativeMarkdownFolderFile, fileName: string) => {
    if (!sourcePath) return null;

    const renamedFile = await renameNativeMarkdownTreeFile(sourcePath, file.path, fileName);
    await refresh(sourcePath);
    return renamedFile;
  }, [refresh, sourcePath]);

  const deleteFile = useCallback(async (file: NativeMarkdownFolderFile) => {
    if (!sourcePath) return false;

    await deleteNativeMarkdownTreeFile(sourcePath, file.path);
    await refresh(sourcePath);
    return true;
  }, [refresh, sourcePath]);

  const toggle = useCallback(
    (fallbackPath: string | null = null) => {
      setOpen((currentOpen) => {
        const nextOpen = !currentOpen;
        if (nextOpen) refresh(fallbackPath);
        persistWorkspaceState({ fileTreeOpen: nextOpen });
        return nextOpen;
      });
    },
    [refresh]
  );

  const rootNameForDocument = useCallback(
    (path: string | null) => (sourcePath ? rootName : folderNameFromDocumentPath(path)),
    [rootName, sourcePath]
  );

  useEffect(() => {
    let active = true;

    if (!sourcePath) {
      setFiles([]);
      return () => {
        active = false;
      };
    }

    listNativeMarkdownFilesForPath(sourcePath).then((nextFiles) => {
      if (active) setFiles(nextFiles);
    }).catch(() => {
      if (active) setFiles([]);
    });

    return () => {
      active = false;
    };
  }, [sourcePath]);

  return {
    createFile,
    createFolder,
    deleteFile,
    files,
    resizing,
    width,
    maxWidth: markdownFileTreeMaxWidth,
    minWidth: markdownFileTreeMinWidth,
    open,
    openFolderPath,
    rootNameForDocument,
    refresh,
    setRootFromMarkdownFilePath,
    sourcePath,
    openMarkdownFolder,
    renameFile,
    resize,
    endResize,
    startResize,
    toggle,
    workspaceLayoutClassName,
    workspaceLayoutStyle
  };
}
