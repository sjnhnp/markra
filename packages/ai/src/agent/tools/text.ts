export type MarkdownLine = {
  from: number;
  text: string;
  to: number;
};

export function getMarkdownLines(content: string): MarkdownLine[] {
  const lines: MarkdownLine[] = [];
  let position = 0;

  while (position < content.length) {
    const nextBreak = content.indexOf("\n", position);
    const to = nextBreak === -1 ? content.length : nextBreak;
    lines.push({
      from: position,
      text: content.slice(position, to),
      to
    });
    position = nextBreak === -1 ? content.length : nextBreak + 1;
  }

  return lines;
}

export function looksLikeTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;

  const pipeCount = (trimmed.replace(/\\\|/gu, "").match(/\|/gu) ?? []).length;
  return pipeCount >= 2 || (trimmed.startsWith("|") && pipeCount >= 1);
}

export function looksLikeTableSeparator(line: string) {
  const cells = splitTableCells(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

export function splitTableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  return trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
}

export function looksLikeBlockMarkdown(markdown: string) {
  const trimmed = markdown.trimStart();

  return markdown.includes("\n") || /^(#{1,6}\s|>\s?|[-*+]\s+|\d+\.\s+|```|~~~|\|)/.test(trimmed);
}

export function isCompleteMarkdownTableBlock(markdown: string) {
  const lines = getMarkdownLines(markdown.trim())
    .map((line) => line.text)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return false;
  if (!looksLikeTableRow(lines[0]!) || !looksLikeTableSeparator(lines[1]!)) return false;

  return lines.slice(2).every((line) => looksLikeTableRow(line));
}

export function isCompleteMarkdownTableReplacement(markdown: string) {
  if (isCompleteMarkdownTableBlock(markdown)) return true;

  const unwrapped = unwrapMarkdownFence(markdown);
  return unwrapped !== markdown.trim() && isCompleteMarkdownTableBlock(unwrapped);
}

function unwrapMarkdownFence(markdown: string) {
  const trimmed = markdown.trim();
  const lines = trimmed.split("\n");
  const firstLine = lines[0]?.trim() ?? "";
  const lastLine = lines.at(-1)?.trim() ?? "";
  if (!/^```(?:markdown|md)?\s*$/iu.test(firstLine) || lastLine !== "```") return trimmed;

  return lines.slice(1, -1).join("\n").trim();
}

export function containsAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

export function overlapScore(left: string, right: string) {
  if (!left || !right) return 0;

  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  let score = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) score += 2;
  });

  return score;
}

function tokenize(value: string) {
  return new Set(
    value
      .split(/[\s/._-]+/u)
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/[`"'“”‘’#*()[\]{}:,.!?|]/gu, " ").replace(/\s+/gu, " ").trim();
}

export function summarizeAnchorTitle(text: string) {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

export function sliceDocumentText(content: string, from: number, to: number) {
  if (from >= to) return "";

  return content.slice(Math.max(0, from), Math.max(0, to));
}
