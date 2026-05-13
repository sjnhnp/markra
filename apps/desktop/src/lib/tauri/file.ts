import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import { fileNameFromPath } from "@markra/shared";

type MarkdownFileResponse = {
  path: string;
  contents: string;
};

type MarkdownFolderFileResponse = {
  kind?: "asset" | "file" | "folder";
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
  kind?: "asset" | "folder";
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

export type NativeMarkdownDroppedTarget =
  | {
      kind: "file";
      path: string;
      name: string;
    }
  | {
      kind: "folder";
      path: string;
      name: string;
    };

export type SaveNativeMarkdownFileInput = {
  path: string | null;
  suggestedName: string;
  contents: string;
};

export type SaveNativeHtmlFileInput = {
  suggestedName: string;
  contents: string;
};

export type SaveNativePdfFileInput = {
  suggestedName: string;
  contents: string;
};

export type SavedNativeMarkdownFile = {
  path: string;
  name: string;
};

export type SavedNativeHtmlFile = {
  path: string;
  name: string;
};

export type SavedNativePdfFile = {
  path: string;
  name: string;
};

export type SaveNativeClipboardImageInput = {
  documentPath: string;
  folder: string;
  image: File;
};

export type NativeMarkdownPickerLabels = {
  title: string;
};

export type SavedNativeClipboardImage = {
  alt: string;
  src: string;
};

export type ReadNativeMarkdownImageInput = {
  documentPath: string;
  src: string;
};

export type NativeMarkdownImageFile = {
  dataUrl: string;
  mimeType: string;
  path: string;
  src: string;
};

export type NativeMarkdownFileChangeHandler = (path: string) => unknown | Promise<unknown>;
export type NativeMarkdownTreeChangeHandler = (path: string) => unknown | Promise<unknown>;
export type NativeMarkdownFileDropHandler = (target: NativeMarkdownDroppedTarget) => unknown | Promise<unknown>;

type MarkdownFileChangedPayload = {
  path: string;
};

type MarkdownTreeChangedPayload = {
  path: string;
  rootPath: string;
};

type ClipboardImageFileResponse = {
  relativePath: string;
};

type MarkdownImageFileResponse = {
  bytes: number[];
  mimeType: string;
  path: string;
};

const markdownFileChangedEvent = "markra://file-changed";
const markdownTreeChangedEvent = "markra://tree-changed";

const markdownFilters = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"]
  }
];

const htmlFilters = [
  {
    name: "HTML",
    extensions: ["html", "htm"]
  }
];

const pdfFilters = [
  {
    name: "PDF",
    extensions: ["pdf"]
  }
];

function isMarkdownTreeFilePath(path: string) {
  return /\.(md|markdown)$/i.test(path);
}

function isMarkdownTreeAssetPath(path: string) {
  return /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(path);
}

function parentPathFromPath(path: string) {
  const lastSeparatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastSeparatorIndex < 0) return ".";
  return path.slice(0, lastSeparatorIndex);
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

function bytesToBase64(bytes: number[]) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

