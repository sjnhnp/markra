import { Menu, type MenuOptions } from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  installNativeEditorContextMenu,
  installNativeApplicationMenu,
  listenNativeApplicationMenuCommands,
  showNativeMarkdownFileTreeContextMenu,
  type NativeMenuHandlers
} from "./menu";

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: {
    new: vi.fn()
  }
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn()
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn()
}));

const mockedMenuNew = vi.mocked(Menu.new);
const mockedListen = vi.mocked(listen);
const mockedGetCurrentWindow = vi.mocked(getCurrentWindow);
type TestMenuItem = NonNullable<MenuOptions["items"]>[number];
type TestActionMenuItem = TestMenuItem & {
  action?: (id: string) => unknown;
  id?: string;
};

function latestMenuItems() {
  const menuOptions = mockedMenuNew.mock.calls[0]?.[0];
  if (!menuOptions) throw new Error("Expected a native menu to be created.");

  return menuOptions.items ?? [];
}

function menuItemById(items: TestMenuItem[], id: string) {
  const item = items.find((candidate) => "id" in candidate && candidate.id === id);
  if (!item) throw new Error(`Expected menu item ${id}.`);

  return item as TestActionMenuItem;
}

describe("native menu", () => {
  const setAsAppMenu = vi.fn();
  const popup = vi.fn();
  const unlisten = vi.fn();
  const isFocused = vi.fn();

  beforeEach(() => {
    mockedMenuNew.mockReset();
    mockedListen.mockReset();
    mockedGetCurrentWindow.mockReset();
    setAsAppMenu.mockReset();
    popup.mockReset();
    unlisten.mockReset();
    isFocused.mockReset();
    mockedMenuNew.mockResolvedValue({
      popup,
      setAsAppMenu
    } as unknown as Awaited<ReturnType<typeof Menu.new>>);
    mockedListen.mockResolvedValue(unlisten);
    mockedGetCurrentWindow.mockReturnValue({
      isFocused
    } as unknown as ReturnType<typeof getCurrentWindow>);
    isFocused.mockResolvedValue(true);
  });

  it("routes native application menu commands to the current app handlers", async () => {
    const handlers: NativeMenuHandlers = {
      openDocument: vi.fn(),
      saveDocument: vi.fn()
    };

    const stopListening = await listenNativeApplicationMenuCommands(handlers);
    const listener = mockedListen.mock.calls[0]?.[1];

    expect(mockedListen).toHaveBeenCalledWith("markra://menu-command", expect.any(Function));

    await listener?.({ payload: { command: "openDocument" } } as Parameters<NonNullable<typeof listener>>[0]);
    await listener?.({ payload: { command: "saveDocument" } } as Parameters<NonNullable<typeof listener>>[0]);
    await listener?.({ payload: { command: "unknown" } } as Parameters<NonNullable<typeof listener>>[0]);
    await listener?.({ payload: { command: "openFolder" } } as unknown as Parameters<NonNullable<typeof listener>>[0]);

    expect(handlers.openDocument).toHaveBeenCalledTimes(1);
    expect(handlers.saveDocument).toHaveBeenCalledTimes(1);

    stopListening();

    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("installs the application menu while keeping command listeners", async () => {
    const handlers: NativeMenuHandlers = {
      saveDocument: vi.fn()
    };

    await installNativeApplicationMenu(handlers, "fr");

    expect(mockedListen).toHaveBeenCalledWith("markra://menu-command", expect.any(Function));
    expect(mockedMenuNew).toHaveBeenCalledWith({
      items: expect.arrayContaining([
        expect.objectContaining({ id: "markra:file" }),
        expect.objectContaining({ id: "markra:format" })
      ])
    });
    expect(setAsAppMenu).toHaveBeenCalledTimes(1);
  });

  it("ignores native application menu commands in unfocused windows", async () => {
    isFocused.mockResolvedValue(false);
    const handlers: NativeMenuHandlers = {
      saveDocument: vi.fn()
    };

    await listenNativeApplicationMenuCommands(handlers);
    const listener = mockedListen.mock.calls[0]?.[1];

    await listener?.({ payload: { command: "saveDocument" } } as Parameters<NonNullable<typeof listener>>[0]);

    expect(handlers.saveDocument).not.toHaveBeenCalled();
  });

  it("shows a native context menu only inside the markdown paper", async () => {
    const target = document.createElement("main");
    const paper = document.createElement("article");
    const outside = document.createElement("button");
    paper.className = "markdown-paper";
    target.append(paper, outside);

    const cleanup = await installNativeEditorContextMenu(target, {
      formatBold: vi.fn()
    });

    outside.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

    expect(popup).not.toHaveBeenCalled();

    paper.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

    expect(mockedMenuNew).toHaveBeenCalledTimes(1);
    expect(popup).toHaveBeenCalledTimes(1);

    cleanup();
    paper.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));

    expect(popup).toHaveBeenCalledTimes(1);
  });

  it("shows native markdown file tree actions for a file target", async () => {
    const createFile = vi.fn();
    const createFolder = vi.fn();
    const renameFile = vi.fn();
    const deleteFile = vi.fn();
    const file = {
      name: "README.md",
      path: "/vault/README.md",
      relativePath: "README.md"
    };

    await showNativeMarkdownFileTreeContextMenu({
      createFile,
      createFolder,
      deleteFile,
      renameFile
    }, "en", file);

    const items = latestMenuItems();
    const newFile = menuItemById(items, "markra:file-tree:new");
    const newFolder = menuItemById(items, "markra:file-tree:new-folder");
    const rename = menuItemById(items, "markra:file-tree:rename");
    const deleteItem = menuItemById(items, "markra:file-tree:delete");

    expect(newFile).toMatchObject({ text: "New file" });
    expect(newFolder).toMatchObject({ text: "New Folder" });
    expect(rename).toMatchObject({ text: "Rename file" });
    expect(deleteItem).toMatchObject({ text: "Delete file" });

    newFile.action?.("markra:file-tree:new");
    newFolder.action?.("markra:file-tree:new-folder");
    rename.action?.("markra:file-tree:rename");
    deleteItem.action?.("markra:file-tree:delete");

    expect(createFile).toHaveBeenCalledTimes(1);
    expect(createFolder).toHaveBeenCalledTimes(1);
    expect(renameFile).toHaveBeenCalledWith(file);
    expect(deleteFile).toHaveBeenCalledWith(file);
    expect(popup).toHaveBeenCalledTimes(1);
  });

  it("only shows create actions for the markdown file tree root target", async () => {
    await showNativeMarkdownFileTreeContextMenu({
      createFile: vi.fn(),
      createFolder: vi.fn(),
      deleteFile: vi.fn(),
      renameFile: vi.fn()
    }, "en");

    const items = latestMenuItems();

    expect(items).toEqual([
      expect.objectContaining({ id: "markra:file-tree:new", text: "New file" }),
      expect.objectContaining({ id: "markra:file-tree:new-folder", text: "New Folder" })
    ]);
  });
});
