import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { showAppToast } from "../lib/app-toast";
import { checkNativeAppUpdate, type NativeAppUpdate } from "../lib/tauri/updater";
import { useAutoUpdater } from "./useAutoUpdater";

vi.mock("../lib/app-toast", () => ({
  showAppToast: vi.fn()
}));

vi.mock("../lib/tauri/updater", () => ({
  checkNativeAppUpdate: vi.fn()
}));

const mockedShowAppToast = vi.mocked(showAppToast);
const mockedCheckNativeAppUpdate = vi.mocked(checkNativeAppUpdate);

function AutoUpdaterHarness({
  autoCheck,
  confirmInstall,
  language = "en"
}: {
  autoCheck?: boolean;
  confirmInstall?: () => Promise<boolean>;
  language?: "en" | "zh-CN";
}) {
  const updater = useAutoUpdater(language, true, { autoCheck, confirmInstall });

  return (
    <button type="button" onClick={updater.checkForUpdates}>
      Manual check
    </button>
  );
}

function DisabledUpdaterHarness() {
  const updater = useAutoUpdater("en", false, { autoCheck: false });

  return (
    <button type="button" onClick={updater.checkForUpdates}>
      Manual check
    </button>
  );
}

function createUpdate(overrides: Partial<NativeAppUpdate> = {}): NativeAppUpdate {
  return {
    body: "Release notes",
    currentVersion: "0.0.6",
    date: "2026-05-11T00:00:00Z",
    installAndRestart: vi.fn(),
    version: "0.0.7",
    ...overrides
  };
}

describe("useAutoUpdater", () => {
  beforeEach(() => {
    mockedShowAppToast.mockReset();
    mockedCheckNativeAppUpdate.mockReset();
  });

  it("checks for updates once on startup and stays quiet when none are available", async () => {
    mockedCheckNativeAppUpdate.mockResolvedValue(null);

    render(<AutoUpdaterHarness />);

    await waitFor(() => expect(mockedCheckNativeAppUpdate).toHaveBeenCalledTimes(1));
    expect(mockedShowAppToast).not.toHaveBeenCalled();
  });

  it("shows an install action for an available update and reports install progress", async () => {
    const confirmInstall = vi.fn(async () => true);
    const installAndRestart = vi.fn(async ({ onProgress }: Parameters<NativeAppUpdate["installAndRestart"]>[0] = {}) => {
      onProgress?.({ contentLength: 100, downloaded: 50, progress: 50 });
      onProgress?.({ contentLength: 100, downloaded: 100, progress: 100 });
    });
    mockedCheckNativeAppUpdate.mockResolvedValue(createUpdate({ installAndRestart }));

    render(<AutoUpdaterHarness confirmInstall={confirmInstall} />);

    await waitFor(() =>
      expect(mockedShowAppToast).toHaveBeenCalledWith({
        action: expect.objectContaining({
          label: "Install and restart"
        }),
        id: "app-update-toast",
        message: "Markra 0.0.7 is available.",
        status: "loading"
      })
    );

    const action = mockedShowAppToast.mock.calls[0]?.[0].action;
    action?.onClick();

    await waitFor(() => expect(confirmInstall).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(installAndRestart).toHaveBeenCalledTimes(1));
    expect(mockedShowAppToast).toHaveBeenCalledWith({
      id: "app-update-toast",
      message: "Downloading Markra 0.0.7 (50%).",
      status: "loading"
    });
    expect(mockedShowAppToast).toHaveBeenLastCalledWith({
      id: "app-update-toast",
      message: "Update installed. Restarting Markra...",
      status: "success"
    });
  });

  it("does not install when restart confirmation is declined", async () => {
    const confirmInstall = vi.fn(async () => false);
    const installAndRestart = vi.fn();
    mockedCheckNativeAppUpdate.mockResolvedValue(createUpdate({ installAndRestart }));

    render(<AutoUpdaterHarness confirmInstall={confirmInstall} />);

    await waitFor(() => expect(mockedShowAppToast).toHaveBeenCalledTimes(1));

    const action = mockedShowAppToast.mock.calls[0]?.[0].action;
    action?.onClick();

    await waitFor(() => expect(confirmInstall).toHaveBeenCalledTimes(1));
    expect(installAndRestart).not.toHaveBeenCalled();
  });

  it("keeps background check failures quiet during startup", async () => {
    mockedCheckNativeAppUpdate.mockRejectedValue(new Error("offline"));

    render(<AutoUpdaterHarness />);

    await waitFor(() => expect(mockedCheckNativeAppUpdate).toHaveBeenCalledTimes(1));
    expect(mockedShowAppToast).not.toHaveBeenCalled();
  });

  it("lets the UI manually check for updates and reports when Markra is current", async () => {
    mockedCheckNativeAppUpdate.mockResolvedValue(null);

    render(<AutoUpdaterHarness autoCheck={false} />);

    expect(mockedCheckNativeAppUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Manual check" }));

    await waitFor(() => expect(mockedCheckNativeAppUpdate).toHaveBeenCalledTimes(1));
    expect(mockedShowAppToast).toHaveBeenCalledWith({
      id: "app-update-toast",
      message: "Checking for Markra updates...",
      status: "loading"
    });
    expect(mockedShowAppToast).toHaveBeenLastCalledWith({
      id: "app-update-toast",
      message: "Markra is up to date.",
      status: "success"
    });
  });

  it("does not manually check while updater actions are disabled", () => {
    render(<DisabledUpdaterHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Manual check" }));

    expect(mockedCheckNativeAppUpdate).not.toHaveBeenCalled();
    expect(mockedShowAppToast).not.toHaveBeenCalled();
  });

  it("surfaces install failures after the user starts the update", async () => {
    const installAndRestart = vi.fn(async () => {
      throw new Error("download failed");
    });
    mockedCheckNativeAppUpdate.mockResolvedValue(createUpdate({ installAndRestart }));

    render(<AutoUpdaterHarness />);

    await waitFor(() => expect(mockedShowAppToast).toHaveBeenCalledTimes(1));

    const action = mockedShowAppToast.mock.calls[0]?.[0].action;
    action?.onClick();

    await waitFor(() =>
      expect(mockedShowAppToast).toHaveBeenLastCalledWith({
        id: "app-update-toast",
        message: "Markra update failed.",
        status: "error"
      })
    );
  });
});
