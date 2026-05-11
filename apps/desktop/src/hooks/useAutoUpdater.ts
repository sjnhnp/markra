import { useCallback, useEffect, useRef } from "react";
import { t, type AppLanguage } from "@markra/shared";
import { showAppToast } from "../lib/app-toast";
import { checkNativeAppUpdate, type NativeAppUpdate, type NativeAppUpdateProgress } from "../lib/tauri/updater";

const appUpdateToastId = "app-update-toast";

export type AutoUpdaterOptions = {
  autoCheck?: boolean;
  confirmInstall?: () => boolean | Promise<boolean>;
};

function formatUpdateMessage(message: string, update: NativeAppUpdate, progress?: NativeAppUpdateProgress) {
  const progressText = progress?.progress === null || progress?.progress === undefined ? "" : String(progress.progress);

  return message
    .replace("{version}", update.version)
    .replace("{currentVersion}", update.currentVersion)
    .replace("{progress}", progressText);
}

export function useAutoUpdater(language: AppLanguage, enabled = true, options: AutoUpdaterOptions = {}) {
  const checkedRef = useRef(false);
  const checkingRef = useRef(false);
  const installingRef = useRef(false);
  const autoCheck = options.autoCheck ?? true;
  const confirmInstall = options.confirmInstall;

  const installUpdate = useCallback(async (update: NativeAppUpdate) => {
    if (installingRef.current) return;

    installingRef.current = true;
    try {
      const canInstall = await confirmInstall?.();
      if (canInstall === false) return;

      showAppToast({
        id: appUpdateToastId,
        message: formatUpdateMessage(t(language, "app.updateInstalling"), update),
        status: "loading"
      });
      await update.installAndRestart({
        onProgress: (progress) => {
          const key = progress.progress === null ? "app.updateDownloading" : "app.updateDownloadingProgress";
          showAppToast({
            id: appUpdateToastId,
            message: formatUpdateMessage(t(language, key), update, progress),
            status: "loading"
          });
        }
      });
      showAppToast({
        id: appUpdateToastId,
        message: t(language, "app.updateRestarting"),
        status: "success"
      });
    } catch {
      showAppToast({
        id: appUpdateToastId,
        message: t(language, "app.updateFailed"),
        status: "error"
      });
    } finally {
      installingRef.current = false;
    }
  }, [confirmInstall, language]);

  const showAvailableUpdate = useCallback((update: NativeAppUpdate) => {
    showAppToast({
      action: {
        label: t(language, "app.updateInstallAndRestart"),
        onClick: () => {
          installUpdate(update);
        }
      },
      id: appUpdateToastId,
      message: formatUpdateMessage(t(language, "app.updateAvailable"), update),
      status: "loading"
    });
  }, [installUpdate, language]);

  const checkForUpdates = useCallback(async () => {
    if (!enabled || checkingRef.current) return;

    checkingRef.current = true;
    showAppToast({
      id: appUpdateToastId,
      message: t(language, "app.updateChecking"),
      status: "loading"
    });

    try {
      const update = await checkNativeAppUpdate();
      if (update) {
        showAvailableUpdate(update);
        return;
      }

      showAppToast({
        id: appUpdateToastId,
        message: t(language, "app.updateCurrent"),
        status: "success"
      });
    } catch {
      showAppToast({
        id: appUpdateToastId,
        message: t(language, "app.updateFailed"),
        status: "error"
      });
    } finally {
      checkingRef.current = false;
    }
  }, [enabled, language, showAvailableUpdate]);

  useEffect(() => {
    if (!autoCheck || !enabled || checkedRef.current) return;

    checkedRef.current = true;
    let cancelled = false;

    async function checkForUpdatesOnStartup() {
      try {
        const update = await checkNativeAppUpdate();
        if (!cancelled && update) showAvailableUpdate(update);
      } catch {
        // Background update checks should not interrupt normal app startup.
      }
    }

    checkForUpdatesOnStartup();

    return () => {
      cancelled = true;
    };
  }, [autoCheck, enabled, showAvailableUpdate]);

  return {
    checkForUpdates
  };
}
