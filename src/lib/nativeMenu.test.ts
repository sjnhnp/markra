import { Menu } from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  installNativeEditorContextMenu,
  listenNativeApplicationMenuCommands,
  type NativeMenuHandlers
} from "./nativeMenu";

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
});
