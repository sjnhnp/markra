import { platform as tauriPlatform } from "@tauri-apps/plugin-os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDesktopPlatform } from "./platform";

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn()
}));

const originalNavigatorPlatform = navigator.platform;
const mockedTauriPlatform = vi.mocked(tauriPlatform);

function setNavigatorPlatform(platform: string) {
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: platform
  });
}

describe("resolveDesktopPlatform", () => {
  afterEach(() => {
    mockedTauriPlatform.mockReset();
    setNavigatorPlatform(originalNavigatorPlatform);
  });

  it("uses Tauri's compiled platform when available", () => {
    mockedTauriPlatform.mockReturnValue("windows");

    expect(resolveDesktopPlatform()).toBe("windows");
  });

  it("falls back to the browser platform when the Tauri OS plugin is unavailable", () => {
    mockedTauriPlatform.mockImplementation(() => {
      throw new Error("OS plugin unavailable");
    });
    setNavigatorPlatform("MacIntel");

    expect(resolveDesktopPlatform()).toBe("macos");
  });
});
