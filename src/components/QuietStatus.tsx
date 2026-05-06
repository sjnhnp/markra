import { t, type AppLanguage } from "../lib/i18n";

type QuietStatusProps = {
  dirty: boolean;
  language?: AppLanguage;
  wordCount: number;
};

export function QuietStatus({ dirty, language = "en", wordCount }: QuietStatusProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);

  return (
    <footer
      className="quiet-status pointer-events-none absolute right-4.5 bottom-3 flex justify-end gap-2.5 text-[12px] leading-5 text-(--text-secondary) opacity-[0.68]"
      aria-label={label("app.documentStatus")}
    >
      <span>
        {wordCount} {label("app.words")}
      </span>
      <span>{dirty ? label("app.unsaved") : label("app.saved")}</span>
    </footer>
  );
}
