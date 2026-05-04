import { Moon, RotateCcw, Sun } from "lucide-react";
import { useCallback, useLayoutEffect, useState } from "react";
import { useAppTheme } from "../hooks/useAppTheme";
import { resetWelcomeDocumentState } from "../lib/appSettings";
import type { AppTheme } from "../lib/appSettings";

const themeOptions: Array<{
  icon: typeof Sun;
  label: string;
  value: AppTheme;
}> = [
  {
    icon: Sun,
    label: "Light",
    value: "light"
  },
  {
    icon: Moon,
    label: "Dark",
    value: "dark"
  }
];

export function SettingsWindow() {
  const appTheme = useAppTheme();
  const [welcomeReset, setWelcomeReset] = useState(false);

  useLayoutEffect(() => {
    document.title = "Settings";
    document.documentElement.dataset.window = "settings";

    return () => {
      delete document.documentElement.dataset.window;
    };
  }, []);

  const handleResetWelcomeDocument = useCallback(() => {
    void resetWelcomeDocumentState().then(() => {
      setWelcomeReset(true);
    }).catch(() => {});
  }, []);

  return (
    <main
      className="settings-window min-h-full bg-(--bg-primary) px-8 py-7 text-(--text-primary)"
      aria-label="Markra settings"
    >
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-7">
        <header className="border-b border-(--border-default) pb-4">
          <h1 className="m-0 text-[24px] leading-tight font-[680] tracking-[0] text-(--text-heading)">Settings</h1>
          <p className="mt-2 mb-0 text-[13px] leading-5 text-(--text-secondary)">
            Keep the editor quiet, local, and predictable.
          </p>
        </header>

        <section aria-labelledby="appearance-settings">
          <h2
            className="m-0 mb-3 text-[13px] leading-5 font-[650] tracking-[0] text-(--text-secondary)"
            id="appearance-settings"
          >
            Appearance
          </h2>

          <div className="flex items-center justify-between gap-6 border-y border-(--border-default) py-4">
            <div className="min-w-0">
              <p className="m-0 text-[15px] leading-6 font-[560] text-(--text-heading)">Color theme</p>
              <p className="m-0 text-[13px] leading-5 text-(--text-secondary)">Applies to every open window.</p>
            </div>

            <div
              className="grid shrink-0 grid-cols-2 rounded-[6px] border border-(--border-default) bg-(--bg-secondary) p-0.5"
              role="group"
              aria-label="Color theme"
            >
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const active = appTheme.theme === option.value;

                return (
                  <button
                    className="inline-flex h-8 min-w-20 items-center justify-center gap-1.5 rounded-[4px] border-0 bg-transparent px-3 text-[13px] text-(--text-secondary) hover:text-(--text-heading) aria-pressed:bg-(--bg-primary) aria-pressed:text-(--text-heading) aria-pressed:shadow-[0_1px_2px_color-mix(in_srgb,var(--text-heading)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                    type="button"
                    key={option.value}
                    aria-label={`Use ${option.value} theme`}
                    aria-pressed={active}
                    onClick={() => appTheme.selectTheme(option.value)}
                  >
                    <Icon aria-hidden="true" size={14} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="startup-settings">
          <h2
            className="m-0 mb-3 text-[13px] leading-5 font-[650] tracking-[0] text-(--text-secondary)"
            id="startup-settings"
          >
            Startup
          </h2>

          <div className="flex items-center justify-between gap-6 border-y border-(--border-default) py-4">
            <div className="min-w-0">
              <p className="m-0 text-[15px] leading-6 font-[560] text-(--text-heading)">Welcome document</p>
              <p className="m-0 text-[13px] leading-5 text-(--text-secondary)">Show the welcome document again.</p>
            </div>

            <button
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[5px] border border-(--border-default) bg-(--bg-secondary) px-3 text-[13px] text-(--text-heading) hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
              type="button"
              onClick={handleResetWelcomeDocument}
              aria-label="Show welcome next launch"
            >
              <RotateCcw aria-hidden="true" size={14} />
              Reset
            </button>
          </div>

          {welcomeReset ? (
            <p className="mt-2 mb-0 text-[13px] leading-5 text-(--accent)" role="status">
              Welcome document will show next launch.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
