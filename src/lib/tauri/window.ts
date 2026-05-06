import { invoke } from "@tauri-apps/api/core";

export function openSettingsWindow() {
  return invoke("open_settings_window");
}

export async function setNativeWindowTitle(title: string) {
  window.document.title = title;

  if (!("__TAURI_INTERNALS__" in window)) {
    return;
  }

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().setTitle(title);
}
