import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AiDiffResult, AiDiffTarget, AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "../inlineAi";
import type { AgentWorkspaceFile } from "../agentTools";
import type { WebSearchResponse, WebSearchSettings } from "../../../web/webSearch";

export type DocumentAgentToolContext = {
  documentContent: string;
  documentEndPosition: number;
  documentPath: string | null;
  headingAnchors?: AiHeadingAnchor[];
  onPreviewResult?: (result: AiDiffResult) => unknown;
  readDocumentImage?: (src: string) => Promise<DocumentAgentImage | null>;
  readWorkspaceFile?: (path: string) => Promise<string>;
  sectionAnchors?: AiDocumentAnchor[];
  selection: AiSelectionContext | null;
  tableAnchors?: AiDocumentAnchor[];
  webSearch?: DocumentAgentWebSearch;
  workspaceFiles: AgentWorkspaceFile[];
};

export type DocumentAgentWebSearch = {
  runWebSearch?: (query: string, settings: WebSearchSettings) => Promise<WebSearchResponse>;
  settings: WebSearchSettings;
};

export type DocumentAgentImage = {
  alt?: string;
  dataUrl: string;
  mimeType: string;
  path?: string;
  src: string;
};

export type MarkdownImageReference = {
  alt: string;
  fileName: string;
  src: string;
};

const workspaceFileReadMaxChars = 24_000;

export type DocumentAnchorPlacement =
  | "after_anchor"
  | "after_selection"
  | "after_heading"
  | "before_anchor"
  | "before_selection"
  | "before_heading"
  | "cursor";

export type RegionOperation = "delete" | "insert" | "replace";
export type DocumentAgentToolState = {
  hasPreparedWrite: boolean;
};

function buildDocumentAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
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

type MarkdownLine = {
  from: number;
  text: string;
  to: number;
};

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

function documentTableAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  return context.tableAnchors ?? buildTableAnchors(context);
}

function buildSectionAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
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

function getMarkdownLines(content: string): MarkdownLine[] {
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

function looksLikeTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;

  const pipeCount = (trimmed.replace(/\\\|/gu, "").match(/\|/gu) ?? []).length;
  return pipeCount >= 2 || (trimmed.startsWith("|") && pipeCount >= 1);
}

