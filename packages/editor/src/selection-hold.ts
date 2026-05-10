import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import type { AiSelectionContext } from "@markra/ai";
import { clampNumber } from "@markra/shared";

type AiSelectionHoldMeta =
  | {
      kind: "clear";
    }
  | {
      kind: "show";
      selection: AiSelectionContext;
    };

const aiSelectionHoldKey = new PluginKey<DecorationSet>("markra-ai-selection-hold");
const emptySelectionHold = DecorationSet.empty;

export function showAiSelectionHold(view: EditorView, selection: AiSelectionContext) {
  view.dispatch(
    view.state.tr.setMeta(aiSelectionHoldKey, {
      kind: "show",
      selection
    } satisfies AiSelectionHoldMeta)
  );
}

export function clearAiSelectionHold(view: EditorView) {
  view.dispatch(view.state.tr.setMeta(aiSelectionHoldKey, { kind: "clear" } satisfies AiSelectionHoldMeta));
}

export const markraAiSelectionHoldPlugin = $prose(() => {
  return new Plugin<DecorationSet>({
    key: aiSelectionHoldKey,
    props: {
      decorations(state) {
        return aiSelectionHoldKey.getState(state) ?? emptySelectionHold;
      }
    },
    state: {
      apply(transaction, decorations) {
        const meta = transaction.getMeta(aiSelectionHoldKey) as AiSelectionHoldMeta | undefined;

        if (meta?.kind === "clear") return emptySelectionHold;

        if (meta?.kind === "show") {
          return buildAiSelectionHoldDecorations(transaction.doc, meta.selection);
        }

        if (transaction.docChanged) return decorations.map(transaction.mapping, transaction.doc);

        return decorations;
      },
      init() {
        return emptySelectionHold;
      }
    }
  });
});

function buildAiSelectionHoldDecorations(doc: ProseNode, selection: AiSelectionContext) {
  const docSize = doc.content.size;
  const from = clampNumber(selection.from, 0, docSize);
  const to = clampNumber(selection.to, 0, docSize);
  if (from === null || to === null || from >= to || !selection.text.trim()) return emptySelectionHold;

  return DecorationSet.create(doc, [
    Decoration.inline(from, to, {
      class: "markra-ai-selection-hold"
    })
  ]);
}
