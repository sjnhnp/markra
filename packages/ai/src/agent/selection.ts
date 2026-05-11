import type { AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "./inline";

const maxSelectionSourceChars = 4000;

export function findSelectedHeading(
  selection: AiSelectionContext | null,
  headingAnchors: AiHeadingAnchor[] | undefined
) {
  if (!selection?.text.trim()) return null;

  const selectedText = normalizeSelectionText(selection.text);
  if (!selectedText) return null;

  return (headingAnchors ?? []).find((heading) => {
    if (selection.from < heading.from || selection.to > heading.to) return false;

    const title = normalizeSelectionText(heading.title);
    const markdown = normalizeSelectionText(formatHeadingMarkdown(heading));
    return selectedText === title || selectedText === markdown;
  }) ?? null;
}

export function findSelectionSection(
  selection: AiSelectionContext | null,
  sectionAnchors: AiDocumentAnchor[] | undefined
) {
  if (!selection) return null;

  return (sectionAnchors ?? [])
    .filter((section) => section.kind === "section")
    .filter((section) => selection.from >= section.from && selection.to <= section.to)
    .sort((left, right) => (left.to - left.from) - (right.to - right.from))[0] ?? null;
}

export function formatSelectionSourceContext({
  documentContent,
  headingAnchors,
  sectionAnchors,
  selection
}: {
  documentContent: string;
  headingAnchors?: AiHeadingAnchor[];
  sectionAnchors?: AiDocumentAnchor[];
  selection: AiSelectionContext | null;
}) {
  const source = resolveSelectionSourceContext({
    documentContent,
    headingAnchors,
    sectionAnchors,
    selection
  });
  if (!source) return [];

  return formatMarkdownSourceContext(source, "Markdown source context:");
}

export function formatMarkdownSourceContext(
  source: { from: number; markdown: string; to: number },
  label: string
) {
  return [
    `Markdown source range: ${source.from}-${source.to}`,
    label,
    "```markdown",
    source.markdown,
    "```"
  ];
}

export function resolveMarkdownSourceContext({
  documentContent,
  fallbackText,
  from,
  to
}: {
  documentContent: string;
  fallbackText?: string;
  from?: number;
  to?: number;
}) {
  const sourceFromDocument = markdownSliceFromDocument(documentContent, from, to);
  if (sourceFromDocument) return sourceFromDocument;

  const markdown = fallbackText?.trim();
  if (!markdown) return null;

  return {
    from: from ?? 0,
    markdown: truncateSourceMarkdown(markdown),
    to: to ?? markdown.length
  };
}

function resolveSelectionSourceContext({
  documentContent,
  headingAnchors,
  sectionAnchors,
  selection
}: {
  documentContent: string;
  headingAnchors?: AiHeadingAnchor[];
  sectionAnchors?: AiDocumentAnchor[];
  selection: AiSelectionContext | null;
}) {
  if (!selection) return null;

  const selectedHeading = findSelectedHeading(selection, headingAnchors);
  const selectionSection = findSelectionSection(selection, sectionAnchors);
  const range = selectedHeading ?? selectionSection ?? selection;
  return resolveMarkdownSourceContext({
    documentContent,
    fallbackText: "text" in range ? range.text : undefined,
    from: range.from,
    to: range.to
  });
}

function markdownSliceFromDocument(documentContent: string, from: number | undefined, to: number | undefined) {
  const clampedFrom = clampSourcePosition(from, documentContent.length);
  const clampedTo = clampSourcePosition(to, documentContent.length);
  if (clampedFrom === null || clampedTo === null) return null;
  const fromPosition = Math.min(clampedFrom, clampedTo);
  const toPosition = Math.max(clampedFrom, clampedTo);
  if (fromPosition >= toPosition) return null;

  const markdown = documentContent.slice(fromPosition, toPosition).trim();
  if (!markdown) return null;

  return {
    from: fromPosition,
    markdown: truncateSourceMarkdown(markdown),
    to: toPosition
  };
}

function truncateSourceMarkdown(markdown: string) {
  if (markdown.length <= maxSelectionSourceChars) return markdown;

  return `${markdown.slice(0, maxSelectionSourceChars).trimEnd()}\n...`;
}

export function formatHeadingMarkdown(heading: AiHeadingAnchor) {
  const level = Math.min(6, Math.max(1, Math.trunc(heading.level || 1)));
  return `${"#".repeat(level)} ${heading.title}`;
}

function normalizeSelectionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampSourcePosition(value: number | undefined, docSize: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  return Math.min(docSize, Math.max(0, value));
}
