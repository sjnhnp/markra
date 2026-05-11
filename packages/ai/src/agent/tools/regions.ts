import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { AiDiffTarget, AiDocumentAnchor, AiSelectionContext } from "../inline";
import {
  buildDocumentAnchors,
  buildSectionAnchors,
  currentContextAnchor,
  diffTargetFromAnchor,
  documentTableAnchors
} from "./anchors";
import type { DocumentAgentToolContext, DocumentAnchorPlacement, RegionOperation } from "./context";
import type { InsertMarkdownArgs } from "./params";
import { toolErrorResult } from "./results";
import {
  isCompleteMarkdownTableBlock,
  isCompleteMarkdownTableReplacement,
  looksLikeBlockMarkdown,
  normalizeText,
  overlapScore,
  sliceDocumentText,
  summarizeAnchorTitle
} from "./text";

export function beginPreparedWrite(
  context: DocumentAgentToolContext,
  mode: RegionOperation,
  options: {
    requireEditableContext?: boolean;
  } = {}
): { error: AgentToolResult<{ message: string }> } | { ok: true } {
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

export function resolveWriteRegion(
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

export function resolveBlockRegion(
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

    const selectedBlock = resolveSelectedBlockRegion(context);
    if (selectedBlock) return selectedBlock;

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

export function resolveSelectedBlockRegion(context: DocumentAgentToolContext): {
  anchorId: string;
  region: { from: number; original: string; target: AiDiffTarget; to: number };
} | null {
  const selection = context.selection;
  if (!selection?.text.trim()) return null;

  const selectedBlock = currentContextAnchor(context);
  if (!selectedBlock || (selectedBlock.from === selection.from && selectedBlock.to === selection.to)) return null;

  return {
    anchorId: selectedBlock.id,
    region: {
      from: selectedBlock.from,
      original: selectedBlock.text ?? sliceDocumentText(context.documentContent, selectedBlock.from, selectedBlock.to),
      target: diffTargetFromAnchor(selectedBlock),
      to: selectedBlock.to
    }
  };
}

export function ensureReplacementFitsRegion(
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

export function resolveTableAnchor(
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

export function resolveTableByHeading(
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

export function resolveBlockByText(
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

export function ensureCompleteTableReplacement(
  replacement: string
): { error: AgentToolResult<{ message: string }> } | { ok: true } {
  if (!isCompleteMarkdownTableBlock(replacement)) {
    return {
      error: toolErrorResult("Cannot replace a table with content that is not a complete Markdown table.")
    };
  }

  return { ok: true };
}

export function resolveSectionAnchor(
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

export function resolveInsertionPosition(
  context: DocumentAgentToolContext,
  args: InsertMarkdownArgs
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
