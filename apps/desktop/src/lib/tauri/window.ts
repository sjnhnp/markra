import { invoke } from "@tauri-apps/api/core";

export function openSettingsWindow() {
  return invoke("open_settings_window");
}

export function openNativeExternalUrl(url: string) {
  if (!("__TAURI_INTERNALS__" in window)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }

  return invoke("open_external_url", { url });
}

export async function setNativeWindowTitle(title: string) {
  window.document.title = title;

  if (!("__TAURI_INTERNALS__" in window)) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}

async function getCurrentNativeWindow() {
  if (!("__TAURI_INTERNALS__" in window)) {
    return null;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export async function closeNativeWindow() {
  const currentWindow = await getCurrentNativeWindow();
  await currentWindow?.close();
}

export async function minimizeNativeWindow() {
  const currentWindow = await getCurrentNativeWindow();
  await currentWindow?.minimize();
}

export async function toggleNativeWindowMaximized() {
  const currentWindow = await getCurrentNativeWindow();
  await currentWindow?.toggleMaximize();
}
