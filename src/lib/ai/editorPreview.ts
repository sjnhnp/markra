import { Slice, type Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import type { AiDiffResult } from "./agent/inlineAi";
import { clampNumber } from "../utils";

export const AI_EDITOR_PREVIEW_ACTION_EVENT = "markra-ai-preview-action";
export const AI_EDITOR_PREVIEW_RESTORE_EVENT = "markra-ai-preview-restore";
export type AiEditorPreviewAction = "apply" | "copy" | "reject";
export type AiEditorPreviewActionDetail = {
  action: AiEditorPreviewAction;
  result: AiTextDiffResult;
};
export type AiEditorPreviewRestoreDetail = {
  result: AiTextDiffResult;
};

export type AiEditorPreviewLabels = {
  apply: string;
  chars?: string;
  copied: string;
  copy: string;
  insertScope?: string;
  reject: string;
  replaceDocumentScope?: string;
  replaceRegionScope?: string;
  replaceSelectionScope?: string;
};

type AiEditorPreviewMeta =
  | {
      kind: "apply";
      labels?: AiEditorPreviewLabels;
      result: AiDiffResult;
    }
  | {
      kind: "clear";
    }
  | {
      kind: "restore";
    }
  | {
      kind: "show";
      labels?: AiEditorPreviewLabels;
      result: AiDiffResult;
    };

type AiTextDiffResult = Extract<AiDiffResult, { type: "insert" | "replace" }>;

type ApplyAiEditorResultOptions = {
  parseMarkdown?: (markdown: string) => ProseNode;
};

type AppliedTransactionResult = {
  cursor: number;
  transaction: Transaction;
};

type AiEditorPreviewSnapshot = {
  labels?: AiEditorPreviewLabels;
  result: AiTextDiffResult;
};

type AiEditorPreviewState = {
  applied?: AiEditorPreviewSnapshot;
  decorations: DecorationSet;
  dismissed?: AiEditorPreviewSnapshot;
  pending?: AiEditorPreviewSnapshot;
};

const aiEditorPreviewKey = new PluginKey<AiEditorPreviewState>("markra-ai-editor-preview");
const emptyPreviewState: AiEditorPreviewState = {
  decorations: DecorationSet.empty
};

export function showAiEditorPreview(view: EditorView, result: AiDiffResult, labels?: AiEditorPreviewLabels) {
  const docSize = view.state.doc.content.size;
  const from = result.type === "error" ? null : clampNumber(result.from, 0, docSize);
  const to = result.type === "error" ? null : clampNumber(result.to, 0, docSize);
  const appendPosition =
    result.type === "error" || from === null || to === null
      ? null
      : findPreviewAppendPosition(view.state.doc, result, from, to);
  const transaction = view.state.tr.setMeta(aiEditorPreviewKey, {
    kind: "show",
    labels,
    result
  } satisfies AiEditorPreviewMeta);

  if (appendPosition !== null) {
    // Keep the native selection from visually covering the diff preview.
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(appendPosition), 1));
  }

  view.dispatch(transaction);
}

export function clearAiEditorPreview(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(aiEditorPreviewKey, { kind: "clear" } satisfies AiEditorPreviewMeta));
}

export function applyAiEditorResult(view: EditorView, result: AiDiffResult, options: ApplyAiEditorResultOptions = {}) {
  if (!isTextDiffResult(result)) {
    console.warn("[markra-ai-preview] apply skipped: non-text result", result);
    return false;
  }

  const docSize = view.state.doc.content.size;
  const fallbackSelection = view.state.selection;
  const from = clampNumber(result.from ?? fallbackSelection.from, 0, docSize);
  const to = clampNumber(result.to ?? fallbackSelection.to, 0, docSize);
  if (from === null || to === null) {
    console.warn("[markra-ai-preview] apply skipped: invalid range", {
      docSize,
      fallbackSelection: {
        from: fallbackSelection.from,
        to: fallbackSelection.to
      },
      from,
      result,
      to
    });
    return false;
  }

  console.debug("[markra-ai-preview] apply start", {
    docSize,
    from,
    hasParseMarkdown: typeof options.parseMarkdown === "function",
    replacementLength: result.replacement.length,
    to,
    treatAsBlockMarkdown: shouldTreatReplacementAsBlockMarkdown(result.replacement),
    type: result.type
  });

  const appliedResult = shouldTreatReplacementAsBlockMarkdown(result.replacement) && options.parseMarkdown
    ? applyParsedMarkdownReplacement(view, result, from, to, options.parseMarkdown)
    : applyPlainTextReplacement(view, result, from, to);
  const { cursor, transaction } = appliedResult;

  transaction
    .setMeta(aiEditorPreviewKey, {
      kind: "apply",
      result
    } satisfies AiEditorPreviewMeta)
    .setSelection(TextSelection.near(transaction.doc.resolve(cursor), -1))
    .scrollIntoView();
  view.dispatch(transaction);
  view.focus();

  console.debug("[markra-ai-preview] apply success", {
    cursor,
    nextDocSize: transaction.doc.content.size
  });

  return true;
}