export async function readNativeMarkdownImageFile({
  documentPath,
  src
}: ReadNativeMarkdownImageInput): Promise<NativeMarkdownImageFile> {
  const image = await invoke<MarkdownImageFileResponse>("read_markdown_image_file", {
    documentPath,
    src
  });

  return {
    dataUrl: `data:${image.mimeType};base64,${bytesToBase64(image.bytes)}`,
    mimeType: image.mimeType,
    path: image.path,
    src
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

  if (file.kind === "asset" || (!file.kind && isMarkdownTreeAssetPath(file.relativePath))) {
    mappedFile.kind = "asset";
  } else if (file.kind === "folder" || (!file.kind && !isMarkdownTreeFilePath(file.relativePath))) {
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

export async function openNativeMarkdownFolderInNewWindow(path: string) {
  await invoke("open_markdown_folder_in_new_window", { path });
}

function pickerTitleOption(labels: NativeMarkdownPickerLabels | undefined) {
  const title = labels?.title.trim();
  return title ? { title } : {};
}

export async function openNativeMarkdownFile(labels?: NativeMarkdownPickerLabels): Promise<NativeMarkdownFile | null> {
  // The native dialog gives us a real filesystem path; Rust owns the actual disk read.
  const selectedPath = await open({
    multiple: false,
    fileAccessMode: "scoped",
    filters: markdownFilters,
    ...pickerTitleOption(labels)
  });

  if (!selectedPath || Array.isArray(selectedPath)) return null;

  return readNativeMarkdownFile(selectedPath);
}

export async function openNativeMarkdownPath(labels?: NativeMarkdownPickerLabels): Promise<NativeMarkdownOpenTarget | null> {
  const title = labels?.title.trim();
  const target = title
    ? await invoke<MarkdownOpenPathResponse | null>("open_markdown_path", { title })
    : await invoke<MarkdownOpenPathResponse | null>("open_markdown_path");
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

function droppedTargetFromResponse(target: MarkdownOpenPathResponse): NativeMarkdownDroppedTarget {
  return {
    kind: target.kind,
    path: target.path,
    name: fileNameFromPath(target.path)
  };
}

export async function resolveNativeMarkdownPath(path: string): Promise<NativeMarkdownDroppedTarget> {
  const target = await invoke<MarkdownOpenPathResponse>("resolve_markdown_path", {
    path
  });

  return droppedTargetFromResponse(target);
}

async function firstDroppedMarkdownTarget(paths: string[]) {
  for (const path of paths) {
    try {
      return await resolveNativeMarkdownPath(path);
    } catch {
      // Keep looking; drag payloads can contain images or other unsupported files.
    }
  }

  return null;
}

export async function openNativeMarkdownFolder(labels?: NativeMarkdownPickerLabels): Promise<NativeMarkdownFolder | null> {
  const selectedPath = await open({
    multiple: false,
    directory: true,
    recursive: true,
    fileAccessMode: "scoped",
    ...pickerTitleOption(labels)
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

export async function saveNativeHtmlFile({
  suggestedName,
  contents
}: SaveNativeHtmlFileInput): Promise<SavedNativeHtmlFile | null> {
  const targetPath = await save({
    defaultPath: suggestedName,
    filters: htmlFilters
  });

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

export async function saveNativePdfFile({
  suggestedName,
  contents
}: SaveNativePdfFileInput): Promise<SavedNativePdfFile | null> {
  const targetPath = await save({
    defaultPath: suggestedName,
    filters: pdfFilters
  });

  if (!targetPath) return null;

  await invoke("export_pdf_file", {
    path: targetPath,
    html: contents
  });

  return {
    path: targetPath,
    name: fileNameFromPath(targetPath)
  };
}

function imageAltFromFileName(fileName: string) {
  const trimmedName = fileName.trim();
  if (!trimmedName) return "image";

  const withoutExtension = trimmedName.replace(/\.[^.]*$/u, "").trim();
  return withoutExtension || "image";
}

function encodeMarkdownUrlSegment(segment: string) {
  return encodeURIComponent(segment).replace(/[!'()*]/gu, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeMarkdownRelativePath(path: string) {
  return path.split("/").map(encodeMarkdownUrlSegment).join("/");
}

export async function saveNativeClipboardImage({
  documentPath,
  folder,
  image
}: SaveNativeClipboardImageInput): Promise<SavedNativeClipboardImage> {
  const bytes = Array.from(new Uint8Array(await image.arrayBuffer()));
  const savedImage = await invoke<ClipboardImageFileResponse>("save_clipboard_image", {
    bytes,
    documentPath,
    folder,
    mimeType: image.type
  });

  return {
    alt: imageAltFromFileName(image.name),
    src: encodeMarkdownRelativePath(savedImage.relativePath)
  };
}

export async function watchNativeMarkdownFile(
  path: string,
  onChange: NativeMarkdownFileChangeHandler,
  onTreeChange?: NativeMarkdownTreeChangeHandler
) {
  const unlistenFile = await listen<MarkdownFileChangedPayload>(markdownFileChangedEvent, (event) => {
    if (event.payload.path !== path) return;
    onChange(event.payload.path);
  });
  let unlistenTree: (() => unknown) | null = null;

  try {
    if (onTreeChange) {
      const rootPath = parentPathFromPath(path);
      unlistenTree = await listen<MarkdownTreeChangedPayload>(markdownTreeChangedEvent, (event) => {
        if (event.payload.rootPath !== rootPath) return;
        onTreeChange(event.payload.path);
      });
    }

    await invoke("watch_markdown_file", { path });
  } catch (error) {
    unlistenFile();
    unlistenTree?.();
    throw error;
  }

  return () => {
    unlistenFile();
    unlistenTree?.();
    invoke("unwatch_markdown_file", { path });
  };
}

export async function installNativeMarkdownFileDrop(onDrop: NativeMarkdownFileDropHandler) {
  try {
    return await getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;

      firstDroppedMarkdownTarget(event.payload.paths).then((target) => {
        if (!target) return;

        onDrop(target);
      }).catch(() => {});
    });
  } catch {
    return () => {};
  }
}