function looksLikeTableSeparator(line: string) {
  const cells = splitTableCells(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

function splitTableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  return trimmed.split("|").map((cell) => cell.trim()).filter(Boolean);
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

function formatHeadingOutlineText(headingAnchors: AiHeadingAnchor[]) {
  if (!headingAnchors.length) return "No Markdown headings are available in the current document.";

  return headingAnchors
    .map((heading) => `${"#".repeat(Math.max(1, heading.level))} ${heading.title} (${heading.from}-${heading.to})`)
    .join("\n");
}

function formatSectionAnchorsText(sectionAnchors: AiDocumentAnchor[]) {
  if (!sectionAnchors.length) return "No Markdown sections are available in the current document.";

  return sectionAnchors
    .map((section) => `- ${section.id}: ${section.title ?? "(untitled)"} (${section.from}-${section.to})`)
    .join("\n");
}

function formatDocumentAnchorsText(anchors: AiDocumentAnchor[]) {
  return anchors
    .map((anchor) => `- ${anchor.id}: ${anchor.description} (${anchor.from}-${anchor.to})`)
    .join("\n");
}

function formatSelectionText(selection: AiSelectionContext | null) {
  if (!selection?.text.trim()) {
    return "No active selection or current block is available right now.";
  }

  return [
    `Range: ${selection.from}-${selection.to}`,
    `Cursor: ${selection.cursor ?? selection.to}`,
    `Source: ${selection.source ?? "selection"}`,
    "",
    selection.text
  ].join("\n");
}

function formatWorkspaceFilesText(workspaceFiles: AgentWorkspaceFile[], limit: number | undefined) {
  if (!workspaceFiles.length) return "No nearby Markdown files are available.";

  return workspaceFiles
    .slice(0, limit ?? 40)
    .map((file) => `- ${file.relativePath}`)
    .join("\n");
}

function formatWorkspaceFileContentText(file: AgentWorkspaceFile, content: string) {
  return [
    `Workspace file: ${file.relativePath}`,
    "",
    content.trim().length > 0 ? content : "(empty file)"
  ].join("\n");
}

function formatDocumentImageReferencesText(references: MarkdownImageReference[]) {
  if (!references.length) return "No local Markdown image references are available in the current document.";

  return [
    "Markdown image references:",
    ...references.map((reference, index) => [
      `${index + 1}. src: ${reference.src}`,
      `   file: ${reference.fileName || "(unknown)"}`,
      `   alt: ${reference.alt || "(empty)"}`
    ].join("\n"))
  ].join("\n");
}

function extractMarkdownImageReferences(markdown: string): MarkdownImageReference[] {
  const references: MarkdownImageReference[] = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/gu;
  let match: RegExpExecArray | null = imagePattern.exec(markdown);

  while (match) {
    const src = normalizeMarkdownImageSrc(match[2] ?? "");
    if (src) {
      references.push({
        alt: match[1] ?? "",
        fileName: fileNameFromImageReference(src),
        src
      });
    }
    match = imagePattern.exec(markdown);
  }

  return references;
}

function resolveMarkdownImageReference(references: MarkdownImageReference[], src: string) {
  const normalizedSrc = src.trim();

  return references.find((reference) => reference.src === normalizedSrc) ?? null;
}

function normalizeMarkdownImageSrc(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end > 0 ? trimmed.slice(1, end).trim() : "";
  }

  return trimmed.split(/\s+/u)[0] ?? "";
}

function fileNameFromImageReference(value: string) {
  const withoutQuery = value.split(/[?#]/u)[0] ?? "";
  const normalized = decodeImageReferenceText(withoutQuery).replace(/\\/gu, "/");
  const lastSeparator = normalized.lastIndexOf("/");

  return lastSeparator >= 0 ? normalized.slice(lastSeparator + 1) : normalized;
}

function decodeImageReferenceText(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function truncateWorkspaceFileContent(content: string) {
  if (content.length <= workspaceFileReadMaxChars) {
    return {
      text: content,
      truncated: false
    };
  }

  return {
    text: [
      content.slice(0, workspaceFileReadMaxChars),
      "",
      `[Truncated after ${workspaceFileReadMaxChars} characters.]`
    ].join("\n"),
    truncated: true
  };
}

function resolveWorkspaceFile(
  workspaceFiles: AgentWorkspaceFile[],
  args: ReturnType<typeof typedReadWorkspaceFileArgs>
) {
  const requestedRelativePath = args.relativePath?.trim();
  const requestedPath = args.path?.trim();

  if (!requestedRelativePath && !requestedPath) return null;

  return workspaceFiles.find((file) => {
    if (requestedRelativePath) return file.relativePath === requestedRelativePath;

    return file.path === requestedPath || file.relativePath === requestedPath;
  }) ?? null;
}

function previewPreparedResult(result: AiDiffResult, message: string) {
  return {
    content: [
      {
        text: [message, "The user still needs to confirm the change in the editor."].join(" "),
        type: "text" as const
      }
    ],
    details: result,
    terminate: true
  };
}

function beginPreparedWrite(
  context: DocumentAgentToolContext,
  hasPreparedWrite: boolean,
  mode: RegionOperation,
  options: {
    requireEditableContext?: boolean;
  } = {}
): { error: AgentToolResult<{ message: string }> } | { ok: true } {
  if (hasPreparedWrite) {
    return {
      error: toolErrorResult(
        "A pending editor change was already prepared in this turn. Explain that preview to the user instead of creating another one."
      )
    };
  }

  const requireEditableContext = options.requireEditableContext !== false;
  const hasStructuralAnchor =
    (context.headingAnchors ?? []).length > 0 ||
    buildSectionAnchors(context).length > 0 ||
    documentTableAnchors(context).length > 0;

  if (requireEditableContext && mode !== "insert" && !context.selection?.text.trim() && !hasStructuralAnchor) {
    return {
      error: toolErrorResult(
        `Cannot ${mode} because there is no active selection, current block, or structural anchor available. Inspect the document first and then resolve a region anchor.`
      )
    };
  }

  return { ok: true };
}

function resolveWriteRegion(
  context: DocumentAgentToolContext,
  anchorId: string | undefined,
  mode: RegionOperation
): { error: AgentToolResult<{ message: string }> } | { region: { from: number; original: string; target?: AiDiffTarget; to: number } } {
  if (!anchorId) {
    if (!context.selection?.text.trim()) {
      return {
        error: toolErrorResult(
          `Cannot ${mode} because there is no active selection or current block. Resolve a document anchor first.`
        )
      };
    }

    return {
      region: {
        from: context.selection.from,
        original: context.selection.text,
        to: context.selection.to
      }
    };
  }

  const anchor = buildDocumentAnchors(context).find((candidate) => candidate.id === anchorId);
  if (!anchor) {
    return {
      error: toolErrorResult(`Cannot ${mode} because the anchor "${anchorId}" was not found.`)
    };
  }

  if (anchor.kind === "document_end") {
    return {
      error: toolErrorResult(`Cannot ${mode} the document-end anchor. Resolve a concrete block or heading instead.`)
    };
  }

  return {
    region: {
      from: anchor.from,
      original: anchor.text ?? sliceDocumentText(context.documentContent, anchor.from, anchor.to),
      ...(anchor.kind === "table" ? { target: diffTargetFromAnchor(anchor) } : {}),
      to: anchor.to
    }
  };
}

function resolveBlockRegion(
  context: DocumentAgentToolContext,
  anchorId: string | undefined
): {
  anchorId: string;
  error: AgentToolResult<{ message: string }>;
} | {
  anchorId: string;
  region: { from: number; original: string; target: AiDiffTarget; to: number };
} {
  if (!anchorId) {
    if (!context.selection?.text.trim()) {
      return {
        anchorId: "current-context",
        error: toolErrorResult(
          "Cannot replace a block because there is no current editor block. Resolve a concrete block or heading anchor first."
        )
      };
    }

    if (context.selection.source !== "block") {
      return {
        anchorId: "current-context",
        error: toolErrorResult(
          "Cannot replace a block because the current editor context is an inline selection. Use replace_region for inline selection edits."
        )
      };
    }

    const target: AiDiffTarget = {
      from: context.selection.from,
      id: "current-context",
      kind: "current_block",
      title: summarizeAnchorTitle(context.selection.text),
      to: context.selection.to
    };

    return {
      anchorId: "current-context",
      region: {
        from: context.selection.from,
        original: context.selection.text,
        target,
        to: context.selection.to
      }
    };
  }

  const anchor = buildDocumentAnchors(context).find((candidate) => candidate.id === anchorId);
  if (!anchor) {
    return {
      anchorId,
      error: toolErrorResult(`Cannot replace a block because the anchor "${anchorId}" was not found.`)
    };
  }

  if (anchor.kind === "table") {
    return {
      anchorId,
      error: toolErrorResult("Cannot replace a table anchor with replace_block. Use replace_table with a table anchor.")
    };
  }

  if (anchor.kind === "section") {
    return {
      anchorId,
      error: toolErrorResult("Cannot replace a section anchor with replace_block. Use replace_section with a section anchor.")
    };
  }

  if (anchor.kind === "document") {
    return {
      anchorId,
      error: toolErrorResult("Cannot replace the whole-document anchor with replace_block. Use replace_document instead.")
    };
  }

  if (anchor.kind === "document_end") {
    return {
      anchorId,
      error: toolErrorResult("Cannot replace the document-end anchor with replace_block. Resolve a concrete block or heading instead.")
    };
  }

  return {
    anchorId,
    region: {
      from: anchor.from,
      original: anchor.text ?? sliceDocumentText(context.documentContent, anchor.from, anchor.to),
      target: diffTargetFromAnchor(anchor),
      to: anchor.to
    }
  };
}

function diffTargetFromAnchor(anchor: AiDocumentAnchor): AiDiffTarget {
  return {
    from: anchor.from,
    id: anchor.id,
    kind: anchor.kind,
    title: anchor.title,
    to: anchor.to
  };
}

function ensureReplacementFitsRegion(
  context: DocumentAgentToolContext,
  anchorId: string | undefined,
  replacement: string,
  region: { original: string }
): { error: AgentToolResult<{ message: string }> } | { ok: true } {
  const isInlineSelection = !anchorId && context.selection?.source !== "block";
  if (isInlineSelection && looksLikeBlockMarkdown(replacement) && !looksLikeBlockMarkdown(region.original)) {
    return {
      error: toolErrorResult(
        "Cannot replace an inline selection with block-level Markdown. Use plain text for the selected text, or resolve a block, section, or document anchor before replacing a table, list, heading, or multi-paragraph region."
      )
    };
  }

  if (isCompleteMarkdownTableReplacement(replacement)) {
    const anchor = anchorId
      ? buildDocumentAnchors(context).find((candidate) => candidate.id === anchorId)
      : null;
    if (anchor?.kind !== "table" || !isCompleteMarkdownTableBlock(region.original)) {
      return {
        error: toolErrorResult(
          "Cannot replace this region with a Markdown table because the target is not a complete table anchor. Use replace_table with a table anchor."
        )
      };
    }
  }

  return { ok: true };
}

function resolveTableAnchor(
  context: DocumentAgentToolContext,
  anchorId: string
): { error: AgentToolResult<{ message: string }> } | { anchor: AiDocumentAnchor } {
  const tableAnchor = documentTableAnchors(context).find((candidate) => candidate.id === anchorId);
  if (!tableAnchor) {
    return {
      error: toolErrorResult(`Cannot resolve table anchor "${anchorId}". Read available anchors or locate a table first and use a valid table anchor.`)
    };
  }

  return { anchor: tableAnchor };
}

function resolveTableByHeading(
  context: DocumentAgentToolContext,
  headingTitle: string
): { error: AgentToolResult<{ message: string }> } | { anchor: AiDocumentAnchor } {
  const normalizedHeadingTitle = normalizeText(headingTitle);
  if (!normalizedHeadingTitle) {
    return {
      error: toolErrorResult("Cannot resolve a table because the heading title is empty.")
    };
  }

  const tables = documentTableAnchors(context);
  if (!tables.length) {
    return {
      error: toolErrorResult("Cannot resolve a table because the current document has no Markdown table anchors.")
    };
  }

  const headings = [...(context.headingAnchors ?? [])].sort((left, right) => left.from - right.from);
  const headingIndex = headings.findIndex((heading) => {
    const normalizedTitle = normalizeText(heading.title);

    return normalizedTitle.length > 0 && (
      normalizedTitle === normalizedHeadingTitle ||
      normalizedTitle.includes(normalizedHeadingTitle) ||
      normalizedHeadingTitle.includes(normalizedTitle)
    );
  });

  if (headingIndex >= 0) {
    const heading = headings[headingIndex]!;
    const nextHeading = headings.slice(headingIndex + 1).find((candidate) => candidate.from > heading.from);
    const sectionEnd = nextHeading?.from ?? context.documentEndPosition;
    const table = tables.find((candidate) => candidate.from >= heading.to && candidate.from < sectionEnd);

    if (table) return { anchor: table };
  }

  const scoredTables = tables
    .map((anchor) => ({
      anchor,
      score: overlapScore(normalizedHeadingTitle, normalizeText(anchor.title ?? ""))
    }))
    .sort((left, right) => right.score - left.score);
  const best = scoredTables[0];
  if (best && best.score > 0) return { anchor: best.anchor };

  return {
    error: toolErrorResult(`Cannot resolve a table under heading "${headingTitle}". Read available anchors first or pass an exact table anchor.`)
  };
}

function resolveBlockByText(
  context: DocumentAgentToolContext,
  originalText: string
): {
  error: AgentToolResult<{ message: string }>;
} | {
  region: { from: number; original: string; target: AiDiffTarget; to: number };
} {
  if (!originalText) {
    return {
      error: toolErrorResult("Cannot replace a block by text because originalText is empty.")
    };
  }

  const from = context.documentContent.indexOf(originalText);
  if (from < 0) {
    return {
      error: toolErrorResult("Cannot replace a block by text because the original text was not found in the current document.")
    };
  }

  const duplicateFrom = context.documentContent.indexOf(originalText, from + originalText.length);
  if (duplicateFrom >= 0) {
    return {
      error: toolErrorResult("Cannot replace a block by text because the original text appears multiple times. Use a more specific text snippet or resolve an anchor.")
    };
  }

  const to = from + originalText.length;
  const target: AiDiffTarget = {
    from,
    id: "text-match",
    kind: "current_block",
    title: summarizeAnchorTitle(originalText),
    to
  };

  return {
    region: {
      from,
      original: originalText,
      target,
      to
    }
  };
}

function ensureCompleteTableReplacement(
  replacement: string
): { error: AgentToolResult<{ message: string }> } | { ok: true } {
  if (!isCompleteMarkdownTableBlock(replacement)) {
    return {
      error: toolErrorResult("Cannot replace a table with content that is not a complete Markdown table.")
    };
  }

  return { ok: true };
}

function resolveSectionAnchor(
  context: DocumentAgentToolContext,
  anchorId: string
): { error: AgentToolResult<{ message: string }> } | { anchor: AiDocumentAnchor } {
  const sectionAnchor = buildSectionAnchors(context).find((candidate) => candidate.id === anchorId);
  if (!sectionAnchor) {
    return {
      error: toolErrorResult(`Cannot resolve section anchor "${anchorId}". Read document sections first and use a valid section anchor.`)
    };
  }

  return { anchor: sectionAnchor };
}

function resolveInsertionPosition(
  context: DocumentAgentToolContext,
  args: ReturnType<typeof typedInsertMarkdownArgs>
): { error: AgentToolResult<{ message: string }> } | { position: number } {
  if (args.anchorId) {
    const anchor = buildDocumentAnchors(context).find((candidate) => candidate.id === args.anchorId);
    if (!anchor) {
      return {
        error: toolErrorResult(`Cannot insert because the anchor "${args.anchorId}" was not found.`)
      };
    }

    return {
      position: insertionPositionForAnchor(anchor, args.placement)
    };
  }

  if (context.selection) {
    return {
      position: insertionPositionForSelection(context.selection, args.placement)
    };
  }

  return {
    error: toolErrorResult(
      "Cannot insert because there is no active editor context. Call locate_markdown_region or get_available_anchors first and then insert via anchorId."
    )
  };
}

function locateMarkdownRegion(anchors: AiDocumentAnchor[], goal: string, operation: RegionOperation) {
  const normalizedGoal = normalizeText(goal);
  const scoredAnchors = anchors
    .map((anchor) => ({
      anchor,
      reason: anchorReason(anchor, normalizedGoal, operation),
      score: scoreAnchor(anchor, normalizedGoal, operation)
    }))
    .sort((left, right) => right.score - left.score);

  const best = scoredAnchors[0] ?? {
    anchor: {
      description: "End of the current document",
      from: 0,
      id: "document-end",
      kind: "document_end" as const,
      to: 0
    },
    reason: "Fallback to the end of the current document.",
    score: 0
  };

  return {
    anchorId: best.anchor.id,
    candidates: scoredAnchors.slice(0, 3).map((item) => ({
      anchorId: item.anchor.id,
      description: item.anchor.description,
      reason: item.reason,
      score: item.score
    })),
    operation,
    reason: best.reason
  };
}

function locateSection(sectionAnchors: AiDocumentAnchor[], args: ReturnType<typeof typedLocateSectionArgs>) {
  const normalizedHeadingTitle = normalizeText(args.headingTitle ?? "");
  const normalizedGoal = normalizeText(args.goal ?? args.headingTitle ?? "");
  const scoredSections = sectionAnchors
    .map((anchor) => {
      const normalizedTitle = normalizeText(anchor.title ?? "");
      let score = overlapScore(normalizedGoal, normalizedTitle);

      if (normalizedHeadingTitle && normalizedTitle === normalizedHeadingTitle) score += 20;
      if (normalizedHeadingTitle && normalizedTitle.includes(normalizedHeadingTitle)) score += 8;
      if (containsAny(normalizedGoal, ["section", "heading", "chapter", "小节", "章节", "标题"])) score += 2;

      return {
        anchor,
        reason:
          normalizedHeadingTitle && normalizedTitle === normalizedHeadingTitle
            ? `Exact heading match for "${anchor.title ?? ""}".`
            : `Best semantic section match for "${args.goal ?? args.headingTitle ?? ""}".`,
        score
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = scoredSections[0];
  if (!best) {
    return {
      anchorId: null,
      candidates: [],
      reason: "No section anchor is available in the current document."
    };
  }

  return {
    anchorId: best.anchor.id,
    candidates: scoredSections.slice(0, 3).map((candidate) => ({
      anchorId: candidate.anchor.id,
      description: candidate.anchor.description,
      reason: candidate.reason,
      score: candidate.score
    })),
    reason: best.reason
  };
}

function formatLocatedSectionText(located: ReturnType<typeof locateSection>) {
  return [
    `Recommended section: ${located.anchorId ?? "none"}`,
    `Reason: ${located.reason}`,
    "",
    "Top candidates:",
    ...located.candidates.map((candidate) => `- ${candidate.anchorId}: ${candidate.description} (${candidate.reason})`)
  ].join("\n");
}

function formatLocatedRegionText(located: ReturnType<typeof locateMarkdownRegion>) {
  return [
    `Recommended anchor: ${located.anchorId}`,
    `Reason: ${located.reason}`,
    "",
    "Top candidates:",
    ...located.candidates.map((candidate) => `- ${candidate.anchorId}: ${candidate.description} (${candidate.reason})`)
  ].join("\n");
}

function typedListWorkspaceFilesArgs(params: unknown) {
  return params as { limit?: number };
}

function typedReadWorkspaceFileArgs(params: unknown) {
  const args = params as { path?: string; relativePath?: string };

  return {
    path: args.path?.trim() || undefined,
    relativePath: args.relativePath?.trim() || undefined
  };
}

function typedViewDocumentImageArgs(params: unknown) {
  const args = params as { src: string };

  return {
    src: args.src.trim()
  };
}

function typedWebSearchArgs(params: unknown) {
  const args = params as { query: string };

  return {
    query: args.query.trim()
  };
}

function typedReplaceDocumentArgs(params: unknown) {
  return params as { replacement: string };
}

function typedReplaceRegionArgs(params: unknown) {
  return params as { anchorId?: string; replacement: string };
}

function typedReplaceBlockArgs(params: unknown) {
  const args = params as { anchorId?: string; replacement: string };

  return {
    anchorId: args.anchorId?.trim() || undefined,
    replacement: args.replacement
  };
}

function typedReplaceTableArgs(params: unknown) {
  return params as { anchorId: string; replacement: string };
}

function typedReplaceTableByHeadingArgs(params: unknown) {
  const args = params as { headingTitle: string; replacement: string };

  return {
    headingTitle: args.headingTitle.trim(),
    replacement: args.replacement
  };
}

function typedReplaceBlockByTextArgs(params: unknown) {
  const args = params as { originalText: string; replacement: string };

  return {
    originalText: args.originalText.trim(),
    replacement: args.replacement
  };
}

function typedDeleteRegionArgs(params: unknown) {
  return params as { anchorId?: string };
}

function typedLocateMarkdownRegionArgs(params: unknown) {
  const args = params as { goal: string; operation?: string };
  const operation = ["delete", "insert", "replace"].includes(args.operation ?? "")
    ? (args.operation as RegionOperation)
    : "insert";

  return {
    goal: args.goal,
    operation
  };
}

function typedLocateSectionArgs(params: unknown) {
  const args = params as { goal?: string; headingTitle?: string };

  return {
    goal: args.goal?.trim() || undefined,
    headingTitle: args.headingTitle?.trim() || undefined
  };
}

function typedReplaceSectionArgs(params: unknown) {
  return params as { anchorId: string; replacement: string };
}

function typedDeleteSectionArgs(params: unknown) {
  return params as { anchorId: string };
}

function typedInsertMarkdownArgs(params: unknown) {
  const args = params as { anchorId?: string; content: string; placement?: string };
  const placement = [
    "after_anchor",
    "after_selection",
    "after_heading",
    "before_anchor",
    "before_selection",
    "before_heading",
    "cursor"
  ].includes(args.placement ?? "")
    ? (args.placement as DocumentAnchorPlacement)
    : "cursor";

  return {
    anchorId: args.anchorId?.trim() || undefined,
    content: args.content,
    placement
  };
}

function insertionPositionForSelection(
  selection: AiSelectionContext,
  placement: DocumentAnchorPlacement
) {
  if (placement === "before_selection" || placement === "before_anchor" || placement === "before_heading") {
    return selection.from;
  }

  if (placement === "after_selection" || placement === "after_anchor" || placement === "after_heading") {
    return selection.to;
  }

  return selection.cursor ?? selection.to;
}

function insertionPositionForAnchor(anchor: AiDocumentAnchor, placement: DocumentAnchorPlacement) {
  if (anchor.kind === "document") {
    if (placement === "before_anchor" || placement === "before_heading" || placement === "before_selection") return anchor.from;

    return anchor.to;
  }
  if (anchor.kind === "document_end") return anchor.to;
  if (placement === "before_anchor" || placement === "before_heading" || placement === "before_selection") return anchor.from;
  if (placement === "cursor") return anchor.to;

  return anchor.to;
}

function looksLikeBlockMarkdown(markdown: string) {
  const trimmed = markdown.trimStart();

  return markdown.includes("\n") || /^(#{1,6}\s|>\s?|[-*+]\s+|\d+\.\s+|```|~~~|\|)/.test(trimmed);
}

function isCompleteMarkdownTableBlock(markdown: string) {
  const lines = getMarkdownLines(markdown.trim())
    .map((line) => line.text)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return false;
  if (!looksLikeTableRow(lines[0]!) || !looksLikeTableSeparator(lines[1]!)) return false;

  return lines.slice(2).every((line) => looksLikeTableRow(line));
}

function isCompleteMarkdownTableReplacement(markdown: string) {
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

function scoreAnchor(anchor: AiDocumentAnchor, normalizedGoal: string, operation: RegionOperation) {
  let score = 0;

  if (anchor.kind === "document") {
    if (
      operation !== "insert" &&
      containsAny(normalizedGoal, [
        "all content",
        "clean up",
        "compress",
        "entire document",
        "full document",
        "keep only",
        "only keep",
        "rewrite document",
        "whole document",
        "全文",
        "只保留",
        "整个文档",
        "整篇",
        "清理",
        "压缩"
      ])
    ) {
      score += 18;
    }
  }

  if (anchor.kind === "current_block") {
    if (containsAny(normalizedGoal, ["current", "current block", "current section", "here", "selected", "this block", "this section", "这里", "当前", "此处", "本段", "选中"])) score += 10;
    if (operation !== "insert") score += 2;
  }

  if (anchor.kind === "table") {
    const normalizedTitle = normalizeText(anchor.title ?? "");
    const normalizedTable = normalizeText(anchor.text ?? "");
    if (operation !== "insert" && containsAny(normalizedGoal, ["table", "matrix", "grid", "表格", "表"])) score += 22;
    if (normalizedGoal.includes(normalizedTitle) && normalizedTitle) score += 10;
    score += overlapScore(normalizedGoal, normalizedTitle) * 2;
    score += Math.min(12, overlapScore(normalizedGoal, normalizedTable));
    if (operation !== "insert") score += 4;
  }

  if (anchor.kind === "document_end") {
    if (containsAny(normalizedGoal, ["append", "at the end", "document end", "end of document", "final section", "末尾", "文末", "最后", "结尾", "追加"])) score += 12;
    else score += 1;
  }

  if (anchor.kind === "heading") {
    const normalizedTitle = normalizeText(anchor.title ?? "");
    if (normalizedGoal.includes(normalizedTitle) && normalizedTitle) score += 14;
    if (normalizedTitle.includes(normalizedGoal) && normalizedGoal) score += 8;
    score += overlapScore(normalizedGoal, normalizedTitle);
    if (containsAny(normalizedGoal, ["section", "heading", "chapter", "标题", "章节", "小节"])) score += 2;
  }

  return score;
}

function anchorReason(anchor: AiDocumentAnchor, normalizedGoal: string, operation: RegionOperation) {
  if (anchor.kind === "document" && scoreAnchor(anchor, normalizedGoal, operation) >= 10) {
    return "The request points to a whole-document edit.";
  }
  if (anchor.kind === "current_block" && scoreAnchor(anchor, normalizedGoal, operation) >= 10) {
    return "The request points to the current editing context.";
  }
  if (anchor.kind === "heading" && scoreAnchor(anchor, normalizedGoal, operation) >= 10) {
    return `The request best matches the heading "${anchor.title ?? ""}".`;
  }
  if (anchor.kind === "table" && scoreAnchor(anchor, normalizedGoal, operation) >= 10) {
    return `The request best matches the Markdown table "${anchor.title ?? ""}".`;
  }
  if (anchor.kind === "document_end") {
    return "The request looks like an append-at-the-end operation.";
  }

  return `This anchor is available as a fallback ${anchor.kind.replace("_", " ")} location.`;
}

function containsAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function overlapScore(left: string, right: string) {
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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[`"'“”‘’#*()[\]{}:,.!?|]/gu, " ").replace(/\s+/gu, " ").trim();
}

function summarizeAnchorTitle(text: string) {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

function sliceDocumentText(content: string, from: number, to: number) {
  if (from >= to) return "";

  return content.slice(Math.max(0, from), Math.max(0, to));
}

function toolErrorResult(message: string): never {
  throw new Error(message);
}

export {
  beginPreparedWrite,
  buildDocumentAnchors,
  buildSectionAnchors,
  diffTargetFromAnchor,
  documentTableAnchors,
  ensureCompleteTableReplacement,
  ensureReplacementFitsRegion,
  extractMarkdownImageReferences,
  formatDocumentAnchorsText,
  formatDocumentImageReferencesText,
  formatHeadingOutlineText,
  formatLocatedRegionText,
  formatLocatedSectionText,
  formatSelectionText,
  formatSectionAnchorsText,
  formatWorkspaceFileContentText,
  formatWorkspaceFilesText,
  locateMarkdownRegion,
  locateSection,
  previewPreparedResult,
  resolveBlockByText,
  resolveBlockRegion,
  resolveInsertionPosition,
  resolveMarkdownImageReference,
  resolveSectionAnchor,
  resolveTableAnchor,
  resolveTableByHeading,
  resolveWorkspaceFile,
  resolveWriteRegion,
  sliceDocumentText,
  toolErrorResult,
  truncateWorkspaceFileContent,
  typedDeleteRegionArgs,
  typedDeleteSectionArgs,
  typedInsertMarkdownArgs,
  typedListWorkspaceFilesArgs,
  typedLocateMarkdownRegionArgs,
  typedLocateSectionArgs,
  typedReadWorkspaceFileArgs,
  typedReplaceBlockArgs,
  typedReplaceBlockByTextArgs,
  typedReplaceDocumentArgs,
  typedReplaceRegionArgs,
  typedReplaceSectionArgs,
  typedReplaceTableArgs,
  typedReplaceTableByHeadingArgs,
  typedViewDocumentImageArgs,
  typedWebSearchArgs
};
