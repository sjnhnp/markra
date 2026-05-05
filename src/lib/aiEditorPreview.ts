import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import type { AiDiffResult } from "./agent/inlineAi";

export const AI_EDITOR_PREVIEW_ACTION_EVENT = "markra-ai-preview-action";
export type AiEditorPreviewAction = "apply" | "copy" | "reject";

export type AiEditorPreviewLabels = {
  apply: string;
  copy: string;
  reject: string;
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
      kind: "show";
      labels?: AiEditorPreviewLabels;
      result: AiDiffResult;
    };

type AiTextDiffResult = Extract<AiDiffResult, { type: "insert" | "replace" }>;

type AiEditorPreviewSnapshot = {
  labels?: AiEditorPreviewLabels;
  result: AiTextDiffResult;
};

type AiEditorPreviewState = {
  applied?: AiEditorPreviewSnapshot;
  decorations: DecorationSet;
  pending?: AiEditorPreviewSnapshot;
};

const aiEditorPreviewKey = new PluginKey<AiEditorPreviewState>("markra-ai-editor-preview");
const emptyPreviewState: AiEditorPreviewState = {
  decorations: DecorationSet.empty
};

export function showAiEditorPreview(view: EditorView, result: AiDiffResult, labels?: AiEditorPreviewLabels) {
  const docSize = view.state.doc.content.size;
  const from = result.type === "error" ? null : clampPosition(result.from, docSize);
  const to = result.type === "error" ? null : clampPosition(result.to, docSize);
  const appendPosition =
    result.type === "error" || from === null || to === null ? null : findInlineAppendPosition(view.state.doc, from, to);
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

export function applyAiEditorResult(view: EditorView, result: AiDiffResult) {
  if (!isTextDiffResult(result)) return false;

  const docSize = view.state.doc.content.size;
  const fallbackSelection = view.state.selection;
  const from = clampPosition(result.from ?? fallbackSelection.from, docSize);
  const to = clampPosition(result.to ?? fallbackSelection.to, docSize);
  if (from === null || to === null) return false;

  const transaction = view.state.tr.insertText(result.replacement, from, to).setMeta(aiEditorPreviewKey, {
    kind: "apply",
    result
  } satisfies AiEditorPreviewMeta);
  const cursor = Math.min(transaction.doc.content.size, from + result.replacement.length);

  transaction.setSelection(TextSelection.create(transaction.doc, cursor)).scrollIntoView();
  view.dispatch(transaction);
  view.focus();

  return true;
}

export const markraAiEditorPreviewPlugin = $prose(() => {
  return new Plugin<AiEditorPreviewState>({
    key: aiEditorPreviewKey,
    props: {
      decorations(state) {
        return aiEditorPreviewKey.getState(state)?.decorations ?? DecorationSet.empty;
      }
    },
    state: {
      apply(transaction, previewState) {
        const meta = transaction.getMeta(aiEditorPreviewKey) as AiEditorPreviewMeta | undefined;

        if (meta?.kind === "clear" || meta?.result.type === "error") return emptyPreviewState;
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
          if (previewState.applied && resultMatchesOriginal(transaction.doc, previewState.applied.result)) {
            return {
              decorations: buildAiPreviewDecorations(
                transaction.doc,
                previewState.applied.result,
                previewState.applied.labels
              ),
              pending: previewState.applied
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
  const from = clampPosition(result.from, docSize);
  const to = clampPosition(result.to, docSize);
  if (from === null || to === null) return DecorationSet.empty;
  const appendPosition = findInlineAppendPosition(doc, from, to);

  const decorations = [
    Decoration.widget(appendPosition, () => createPreviewWidget(result.replacement, labels), {
      key: `markra-ai-preview-insert-${from}-${to}`,
      side: 1
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

const defaultLabels: AiEditorPreviewLabels = {
  apply: "Apply",
  copy: "Copy",
  reject: "Reject"
};

function createPreviewWidget(text: string, labels: AiEditorPreviewLabels) {
  const preview = document.createElement("span");
  preview.className = "markra-ai-preview-widget";
  preview.contentEditable = "false";

  const inserted = document.createElement("span");
  inserted.className = "markra-ai-preview-insert";
  inserted.textContent = text;

  const actions = document.createElement("span");
  actions.className = "markra-ai-preview-actions";
  actions.contentEditable = "false";
  actions.append(
    createActionButton("copy", labels.copy),
    createActionButton("reject", labels.reject),
    createActionButton("apply", labels.apply)
  );

  preview.append(inserted, actions);

  return preview;
}

function createActionButton(action: AiEditorPreviewAction, label: string) {
  const button = document.createElement("button");
  button.className = `markra-ai-preview-action markra-ai-preview-${action}`;
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createActionIcon(action));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(
      new CustomEvent<{ action: AiEditorPreviewAction }>(AI_EDITOR_PREVIEW_ACTION_EVENT, {
        detail: { action }
      })
    );
  });

  return button;
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

function clampPosition(position: number | undefined, docSize: number) {
  if (typeof position !== "number" || Number.isNaN(position)) return null;

  return Math.max(0, Math.min(docSize, position));
}

function isTextDiffResult(result: AiDiffResult): result is AiTextDiffResult {
  return result.type === "insert" || result.type === "replace";
}

function resultMatchesOriginal(doc: ProseNode, result: AiTextDiffResult) {
  const docSize = doc.content.size;
  const from = clampPosition(result.from, docSize);
  if (from === null) return false;

  if (result.type === "insert") {
    const replacementEnd = Math.min(docSize, from + result.replacement.length);
    return doc.textBetween(from, replacementEnd, "\n") !== result.replacement;
  }

  const to = clampPosition(result.to, docSize);
  if (to === null || from > to) return false;

  return doc.textBetween(from, to, "\n") === result.original;
}

function resultMatchesReplacement(doc: ProseNode, result: AiTextDiffResult) {
  const docSize = doc.content.size;
  const from = clampPosition(result.from, docSize);
  if (from === null) return false;

  const replacementEnd = Math.min(docSize, from + result.replacement.length);
  return doc.textBetween(from, replacementEnd, "\n") === result.replacement;
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
