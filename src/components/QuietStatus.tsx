type QuietStatusProps = {
  dirty: boolean;
  wordCount: number;
};

export function QuietStatus({ dirty, wordCount }: QuietStatusProps) {
  return (
    <footer
      className="quiet-status fixed right-4.5 bottom-3 flex gap-2.5 text-[12px] text-(--text-secondary) opacity-0 transition-opacity duration-150 ease-out group-hover/app:opacity-[0.68] focus-within:opacity-[0.68]"
      aria-label="Document status"
    >
      <span>{wordCount} words</span>
      <span>{dirty ? "unsaved" : "saved"}</span>
    </footer>
  );
}
