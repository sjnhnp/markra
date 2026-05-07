import { useCallback, useEffect, useState } from "react";
import { createAiAgentSessionId, saveStoredWorkspaceState } from "../lib/settings/appSettings";
import {
  listNativeMarkdownFilesForPath,
  openNativeMarkdownFolder,
  type NativeMarkdownFolderFile
} from "../lib/tauri/file";
import { folderNameFromDocumentPath, pathNameFromPath } from "../lib/utils";

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
  const workspaceLayoutClassName = open
    ? "workspace-layout grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)] overflow-hidden transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
    : "workspace-layout grid h-full min-h-0 grid-cols-[0rem_minmax(0,1fr)] overflow-hidden transition-[grid-template-columns] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

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
    if (!folder) return;

    openFolderPath(folder.path, folder.name);
  }, [openFolderPath]);

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
    files,
    open,
    openFolderPath,
    rootNameForDocument,
    setRootFromMarkdownFilePath,
    sourcePath,
    openMarkdownFolder,
    toggle,
    workspaceLayoutClassName
  };
}
