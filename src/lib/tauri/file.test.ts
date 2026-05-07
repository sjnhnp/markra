import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import {
  confirmNativeMarkdownFileDelete,
  createNativeMarkdownTreeFile,
  createNativeMarkdownTreeFolder,
  deleteNativeMarkdownTreeFile,
  installNativeMarkdownFileDrop,
  listNativeMarkdownFilesForPath,
  openNativeMarkdownFolder,
  openNativeMarkdownFile,
  openNativeMarkdownFileInNewWindow,
  openNativeMarkdownPath,
  readNativeMarkdownFile,
  renameNativeMarkdownTreeFile,
  saveNativeMarkdownFile,
  watchNativeMarkdownFile
} from "./file";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn()
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn()
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
  open: vi.fn(),
  save: vi.fn()
}));

const mockedInvoke = vi.mocked(invoke);
const mockedListen = vi.mocked(listen);
const mockedGetCurrentWindow = vi.mocked(getCurrentWindow);
const mockedConfirm = vi.mocked(confirm);
const mockedOpen = vi.mocked(open);
const mockedSave = vi.mocked(save);

const mockReadmePath = "/mock-files/readme.md";
const mockDraftPath = "/mock-files/draft.md";
const mockFolderPath = "/mock-files/vault";
const mockUntitledPath = "/mock-files/Untitled.md";

