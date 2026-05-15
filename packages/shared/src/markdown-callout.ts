export type MarkdownCalloutType = "note" | "tip" | "important" | "warning" | "caution";

export type MarkdownCalloutDefinition = {
  label: string;
  marker: string;
  type: MarkdownCalloutType;
};

export type ParsedMarkdownCalloutMarker = MarkdownCalloutDefinition & {
  source: string;
};

export const markdownCalloutDefinitions: Record<MarkdownCalloutType, MarkdownCalloutDefinition> = {
  caution: {
    label: "Caution",
    marker: "CAUTION",
    type: "caution"
  },
  important: {
    label: "Important",
    marker: "IMPORTANT",
    type: "important"
  },
  note: {
    label: "Note",
    marker: "NOTE",
    type: "note"
  },
  tip: {
    label: "Tip",
    marker: "TIP",
    type: "tip"
  },
  warning: {
    label: "Warning",
    marker: "WARNING",
    type: "warning"
  }
};

const markdownCalloutMarkerPattern = /^\s*(\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])/iu;

export function parseMarkdownCalloutMarker(text: string): ParsedMarkdownCalloutMarker | null {
  const match = markdownCalloutMarkerPattern.exec(text);
  const source = match?.[1];
  const marker = match?.[2]?.toUpperCase();
  if (!source || !marker) return null;

  const definition = Object.values(markdownCalloutDefinitions).find((candidate) => candidate.marker === marker);
  if (!definition) return null;

  return {
    ...definition,
    source
  };
}

export function markdownCalloutMarkerForType(type: MarkdownCalloutType) {
  return `[!${markdownCalloutDefinitions[type].marker}]`;
}

export function restoreEscapedMarkdownCalloutMarkers(markdown: string) {
  return markdown.replace(
    /(^|\n)((?:>\s*)+)\\(\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])/giu,
    "$1$2$3"
  ).replace(/(^|\n)((?:>\s*)+)<br \/>(?=\n|$)/gu, "$1$2");
}
