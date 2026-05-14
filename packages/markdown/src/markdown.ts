const countableWordUnits =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|(?:(?![\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])[\p{L}\p{N}_'-])+/gu;

export function getWordCount(text: string) {
  const words = text.trim().match(countableWordUnits);
  return words?.length ?? 0;
}

export type MarkdownOutlineItem = {
  level: number;
  title: string;
};

export function getMarkdownOutline(text: string): MarkdownOutlineItem[] {
  const outline: MarkdownOutlineItem[] = [];
  let fenced = false;

  text.split(/\r?\n/).forEach((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return;
    }

    if (fenced) return;

    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) return;

    outline.push({
      level: match[1].length,
      title: match[2].trim()
    });
  });

  return outline;
}
