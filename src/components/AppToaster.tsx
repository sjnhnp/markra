import { type CSSProperties } from "react";
import { Toaster } from "sonner";
import { t, type AppLanguage } from "../lib/i18n";

export function AppToaster({ language }: { language: AppLanguage }) {
  return (
    <Toaster
      position="top-center"
      visibleToasts={1}
      offset={64}
      className="app-toaster"
      style={{ "--width": "fit-content", position: "fixed", width: "fit-content" } as CSSProperties}
      containerAriaLabel={t(language, "app.notifications")}
      toastOptions={{
        closeButton: true,
        closeButtonAriaLabel: t(language, "app.closeToast"),
        unstyled: true,
        className:
          "app-toast app-toast-centered relative flex min-h-10 w-fit min-w-40 max-w-[calc(100vw-3rem)] items-center gap-2.5 rounded-md border border-(--border-default) bg-(--bg-primary) py-2 pr-9 pl-3 text-[12px] leading-5 font-[650] text-(--text-heading) shadow-[0_14px_34px_rgba(15,23,42,0.14)] sm:max-w-80",
        classNames: {
          content: "min-w-0 flex-1",
          icon: "shrink-0",
          title: "truncate",
          closeButton:
            "app-toast-close absolute top-1/2 right-2 inline-flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-(--border-default) bg-(--bg-secondary) text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        }
      }}
    />
  );
}
