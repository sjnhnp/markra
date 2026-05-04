import { useCallback, useEffect, useState } from "react";
import {
  listNativeMarkdownFilesForPath,
  openNativeMarkdownFolder,
  type NativeMarkdownFolderFile
} from "../lib/nativeFile";

export function folderNameFromDocumentPath(path: string | null) {
  if (!path) return "No folder";

  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.at(-2) ?? "Files";
}

export function pathNameFromPath(path: string | null) {
  if (!path) return "No folder";

  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "Files";
}

export function useMarkdownFileTree() {
  const [files, setFiles] = useState<NativeMarkdownFolderFile[]>([]);
  const [rootName, setRootName] = useState("No folder");
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const workspaceLayoutClassName = open
    ? "workspace-layout grid h-full min-h-0 grid-cols-[18rem_minmax(0,1fr)]"
    : "workspace-layout grid h-full min-h-0 grid-cols-[minmax(0,1fr)]";

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

  const openFolderPath = useCallback((path: string, name = pathNameFromPath(path)) => {
    setSourcePath(path);
    setRootName(name || pathNameFromPath(path));
    setOpen(true);
  }, []);

  const openMarkdownFolder = useCallback(async () => {
    const folder = await openNativeMarkdownFolder();
    if (!folder) return;

    openFolderPath(folder.path, folder.name);
  }, [openFolderPath]);

  const toggle = useCallback(
    (fallbackPath: string | null = null) => {
      setOpen((currentOpen) => {
        const nextOpen = !currentOpen;
        if (nextOpen) void refresh(fallbackPath);
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

    void listNativeMarkdownFilesForPath(sourcePath).then((nextFiles) => {
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
    openMarkdownFolder,
    toggle,
    workspaceLayoutClassName
  };
}
