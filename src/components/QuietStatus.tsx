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
      className="quiet-status fixed right-4.5 bottom-3 flex gap-2.5 text-[12px] text-(--text-secondary) opacity-0 transition-opacity duration-150 ease-out group-hover/app:opacity-[0.68] focus-within:opacity-[0.68]"
      aria-label={label("app.documentStatus")}
    >
      <span>
        {wordCount} {label("app.words")}
      </span>
      <span>{dirty ? label("app.unsaved") : label("app.saved")}</span>
    </footer>
  );
}
