import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  closeNativeWindow,
  minimizeNativeWindow,
  toggleNativeWindowMaximized
} from "./window";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn()
}));

const mockedGetCurrentWindow = vi.mocked(getCurrentWindow);

describe("native window actions", () => {
  beforeEach(() => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {}
    });
    mockedGetCurrentWindow.mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("closes the current Tauri window", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    mockedGetCurrentWindow.mockReturnValue({ close } as unknown as ReturnType<typeof getCurrentWindow>);

    await closeNativeWindow();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it("minimizes the current Tauri window", async () => {
    const minimize = vi.fn().mockResolvedValue(undefined);
    mockedGetCurrentWindow.mockReturnValue({ minimize } as unknown as ReturnType<typeof getCurrentWindow>);

    await minimizeNativeWindow();

    expect(minimize).toHaveBeenCalledTimes(1);
  });

  it("toggles the current Tauri window maximized state", async () => {
    const toggleMaximize = vi.fn().mockResolvedValue(undefined);
    mockedGetCurrentWindow.mockReturnValue({ toggleMaximize } as unknown as ReturnType<typeof getCurrentWindow>);

    await toggleNativeWindowMaximized();

    expect(toggleMaximize).toHaveBeenCalledTimes(1);
  });

  it("skips native calls outside Tauri", async () => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");

    await closeNativeWindow();
    await minimizeNativeWindow();
    await toggleNativeWindowMaximized();

    expect(mockedGetCurrentWindow).not.toHaveBeenCalled();
  });
});
