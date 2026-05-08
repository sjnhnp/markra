import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { fileNameFromPath, firstMarkdownPath } from "../utils";

type MarkdownFileResponse = {
  path: string;
  contents: string;
};

type MarkdownFolderFileResponse = {
  kind?: "file" | "folder";
  path: string;
  relativePath: string;
};

type MarkdownOpenPathResponse =
  | {
      kind: "file";
      path: string;
    }
  | {
      kind: "folder";
      path: string;
    };

export type NativeMarkdownFile = {
  path: string;
  name: string;
  content: string;
};

export type NativeMarkdownFolderFile = {
  kind?: "folder";
  path: string;
  name: string;
  relativePath: string;
};

export type NativeMarkdownFolder = {
  path: string;
  name: string;
};

export type NativeMarkdownOpenTarget =
  | {
      kind: "file";
      file: NativeMarkdownFile;
    }
  | {
      kind: "folder";
      folder: NativeMarkdownFolder;
    };

export type SaveNativeMarkdownFileInput = {
  path: string | null;
  suggestedName: string;
  contents: string;
};

export type SavedNativeMarkdownFile = {
  path: string;
  name: string;
};

export type NativeMarkdownFileChangeHandler = (path: string) => unknown | Promise<unknown>;
export type NativeMarkdownFileDropHandler = (path: string) => unknown | Promise<unknown>;

type MarkdownFileChangedPayload = {
  path: string;
};

const markdownFileChangedEvent = "markra://file-changed";

const markdownFilters = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"]
  }
];

function isMarkdownTreeFilePath(path: string) {
  return /\.(md|markdown)$/i.test(path);
}

export async function readNativeMarkdownFile(path: string): Promise<NativeMarkdownFile> {
  const file = await invoke<MarkdownFileResponse>("read_markdown_file", {
    path
  });

  return {
    path: file.path,
    name: fileNameFromPath(file.path),
    content: file.contents
  };
}

export async function listNativeMarkdownFilesForPath(path: string): Promise<NativeMarkdownFolderFile[]> {
  const files = await invoke<MarkdownFolderFileResponse[]>("list_markdown_files_for_path", {
    path
  });

  return files.map(markdownFolderFileFromResponse);
}

function markdownFolderFileFromResponse(file: MarkdownFolderFileResponse): NativeMarkdownFolderFile {
  const mappedFile: NativeMarkdownFolderFile = {
    path: file.path,
    name: fileNameFromPath(file.path),
    relativePath: file.relativePath
  };

  if (file.kind === "folder" || (!file.kind && !isMarkdownTreeFilePath(file.relativePath))) {
    mappedFile.kind = "folder";
  }

  return mappedFile;
}

export async function createNativeMarkdownTreeFile(rootPath: string, fileName: string): Promise<NativeMarkdownFolderFile> {
  const file = await invoke<MarkdownFolderFileResponse>("create_markdown_tree_file", {
    fileName,
    rootPath
  });

  return markdownFolderFileFromResponse(file);
}

export async function createNativeMarkdownTreeFolder(
  rootPath: string,
  folderName: string
): Promise<NativeMarkdownFolderFile> {
  const folder = await invoke<MarkdownFolderFileResponse>("create_markdown_tree_folder", {
    folderName,
    rootPath
  });

  return markdownFolderFileFromResponse(folder);
}

export async function renameNativeMarkdownTreeFile(
  rootPath: string,
  path: string,
  fileName: string
): Promise<NativeMarkdownFolderFile> {
  const file = await invoke<MarkdownFolderFileResponse>("rename_markdown_tree_file", {
    fileName,
    path,
    rootPath
  });

  return markdownFolderFileFromResponse(file);
}

export async function deleteNativeMarkdownTreeFile(rootPath: string, path: string) {
  await invoke("delete_markdown_tree_file", {
    path,
    rootPath
  });
}

export async function confirmNativeMarkdownFileDelete(
  fileName: string,
  labels: { cancelLabel: string; message: string; okLabel: string }
) {
  return confirm(labels.message, {
    cancelLabel: labels.cancelLabel,
    kind: "warning",
    okLabel: labels.okLabel,
    title: fileName
  });
}

export async function confirmNativeUnsavedMarkdownDocumentDiscard(
  fileName: string,
  labels: { cancelLabel: string; message: string; okLabel: string }
) {
  return confirm(labels.message, {
    cancelLabel: labels.cancelLabel,
    kind: "warning",
    okLabel: labels.okLabel,
    title: fileName
  });
}

export async function openNativeMarkdownFileInNewWindow(path: string) {
  await invoke("open_markdown_file_in_new_window", { path });
}

export async function openNativeMarkdownFile(): Promise<NativeMarkdownFile | null> {
  // The native dialog gives us a real filesystem path; Rust owns the actual disk read.
  const selectedPath = await open({
    multiple: false,
    fileAccessMode: "scoped",
    filters: markdownFilters
  });

  if (!selectedPath || Array.isArray(selectedPath)) return null;

  return readNativeMarkdownFile(selectedPath);
}

export async function openNativeMarkdownPath(): Promise<NativeMarkdownOpenTarget | null> {
  const target = await invoke<MarkdownOpenPathResponse | null>("open_markdown_path");
  if (!target) return null;

  if (target.kind === "folder") {
    return {
      kind: "folder",
      folder: {
        path: target.path,
        name: fileNameFromPath(target.path)
      }
    };
  }

  return {
    kind: "file",
    file: await readNativeMarkdownFile(target.path)
  };
}

export async function openNativeMarkdownFolder(): Promise<NativeMarkdownFolder | null> {
  const selectedPath = await open({
    multiple: false,
    directory: true,
    recursive: true,
    fileAccessMode: "scoped"
  });

  if (!selectedPath || Array.isArray(selectedPath)) return null;

  return {
    path: selectedPath,
    name: fileNameFromPath(selectedPath)
  };
}

export async function saveNativeMarkdownFile({
  path,
  suggestedName,
  contents
}: SaveNativeMarkdownFileInput): Promise<SavedNativeMarkdownFile | null> {
  // Existing files save in place. Untitled documents first ask macOS for a target path.
  const targetPath =
    path ??
    (await save({
      defaultPath: suggestedName,
      filters: markdownFilters
    }));

  if (!targetPath) return null;

  await invoke("write_markdown_file", {
    path: targetPath,
    contents
  });

  return {
    path: targetPath,
    name: fileNameFromPath(targetPath)
  };
}

export async function watchNativeMarkdownFile(path: string, onChange: NativeMarkdownFileChangeHandler) {
  const unlisten = await listen<MarkdownFileChangedPayload>(markdownFileChangedEvent, (event) => {
    if (event.payload.path !== path) return;
    onChange(event.payload.path);
  });

  try {
    await invoke("watch_markdown_file", { path });
  } catch (error) {
    unlisten();
    throw error;
  }

  return () => {
    unlisten();
    invoke("unwatch_markdown_file", { path });
  };
}

export async function installNativeMarkdownFileDrop(onDrop: NativeMarkdownFileDropHandler) {
  try {
    return await getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;

      const path = firstMarkdownPath(event.payload.paths);
      if (!path) return;

      onDrop(path);
    });
  } catch {
    return () => {};
  }
}