export const markraAiEditorPreviewPlugin = $prose(() => {
  return new Plugin<AiEditorPreviewState>({
    key: aiEditorPreviewKey,
    view() {
      return {
        update(view, previousState) {
          const previousPreviewState = aiEditorPreviewKey.getState(previousState);
          const nextPreviewState = aiEditorPreviewKey.getState(view.state);

          if (
            !previousPreviewState?.pending &&
            nextPreviewState?.pending &&
            (previousPreviewState?.applied || previousPreviewState?.dismissed)
          ) {
            window.dispatchEvent(
              new CustomEvent<AiEditorPreviewRestoreDetail>(AI_EDITOR_PREVIEW_RESTORE_EVENT, {
                detail: {
                  result: nextPreviewState.pending.result
                }
              })
            );
          }
        }
      };
    },
    props: {
      decorations(state) {
        return aiEditorPreviewKey.getState(state)?.decorations ?? DecorationSet.empty;
      },
      handleKeyDown(view, event) {
        const previewState = aiEditorPreviewKey.getState(view.state);
        if (!previewState?.dismissed || !isUndoShortcut(event)) return false;

        event.preventDefault();
        view.dispatch(view.state.tr.setMeta(aiEditorPreviewKey, { kind: "restore" } satisfies AiEditorPreviewMeta));
        view.focus();

        return true;
      }
    },
    state: {
      apply(transaction, previewState) {
        const meta = transaction.getMeta(aiEditorPreviewKey) as AiEditorPreviewMeta | undefined;

        if (meta?.kind === "clear") {
          return previewState.pending
            ? {
                decorations: DecorationSet.empty,
                dismissed: previewState.pending
              }
            : emptyPreviewState;
        }
        if (meta?.kind === "restore") {
          return previewState.dismissed
            ? {
                decorations: buildAiPreviewDecorations(
                  transaction.doc,
                  previewState.dismissed.result,
                  previewState.dismissed.labels
                ),
                pending: previewState.dismissed
              }
            : previewState;
        }
        if (meta?.result.type === "error") return emptyPreviewState;
        if (meta?.kind === "show" && isTextDiffResult(meta.result)) {
          return {
            decorations: buildAiPreviewDecorations(transaction.doc, meta.result, meta.labels),
            pending: {
              labels: meta.labels,
              result: meta.result
            }
          };
        }
        if (meta?.kind === "apply" && isTextDiffResult(meta.result)) {
          return {
            applied: {
              labels: meta.labels ?? previewState.pending?.labels,
              result: meta.result
            },
            decorations: DecorationSet.empty
          };
        }
        if (transaction.docChanged) {
          if (
            previewState.dismissed &&
            resultMatchesOriginal(transaction.doc, previewState.dismissed.result)
          ) {
            return {
              ...previewState,
              decorations: previewState.decorations.map(transaction.mapping, transaction.doc)
            };
          }

          if (previewState.applied && resultMatchesOriginal(transaction.doc, previewState.applied.result)) {
            if (!resultStillLooksApplied(transaction.doc, previewState.applied.result)) {
              return {
                decorations: buildAiPreviewDecorations(
                  transaction.doc,
                  previewState.applied.result,
                  previewState.applied.labels
                ),
                pending: previewState.applied
              };
            }

            return {
              ...previewState,
              decorations: previewState.decorations.map(transaction.mapping, transaction.doc)
            };
          }

          if (previewState.pending && resultMatchesReplacement(transaction.doc, previewState.pending.result)) {
            return {
              applied: previewState.pending,
              decorations: DecorationSet.empty
            };
          }

          return {
            ...previewState,
            decorations: previewState.decorations.map(transaction.mapping, transaction.doc)
          };
        }

        return previewState;
      },
      init() {
        return emptyPreviewState;
      }
    }
  });
});

