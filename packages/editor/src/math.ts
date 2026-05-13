import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { renderToString } from "katex";

type MathRangeKind = "display" | "inline";

type MathRange = {
  from: number;
  kind: MathRangeKind;
  source: string;
  tex: string;
  to: number;
};

type ActiveMathSource = {
  from: number;
  to: number;
};

type MathRenderMeta =
  | {
      range: MathRange;
      type: "activate";
    }
  | {
      type: "deactivate";
    };

const mathRenderKey = new PluginKey<ActiveMathSource | null>("markra-math-render");

function isEscaped(text: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function findClosingDelimiter(text: string, delimiter: "$" | "$$", from: number) {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] !== "$" || isEscaped(text, index)) continue;

    if (delimiter === "$$") {
      if (text.startsWith("$$", index)) return index;
      continue;
    }

    if (text[index - 1] !== "$" && text[index + 1] !== "$") return index;
  }

  return -1;
}

function getMathRanges(text: string) {
  const ranges: MathRange[] = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] !== "$" || isEscaped(text, index)) {
      index += 1;
      continue;
    }

    if (text.startsWith("$$", index)) {
      const closingIndex = findClosingDelimiter(text, "$$", index + 2);
      if (closingIndex === -1) {
        index += 2;
        continue;
      }

      const to = closingIndex + 2;
      const tex = text.slice(index + 2, closingIndex).trim();
      if (tex) {
        ranges.push({
          from: index,
          kind: "display",
          source: text.slice(index, to),
          tex,
          to
        });
      }

      index = to;
      continue;
    }

    if (text[index - 1] === "$" || text[index + 1] === "$") {
      index += 1;
      continue;
    }

    const closingIndex = findClosingDelimiter(text, "$", index + 1);
    if (closingIndex === -1) {
      index += 1;
      continue;
    }

    const to = closingIndex + 1;
    const tex = text.slice(index + 1, closingIndex).trim();
    if (tex) {
      ranges.push({
        from: index,
        kind: "inline",
        source: text.slice(index, to),
        tex,
        to
      });
    }

    index = to;
  }

  return ranges;
}

function makeAbsoluteRange(range: MathRange, blockStart: number): MathRange {
  return {
    ...range,
    from: blockStart + range.from,
    to: blockStart + range.to
  };
}

function findActiveMathRange(state: EditorState) {
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  if ($from.parent.type.spec.code) return null;
  if (!$from.sameParent(selection.$to)) return null;

  const from = Math.min($from.parentOffset, selection.$to.parentOffset);
  const to = Math.max($from.parentOffset, selection.$to.parentOffset);
  const relativeRange = getMathRanges($from.parent.textContent).find((candidate) =>
    selection.empty ? candidate.from < from && from < candidate.to : candidate.from <= from && to <= candidate.to
  );

  return relativeRange ? makeAbsoluteRange(relativeRange, $from.start()) : null;
}

function findMathRangeByBounds(doc: ProseNode, bounds: ActiveMathSource) {
  let activeRange: MathRange | null = null;

  doc.descendants((node, position) => {
    if (activeRange) return false;
    if (!node.isTextblock || node.type.spec.code) return;

    const blockStart = position + 1;
    for (const relativeRange of getMathRanges(node.textContent)) {
      const range = makeAbsoluteRange(relativeRange, blockStart);
      if (range.from !== bounds.from || range.to !== bounds.to) continue;

      activeRange = range;
      return false;
    }
  });

  return activeRange;
}

function getActiveMathSource(state: EditorState) {
  const activeSource = mathRenderKey.getState(state) as ActiveMathSource | null;
  if (!activeSource) return null;

  return findMathRangeByBounds(state.doc, activeSource);
}

function getEditableMathRange(state: EditorState) {
  return getActiveMathSource(state) ?? findActiveMathRange(state);
}

function findAdjacentMathRange(state: EditorState, direction: "backward" | "forward") {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  if (getActiveMathSource(state)) return null;

  let adjacentRange: MathRange | null = null;
  const cursor = selection.from;

  state.doc.descendants((node, position) => {
    if (adjacentRange) return false;
    if (!node.isTextblock || node.type.spec.code) return;

    const blockStart = position + 1;
    for (const relativeRange of getMathRanges(node.textContent)) {
      const range = makeAbsoluteRange(relativeRange, blockStart);
      const touchesCursor = direction === "forward" ? range.from === cursor : range.to === cursor;
      if (!touchesCursor) continue;

      adjacentRange = range;
      return false;
    }
  });

  return adjacentRange;
}

function renderFormula(range: MathRange) {
  return renderToString(range.tex, {
    displayMode: range.kind === "display",
    output: "htmlAndMathml",
    strict: "ignore",
    throwOnError: false
  });
}

function mathSourceEditPosition(range: MathRange) {
  const delimiterLength = range.kind === "display" ? 2 : 1;
  const sourceAfterDelimiter = range.source.slice(delimiterLength);
  const firstContentOffset = sourceAfterDelimiter.search(/\S/u);
  const fallbackPosition = range.from + delimiterLength;
  if (firstContentOffset === -1) return fallbackPosition;

  return Math.min(range.to - 1, fallbackPosition + firstContentOffset);
}

