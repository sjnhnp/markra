import type { AiDiffTarget, AiDocumentAnchor } from "../inline";
import type { DocumentAgentToolContext } from "./context";
import {
  getMarkdownLines,
  looksLikeTableRow,
  looksLikeTableSeparator,
  sliceDocumentText,
  splitTableCells,
  summarizeAnchorTitle
} from "./text";

export function buildDocumentAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  const anchors: AiDocumentAnchor[] = [];

  anchors.push({
    description: "Whole current document",
    from: 0,
    id: "whole-document",
    kind: "document",
    text: context.documentContent,
    title: context.documentPath ?? "Current document",
    to: context.documentEndPosition
  });

  if (context.selection?.text.trim()) {
    anchors.push({
      description:
        context.selection.source === "selection"
          ? "Current selected text"
          : "Current text block under the cursor",
      from: context.selection.from,
      id: "current-context",
      kind: "current_block",
      text: context.selection.text,
      title: summarizeAnchorTitle(context.selection.text),
      to: context.selection.to
    });
  }

  anchors.push(...documentTableAnchors(context));

  (context.headingAnchors ?? []).forEach((heading, index) => {
    anchors.push({
      description: `Heading level ${heading.level}: ${heading.title}`,
      from: heading.from,
      id: `heading:${index}`,
      kind: "heading",
      text: heading.title,
      title: heading.title,
      to: heading.to
    });
  });

  anchors.push({
    description: "End of the current document",
    from: context.documentEndPosition,
    id: "document-end",
    kind: "document_end",
    to: context.documentEndPosition
  });

  return anchors;
}

export function documentTableAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  return context.tableAnchors ?? buildTableAnchors(context);
}

export function buildSectionAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  if (context.sectionAnchors) return context.sectionAnchors;

  const headings = [...(context.headingAnchors ?? [])].sort((left, right) => left.from - right.from);
  const anchors: AiDocumentAnchor[] = [];

  headings.forEach((heading, index) => {
    let sectionEnd = context.documentEndPosition;

    for (let nextIndex = index + 1; nextIndex < headings.length; nextIndex += 1) {
      const nextHeading = headings[nextIndex]!;
      if (nextHeading.level <= heading.level) {
        sectionEnd = nextHeading.from;
        break;
      }
    }

    anchors.push({
      description: `Section ${heading.title}`,
      from: heading.from,
      id: `section:${index}`,
      kind: "section",
      text: sliceDocumentText(context.documentContent, heading.from, sectionEnd),
      title: heading.title,
      to: sectionEnd
    });
  });

  return anchors;
}

export function diffTargetFromAnchor(anchor: AiDocumentAnchor): AiDiffTarget {
  return {
    from: anchor.from,
    id: anchor.id,
    kind: anchor.kind,
    title: anchor.title,
    to: anchor.to
  };
}

function buildTableAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  const lines = getMarkdownLines(context.documentContent);
  const anchors: AiDocumentAnchor[] = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = lines[index]!;
    const separatorLine = lines[index + 1]!;
    if (!looksLikeTableRow(headerLine.text) || !looksLikeTableSeparator(separatorLine.text)) continue;

    let endIndex = index + 2;
    while (endIndex < lines.length && looksLikeTableRow(lines[endIndex]!.text)) {
      endIndex += 1;
    }

    const lastLine = lines[endIndex - 1]!;
    const from = headerLine.from;
    const to = lastLine.to;
    const tableIndex = anchors.length;
    const title = tableAnchorTitle(context, from, headerLine.text);

    anchors.push({
      description: tableAnchorDescription(title, headerLine.text),
      from,
      id: `table:${tableIndex}`,
      kind: "table",
      text: sliceDocumentText(context.documentContent, from, to),
      title,
      to
    });
    index = endIndex - 1;
  }

  return anchors;
}

function tableAnchorTitle(context: DocumentAgentToolContext, tableFrom: number, headerLine: string) {
  const heading = [...(context.headingAnchors ?? [])]
    .filter((item) => item.from <= tableFrom)
    .sort((left, right) => right.from - left.from)[0];
  const headerTitle = splitTableCells(headerLine).slice(0, 3).join(" / ");

  return heading?.title ? `${heading.title} table` : `Table: ${headerTitle}`;
}

function tableAnchorDescription(title: string, headerLine: string) {
  const headerTitle = splitTableCells(headerLine).slice(0, 3).join(" / ");
  return headerTitle ? `Markdown table ${title}: ${headerTitle}` : `Markdown table ${title}`;
}