function buildAiPreviewDecorations(
  doc: ProseNode,
  result: AiTextDiffResult,
  labels: AiEditorPreviewLabels = defaultLabels
) {
  const docSize = doc.content.size;
  const from = clampNumber(result.from, 0, docSize);
  const to = clampNumber(result.to, 0, docSize);
  if (from === null || to === null) return DecorationSet.empty;
  const appendPosition = findPreviewAppendPosition(doc, result, from, to);

  const decorations = [
    Decoration.widget(appendPosition, () => createPreviewWidget(result, labels, { docSize, from, to }), {
      key: `markra-ai-preview-insert-${from}-${to}-${previewKeySegment(result.replacement)}`,
      stopEvent: (event) => event.target instanceof Node && isPreviewWidgetEventTarget(event.target),
      side: -1
    })
  ];

  if (result.type === "replace" && from < to) {
    decorations.unshift(
      Decoration.inline(from, to, {
        class: "markra-ai-preview-delete"
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

function previewKeySegment(text: string) {
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return `${text.length}-${hash.toString(36)}`;
}

const defaultLabels: AiEditorPreviewLabels = {
  apply: "Apply",
  chars: "chars",
  copied: "Copied",
  copy: "Copy",
  insertScope: "Insert",
  reject: "Reject",
  replaceDocumentScope: "Replace entire document",
  replaceRegionScope: "Replace region",
  replaceSelectionScope: "Replace selection"
};

type PreviewScopeContext = {
  docSize: number;
  from: number;
  to: number;
};

function createPreviewWidget(result: AiTextDiffResult, labels: AiEditorPreviewLabels, scopeContext: PreviewScopeContext) {
  const preview = document.createElement("span");
  preview.className = shouldTreatReplacementAsBlockMarkdown(result.replacement)
    ? "markra-ai-preview-widget markra-ai-preview-widget-block"
    : "markra-ai-preview-widget";
  preview.contentEditable = "false";

  const scope = document.createElement("span");
  scope.className = "markra-ai-preview-scope";
  scope.textContent = formatPreviewScope(result, labels, scopeContext);

  const inserted = document.createElement("span");
  inserted.className = "markra-ai-preview-insert";
  inserted.textContent = result.replacement;

  const toolbar = document.createElement("span");
  toolbar.className = "markra-ai-preview-actions markra-ai-preview-actions-quiet";
  toolbar.contentEditable = "false";
  toolbar.append(
    scope,
    createActionButton("copy", labels.copy, result, labels.copied),
    createActionButton("reject", labels.reject, result),
    createActionButton("apply", labels.apply, result)
  );

  preview.append(inserted, toolbar);

  return preview;
}

function formatPreviewScope(
  result: AiTextDiffResult,
  labels: AiEditorPreviewLabels,
  { docSize, from, to }: PreviewScopeContext
) {
  const charLabel = labels.chars ?? defaultLabels.chars ?? "chars";
  const affectedLength = result.type === "insert" ? result.replacement.length : result.original.length;
  const affectedText = `${affectedLength} ${charLabel}`;

  if (result.type === "insert") {
    return `${labels.insertScope ?? defaultLabels.insertScope ?? "Insert"} | ${affectedText} | pos ${from}`;
  }
  if (from === 0 && to >= docSize) {
    return `${labels.replaceDocumentScope ?? defaultLabels.replaceDocumentScope ?? "Replace entire document"} | ${affectedText}`;
  }
  if (from < to) {
    return `${labels.replaceSelectionScope ?? defaultLabels.replaceSelectionScope ?? "Replace selection"} | ${affectedText} | ${from}-${to}`;
  }

  return `${labels.replaceRegionScope ?? defaultLabels.replaceRegionScope ?? "Replace region"} | ${affectedText}`;
}

function createActionButton(
  action: AiEditorPreviewAction,
  label: string,
  result: AiTextDiffResult,
  copiedLabel?: string
) {
  const button = document.createElement("button");
  let copyFeedbackTimer: number | null = null;
  let pointerHandled = false;
  button.className = `markra-ai-preview-action markra-ai-preview-${action}`;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createActionIcon(action));
  const triggerAction = () => {
    if (button.dataset.applying === "true") return;
    if (action === "apply") markApplyButtonBusy(button);

    console.debug("[markra-ai-preview] dispatch action", {
      action,
      from: result.from,
      replacementLength: result.replacement.length,
      to: result.to,
      type: result.type
    });
    window.dispatchEvent(
      new CustomEvent<AiEditorPreviewActionDetail>(AI_EDITOR_PREVIEW_ACTION_EVENT, {
        detail: { action, result }
      })
    );
    if (action === "copy" && copiedLabel) {
      showCopySuccessFeedback(button, copiedLabel, () => {
        if (copyFeedbackTimer !== null) window.clearTimeout(copyFeedbackTimer);
        copyFeedbackTimer = window.setTimeout(() => {
          restoreCopyButton(button, label);
          copyFeedbackTimer = null;
        }, 1200);
      });
    }
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    pointerHandled = true;
    triggerAction();
  });
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pointerHandled) {
      pointerHandled = false;
      return;
    }

    triggerAction();
  });

  return button;
}

