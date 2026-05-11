import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type NativeAppUpdateProgress = {
  contentLength: number | null;
  downloaded: number;
  progress: number | null;
};

export type NativeAppUpdate = {
  body?: string;
  currentVersion: string;
  date?: string;
  installAndRestart: (callbacks?: { onProgress?: (progress: NativeAppUpdateProgress) => unknown }) => Promise<void>;
  version: string;
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function resolveProgress(downloaded: number, contentLength: number | null) {
  if (!contentLength || contentLength <= 0) return null;

  return Math.min(100, Math.round((downloaded / contentLength) * 100));
}

function emitProgress({
  contentLength,
  downloaded,
  onProgress
}: {
  contentLength: number | null;
  downloaded: number;
  onProgress?: (progress: NativeAppUpdateProgress) => unknown;
}) {
  onProgress?.({
    contentLength,
    downloaded,
    progress: resolveProgress(downloaded, contentLength)
  });
}

export async function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
  if (!isTauriRuntime()) return null;

  const update = await check();
  if (!update) return null;

  return {
    body: update.body,
    currentVersion: update.currentVersion,
    date: update.date,
    async installAndRestart(callbacks = {}) {
      let contentLength: number | null = null;
      let downloaded = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? null;
          downloaded = 0;
          emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
          return;
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
          return;
        }

        if (event.event === "Finished") {
          if (contentLength !== null) downloaded = contentLength;
          emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
        }
      });
      await relaunch();
    },
    version: update.version
  };
}
