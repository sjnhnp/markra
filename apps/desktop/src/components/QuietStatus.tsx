import { t, type AppLanguage } from "@markra/shared";

type QuietStatusProps = {
  dirty: boolean;
  editorMode: "source" | "visual";
  language?: AppLanguage;
  showWordCount?: boolean;
  wordCount: number;
};

export function QuietStatus({
  dirty,
  editorMode,
  language = "en",
  showWordCount = true,
  wordCount
}: QuietStatusProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);
  const modeLabel = editorMode === "source" ? label("app.sourceMode") : label("app.visualMode");

  return (
    <footer
      className="quiet-status pointer-events-none absolute right-4.5 bottom-3 flex justify-end gap-2.5 text-[12px] leading-5 font-medium text-(--text-secondary) opacity-[0.68]"
      aria-label={label("app.documentStatus")}
    >
      <span className="opacity-50">{modeLabel}</span>
      <span className="opacity-30">|</span>
      {showWordCount ? (
        <span>
          {wordCount} {label("app.words")}
        </span>
      ) : null}
      <span>{dirty ? label("app.unsaved") : label("app.saved")}</span>
    </footer>
  );
}