function markApplyButtonBusy(button: HTMLButtonElement) {
  button.dataset.applying = "true";
  button.disabled = true;
  button.classList.add("markra-ai-preview-applying");
  button.setAttribute("aria-busy", "true");
  button.replaceChildren(createLoadingIcon());
}

function showCopySuccessFeedback(button: HTMLButtonElement, copiedLabel: string, scheduleRestore: () => unknown) {
  button.dataset.copied = "true";
  button.classList.add("markra-ai-preview-copied");
  button.setAttribute("aria-label", copiedLabel);
  button.title = copiedLabel;
  button.replaceChildren(createActionIcon("apply"));
  scheduleRestore();
}

function restoreCopyButton(button: HTMLButtonElement, copyLabel: string) {
  delete button.dataset.copied;
  button.classList.remove("markra-ai-preview-copied");
  button.setAttribute("aria-label", copyLabel);
  button.title = copyLabel;
  button.replaceChildren(createActionIcon("copy"));
}

function createActionIcon(action: AiEditorPreviewAction) {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svgNamespace, "svg");
  icon.classList.add("markra-ai-preview-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("fill", "none");
  icon.setAttribute("height", "15");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "15");

  const pathsByAction: Record<AiEditorPreviewAction, string[]> = {
    apply: ["M20 6 9 17l-5-5"],
    copy: [
      "M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2",
      "M8 4H6a2 2 0 0 0-2 2v10h10a2 2 0 0 0 2-2V4Z"
    ],
    reject: ["M18 6 6 18", "m6 6 12 12"]
  };

  pathsByAction[action].forEach((pathData) => {
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", pathData);
    icon.append(path);
  });

  return icon;
}

function createLoadingIcon() {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svgNamespace, "svg");
  const circle = document.createElementNS(svgNamespace, "circle");
  icon.classList.add("markra-ai-preview-icon", "markra-ai-preview-spinner");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("fill", "none");
  icon.setAttribute("height", "15");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "15");
  circle.setAttribute("cx", "12");
  circle.setAttribute("cy", "12");
  circle.setAttribute("r", "8");
  circle.setAttribute("stroke", "currentColor");
  circle.setAttribute("stroke-linecap", "round");
  circle.setAttribute("stroke-width", "2.4");
  circle.setAttribute("stroke-dasharray", "32");
  circle.setAttribute("stroke-dashoffset", "12");
  icon.append(circle);

  return icon;
}

function isPreviewWidgetEventTarget(target: Node) {
  if (!(target instanceof Element)) return false;

  return target.closest(".markra-ai-preview-widget") !== null;
}

function isTextDiffResult(result: AiDiffResult): result is AiTextDiffResult {
  return result.type === "insert" || result.type === "replace";
}

function applyParsedMarkdownReplacement(
  view: EditorView,
  result: AiTextDiffResult,
  from: number,
  to: number,
  parseMarkdown: (markdown: string) => ProseNode
) {
  const parsedDocument = parseMarkdown(result.replacement);
  const range = result.type === "replace"
    ? findBlockReplacementRange(view.state.doc, from, to)
    : findBlockInsertRange(view.state.doc, from);
  const slice = new Slice(parsedDocument.content, 0, 0);
  const transaction = view.state.tr.replace(range.from, range.to, slice);
  const cursor = Math.min(transaction.doc.content.size, range.from + slice.content.size);

  return {
    cursor,
    transaction
  };
}

function applyPlainTextReplacement(
  view: EditorView,
  result: AiTextDiffResult,
  from: number,
  to: number
): AppliedTransactionResult {
  const transaction = view.state.tr.insertText(result.replacement, from, to);
  const cursor = Math.min(transaction.doc.content.size, from + result.replacement.length);

  return {
    cursor,
    transaction
  };
}