describe("native file access", () => {
  const onDragDropEvent = vi.fn();

  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedListen.mockReset();
    mockedGetCurrentWindow.mockReset();
    mockedConfirm.mockReset();
    mockedOpen.mockReset();
    mockedSave.mockReset();
    onDragDropEvent.mockReset();
    mockedGetCurrentWindow.mockReturnValue({
      onDragDropEvent
    } as unknown as ReturnType<typeof getCurrentWindow>);
  });

  it("opens a markdown file through the native dialog and Tauri command", async () => {
    mockedOpen.mockResolvedValue(mockReadmePath);
    mockedInvoke.mockResolvedValue({
      path: mockReadmePath,
      contents: "# Native"
    });

    await expect(openNativeMarkdownFile()).resolves.toEqual({
      path: mockReadmePath,
      name: "readme.md",
      content: "# Native"
    });

    expect(mockedOpen).toHaveBeenCalledWith({
      multiple: false,
      fileAccessMode: "scoped",
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }]
    });
    expect(mockedInvoke).toHaveBeenCalledWith("read_markdown_file", {
      path: mockReadmePath
    });
  });

  it("does not read from disk when the native open dialog is canceled", async () => {
    mockedOpen.mockResolvedValue(null);

    await expect(openNativeMarkdownFile()).resolves.toBeNull();

    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("opens a markdown file or folder through the unified native picker", async () => {
    mockedInvoke
      .mockResolvedValueOnce({ kind: "file", path: mockReadmePath })
      .mockResolvedValueOnce({
        path: mockReadmePath,
        contents: "# Native"
      })
      .mockResolvedValueOnce({ kind: "folder", path: mockFolderPath });

    await expect(openNativeMarkdownPath()).resolves.toEqual({
      kind: "file",
      file: {
        path: mockReadmePath,
        name: "readme.md",
        content: "# Native"
      }
    });

    await expect(openNativeMarkdownPath()).resolves.toEqual({
      kind: "folder",
      folder: {
        path: mockFolderPath,
        name: "vault"
      }
    });

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "open_markdown_path");
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "read_markdown_file", {
      path: mockReadmePath
    });
    expect(mockedInvoke).toHaveBeenNthCalledWith(3, "open_markdown_path");
  });

  it("returns null when the unified native picker is canceled", async () => {
    mockedInvoke.mockResolvedValue(null);

    await expect(openNativeMarkdownPath()).resolves.toBeNull();

    expect(mockedInvoke).toHaveBeenCalledWith("open_markdown_path");
  });

  it("opens a markdown folder through the native directory dialog", async () => {
    mockedOpen.mockResolvedValue(mockFolderPath);

    await expect(openNativeMarkdownFolder()).resolves.toEqual({
      path: mockFolderPath,
      name: "vault"
    });

    expect(mockedOpen).toHaveBeenCalledWith({
      multiple: false,
      directory: true,
      recursive: true,
      fileAccessMode: "scoped"
    });
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("reads the current markdown file without opening a dialog", async () => {
    mockedInvoke.mockResolvedValue({
      path: mockReadmePath,
      contents: "# External"
    });

    await expect(readNativeMarkdownFile(mockReadmePath)).resolves.toEqual({
      path: mockReadmePath,
      name: "readme.md",
      content: "# External"
    });

    expect(mockedInvoke).toHaveBeenCalledWith("read_markdown_file", {
      path: mockReadmePath
    });
  });

  it("lists markdown files below the current file folder", async () => {
    mockedInvoke.mockResolvedValue([
      { path: "/mock-files/docs", relativePath: "docs" },
      { path: "/mock-files/readme.md", relativePath: "readme.md" },
      { path: "/mock-files/docs/guide.md", relativePath: "docs/guide.md" }
    ]);

    await expect(listNativeMarkdownFilesForPath(mockReadmePath)).resolves.toEqual([
      { kind: "folder", path: "/mock-files/docs", name: "docs", relativePath: "docs" },
      { path: "/mock-files/readme.md", name: "readme.md", relativePath: "readme.md" },
      { path: "/mock-files/docs/guide.md", name: "guide.md", relativePath: "docs/guide.md" }
    ]);

    expect(mockedInvoke).toHaveBeenCalledWith("list_markdown_files_for_path", {
      path: mockReadmePath
    });
  });

  it("creates folders, creates files, renames files, and deletes files through Tauri commands", async () => {
    mockedInvoke
      .mockResolvedValueOnce({ kind: "folder", path: "/mock-files/Research", relativePath: "Research" })
      .mockResolvedValueOnce({ path: "/mock-files/Daily note.md", relativePath: "Daily note.md" })
      .mockResolvedValueOnce({ path: "/mock-files/Renamed.md", relativePath: "Renamed.md" })
      .mockResolvedValueOnce(undefined);

    await expect(createNativeMarkdownTreeFolder(mockFolderPath, "Research")).resolves.toEqual({
      kind: "folder",
      name: "Research",
      path: "/mock-files/Research",
      relativePath: "Research"
    });
    await expect(createNativeMarkdownTreeFile(mockFolderPath, "Daily note")).resolves.toEqual({
      name: "Daily note.md",
      path: "/mock-files/Daily note.md",
      relativePath: "Daily note.md"
    });
    await expect(renameNativeMarkdownTreeFile(mockFolderPath, mockReadmePath, "Renamed.md")).resolves.toEqual({
      name: "Renamed.md",
      path: "/mock-files/Renamed.md",
      relativePath: "Renamed.md"
    });
    await expect(deleteNativeMarkdownTreeFile(mockFolderPath, "/mock-files/Renamed.md")).resolves.toBeUndefined();

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "create_markdown_tree_folder", {
      folderName: "Research",
      rootPath: mockFolderPath
    });
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "create_markdown_tree_file", {
      fileName: "Daily note",
      rootPath: mockFolderPath
    });
    expect(mockedInvoke).toHaveBeenNthCalledWith(3, "rename_markdown_tree_file", {
      fileName: "Renamed.md",
      path: mockReadmePath,
      rootPath: mockFolderPath
    });
    expect(mockedInvoke).toHaveBeenNthCalledWith(4, "delete_markdown_tree_file", {
      path: "/mock-files/Renamed.md",
      rootPath: mockFolderPath
    });
  });

  it("asks for native confirmation before deleting a markdown tree file", async () => {
    mockedConfirm.mockResolvedValue(true);

    await expect(
      confirmNativeMarkdownFileDelete("README.md", {
        cancelLabel: "Cancel",
        message: "Delete this file?",
        okLabel: "Confirm"
      })
    ).resolves.toBe(true);

    expect(mockedConfirm).toHaveBeenCalledWith("Delete this file?", {
      cancelLabel: "Cancel",
      kind: "warning",
      okLabel: "Confirm",
      title: "README.md"
    });
  });

  it("saves an existing markdown file in place through Tauri", async () => {
    mockedInvoke.mockResolvedValue(undefined);

    await expect(
      saveNativeMarkdownFile({
        path: mockDraftPath,
        suggestedName: "draft.md",
        contents: "# Draft"
      })
    ).resolves.toEqual({
      path: mockDraftPath,
      name: "draft.md"
    });

    expect(mockedSave).not.toHaveBeenCalled();
    expect(mockedInvoke).toHaveBeenCalledWith("write_markdown_file", {
      path: mockDraftPath,
      contents: "# Draft"
    });
  });

  it("asks for a native save path before writing an untitled document", async () => {
    mockedSave.mockResolvedValue(mockUntitledPath);
    mockedInvoke.mockResolvedValue(undefined);

    await expect(
      saveNativeMarkdownFile({
        path: null,
        suggestedName: "Untitled.md",
        contents: "# Untitled"
      })
    ).resolves.toEqual({
      path: mockUntitledPath,
      name: "Untitled.md"
    });

    expect(mockedSave).toHaveBeenCalledWith({
      defaultPath: "Untitled.md",
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "txt"] }]
    });
    expect(mockedInvoke).toHaveBeenCalledWith("write_markdown_file", {
      path: mockUntitledPath,
      contents: "# Untitled"
    });
  });

  it("starts and stops a native watcher for the selected markdown path", async () => {
    const unlisten: () => unknown = vi.fn();
    const onChange = vi.fn();
    let emitChange: (path: string) => unknown = () => {};

    mockedListen.mockImplementation(async (_, handler) => {
      emitChange = (path) => {
        handler({ payload: { path } } as never);
      };
      return unlisten;
    });
    mockedInvoke.mockResolvedValue(undefined);

    const unwatch = await watchNativeMarkdownFile(mockReadmePath, onChange);

    expect(mockedListen).toHaveBeenCalledWith("markra://file-changed", expect.any(Function));
    expect(mockedInvoke).toHaveBeenCalledWith("watch_markdown_file", {
      path: mockReadmePath
    });

    emitChange(mockReadmePath);
    emitChange("/mock-files/other.md");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(mockReadmePath);

    unwatch();

    expect(unlisten).toHaveBeenCalledTimes(1);
    expect(mockedInvoke).toHaveBeenCalledWith("unwatch_markdown_file", {
      path: mockReadmePath
    });
  });

  it("routes dropped markdown files from the native window event", async () => {
    const unlisten = vi.fn();
    const onDrop = vi.fn();
    let emitDragDrop: (event: unknown) => unknown = () => {};
    onDragDropEvent.mockImplementation(async (handler) => {
      emitDragDrop = handler;
      return unlisten;
    });

    const cleanup = await installNativeMarkdownFileDrop(onDrop);

    emitDragDrop({ payload: { type: "enter", paths: [mockReadmePath] } });
    emitDragDrop({ payload: { type: "drop", paths: ["/mock-files/image.png", mockReadmePath] } });

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith(mockReadmePath);

    cleanup();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("opens a markdown file path in a new native window", async () => {
    mockedInvoke.mockResolvedValue(undefined);

    await openNativeMarkdownFileInNewWindow(mockReadmePath);

    expect(mockedInvoke).toHaveBeenCalledWith("open_markdown_file_in_new_window", {
      path: mockReadmePath
    });
  });
});
