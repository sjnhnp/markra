import { platform as tauriPlatform, type Platform as TauriPlatform } from "@tauri-apps/plugin-os";

export type DesktopPlatform = "macos" | "windows" | "linux";

function normalizeDesktopPlatform(platform: string | null | undefined): DesktopPlatform | null {
  if (platform === "windows" || platform === "macos" || platform === "linux") {
    return platform;
  }

  return null;
}

function resolveTauriDesktopPlatform(): DesktopPlatform | null {
  try {
    return normalizeDesktopPlatform(tauriPlatform() satisfies TauriPlatform);
  } catch {
    return null;
  }
}

function resolveBrowserDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") {
    return "macos";
  }

  const userAgentDataPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
    ?.platform;
  const platform = userAgentDataPlatform ?? navigator.platform;

  if (/win/i.test(platform)) {
    return "windows";
  }

  if (/linux/i.test(platform)) {
    return "linux";
  }

  return "macos";
}

export function resolveDesktopPlatform(): DesktopPlatform {
  return resolveTauriDesktopPlatform() ?? resolveBrowserDesktopPlatform();
}