function shouldTreatReplacementAsBlockMarkdown(markdown: string) {
  const trimmed = markdown.trimStart();

  return markdown.includes("\n") || /^(#{1,6}\s|>\s?|[-*+]\s+|\d+\.\s+|```|~~~|\|)/.test(trimmed);
}

function findPreviewAppendPosition(doc: ProseNode, result: AiTextDiffResult, from: number, to: number) {
  if (!shouldTreatReplacementAsBlockMarkdown(result.replacement)) return findInlineAppendPosition(doc, from, to);

  return findBlockInsertRange(doc, to).from;
}

function findBlockReplacementRange(doc: ProseNode, from: number, to: number) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const $from = doc.resolve(start);
  const $to = doc.resolve(end);

  if ($from.depth > 0 && $from.sameParent($to) && $from.parent.isTextblock) {
    return {
      from: $from.before($from.depth),
      to: $from.after($from.depth)
    };
  }

  return { from: start, to: end };
}

function findBlockInsertRange(doc: ProseNode, position: number) {
  const resolvedPosition = doc.resolve(position);

  for (let depth = resolvedPosition.depth; depth > 0; depth -= 1) {
    if (resolvedPosition.node(depth).isTextblock) {
      const blockEnd = resolvedPosition.after(depth);

      return { from: blockEnd, to: blockEnd };
    }
  }

  return { from: position, to: position };
}

function isUndoShortcut(event: KeyboardEvent) {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z"
  );
}

function resultMatchesOriginal(doc: ProseNode, result: AiTextDiffResult) {
  const docSize = doc.content.size;
  const from = clampNumber(result.from, 0, docSize);
  if (from === null) return false;

  if (result.type === "insert") {
    const replacementEnd = Math.min(docSize, from + result.replacement.length);
    return doc.textBetween(from, replacementEnd, "\n") !== result.replacement;
  }

  const to = clampNumber(result.to, 0, docSize);
  if (to === null || from > to) return false;

  return doc.textBetween(from, to, "\n") === result.original;
}

function resultMatchesReplacement(doc: ProseNode, result: AiTextDiffResult) {
  const docSize = doc.content.size;
  const from = clampNumber(result.from, 0, docSize);
  if (from === null) return false;

  const replacementEnd = Math.min(docSize, from + result.replacement.length);
  return doc.textBetween(from, replacementEnd, "\n") === result.replacement;
}

function resultStillLooksApplied(doc: ProseNode, result: AiTextDiffResult) {
  if (resultMatchesReplacement(doc, result)) return true;
  if (!shouldTreatReplacementAsBlockMarkdown(result.replacement)) return false;

  const docSize = doc.content.size;
  const from = clampNumber(result.from, 0, docSize);
  if (from === null) return false;

  const needles = blockMarkdownReplacementNeedles(result);
  if (!needles.length) return false;

  const nearbyEnd = Math.min(docSize, from + Math.max(result.replacement.length * 2, result.original.length + 240));
  const nearbyText = normalizePreviewComparableText(doc.textBetween(from, nearbyEnd, "\n"));

  return needles.every((needle) => nearbyText.includes(needle));
}

function blockMarkdownReplacementNeedles(result: AiTextDiffResult) {
  const normalizedOriginal = normalizePreviewComparableText(result.original);

  return result.replacement
    .split("\n")
    .map(markdownLineToComparableText)
    .filter((line) => line.length > 0 && line !== normalizedOriginal)
    .slice(0, 3);
}

function markdownLineToComparableText(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (/^\|?\s*:?-{3,}:?(\s*\|\s*:?-{3,}:?)*\s*\|?$/u.test(trimmed)) return "";

  return normalizePreviewComparableText(
    trimmed
      .replace(/^#{1,6}\s+/u, "")
      .replace(/^\|/u, "")
      .replace(/\|$/u, "")
      .replace(/\|/gu, " ")
  );
}

function normalizePreviewComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`"'“”‘’#*()[\]{}:,.!?|<>~_-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function findInlineAppendPosition(doc: ProseNode, from: number, to: number) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  let appendPosition = end;

  doc.nodesBetween(start, end, (node, position) => {
    if (!node.isText || node.nodeSize === 0) return true;

    const textStart = position;
    const textEnd = position + node.nodeSize;
    const visibleEnd = Math.min(end, textEnd);
    if (visibleEnd > textStart) appendPosition = visibleEnd;

    return true;
  });

  return appendPosition;
}