function revealMathSource(view: EditorView, range: MathRange) {
  view.dispatch(
    view.state.tr
      .setMeta(mathRenderKey, {
        range,
        type: "activate"
      } satisfies MathRenderMeta)
      .setSelection(TextSelection.create(view.state.doc, mathSourceEditPosition(range)))
      .scrollIntoView()
  );
  view.focus();
}

function closeActiveMathSource(view: EditorView, event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;

  const range = getEditableMathRange(view.state);
  if (!range) return false;

  event.preventDefault();
  view.dispatch(
    view.state.tr
      .setMeta(mathRenderKey, {
        type: "deactivate"
      } satisfies MathRenderMeta)
      .setSelection(TextSelection.create(view.state.doc, range.to))
      .scrollIntoView()
  );
  view.focus();
  return true;
}

function deleteMathRange(view: EditorView, range: MathRange) {
  let transaction = view.state.tr
    .setMeta(mathRenderKey, {
      type: "deactivate"
    } satisfies MathRenderMeta)
    .delete(range.from, range.to);
  const cursor = Math.min(range.from, transaction.doc.content.size);
  transaction = transaction.setSelection(TextSelection.create(transaction.doc, cursor)).scrollIntoView();
  view.dispatch(transaction);
  view.focus();
}

function deleteAdjacentMathSource(view: EditorView, event: KeyboardEvent) {
  if (event.key !== "Backspace" && event.key !== "Delete") return false;

  const range = findAdjacentMathRange(view.state, event.key === "Delete" ? "forward" : "backward");
  if (!range) return false;

  event.preventDefault();
  deleteMathRange(view, range);
  return true;
}

function handleMathKeyDown(view: EditorView, event: KeyboardEvent) {
  return closeActiveMathSource(view, event) || deleteAdjacentMathSource(view, event);
}

function selectionIsInsideMathRange(state: EditorState, range: MathRange) {
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return false;

  const from = Math.min(selection.from, selection.to);
  const to = Math.max(selection.from, selection.to);

  return selection.empty ? range.from < from && from < range.to : range.from <= from && to <= range.to;
}

function closeInactiveMathSource(state: EditorState) {
  const activeSource = mathRenderKey.getState(state) as ActiveMathSource | null;
  if (!activeSource) return null;

  const activeRange = findMathRangeByBounds(state.doc, activeSource);
  if (activeRange && selectionIsInsideMathRange(state, activeRange)) return null;

  return state.tr.setMeta(mathRenderKey, {
    type: "deactivate"
  } satisfies MathRenderMeta);
}

function createMathWidget(range: MathRange) {
  return (view: EditorView) => {
    const element = view.dom.ownerDocument.createElement("span");
    element.className = `markra-math-render markra-math-render-${range.kind}`;
    element.setAttribute("aria-label", range.kind === "display" ? "Math formula" : "Inline math formula");
    element.tabIndex = 0;

    element.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revealMathSource(view, range);
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        event.stopPropagation();
        deleteMathRange(view, range);
        return;
      }

      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      event.stopPropagation();
      revealMathSource(view, range);
    });

    try {
      element.innerHTML = renderFormula(range);
    } catch {
      element.classList.add("markra-math-render-invalid");
      element.textContent = range.source;
    }

    return element;
  };
}

function buildMathDecorations(doc: ProseNode, activeRange: MathRange | null) {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isTextblock || node.type.spec.code) return;

    const blockStart = position + 1;
    for (const relativeRange of getMathRanges(node.textContent)) {
      const range = makeAbsoluteRange(relativeRange, blockStart);
      const isActive = activeRange?.from === range.from && activeRange.to === range.to;
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: isActive
            ? "markra-math-source markra-md-delimiter"
            : "markra-math-source markra-math-source-hidden markra-md-hidden-delimiter"
        })
      );

      if (!isActive) {
        decorations.push(
          Decoration.widget(range.from, createMathWidget(range), {
            ignoreSelection: true,
            key: `markra-math-${range.kind}-${range.from}-${range.to}`,
            side: -1
          })
        );
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const markraMathPlugin = $prose(() => {
  return new Plugin({
    key: mathRenderKey,
    state: {
      init: (): ActiveMathSource | null => null,
      apply(transaction, activeSource: ActiveMathSource | null, _oldState, newState): ActiveMathSource | null {
        const meta = transaction.getMeta(mathRenderKey) as MathRenderMeta | undefined;
        if (meta?.type === "deactivate") return null;
        if (meta?.type === "activate") {
          return {
            from: meta.range.from,
            to: meta.range.to
          } satisfies ActiveMathSource;
        }

        if (!activeSource) return null;

        const mappedSource = {
          from: transaction.mapping.map(activeSource.from, 1),
          to: transaction.mapping.map(activeSource.to, -1)
        } satisfies ActiveMathSource;
        if (mappedSource.from >= mappedSource.to) return null;

        return findMathRangeByBounds(newState.doc, mappedSource) ? mappedSource : null;
      }
    },
    appendTransaction: (_transactions, _oldState, newState) => closeInactiveMathSource(newState),
    props: {
      decorations: (state) => buildMathDecorations(state.doc, getEditableMathRange(state)),
      handleKeyDown: handleMathKeyDown
    }
  });
});
