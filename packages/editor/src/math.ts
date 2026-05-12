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

const mathRenderKey = new PluginKey("markra-math-render");

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

function renderFormula(range: MathRange) {
  return renderToString(range.tex, {
    displayMode: range.kind === "display",
    output: "htmlAndMathml",
    strict: "ignore",
    throwOnError: false
  });
}

function createMathWidget(range: MathRange) {
  return (view: EditorView) => {
    const element = view.dom.ownerDocument.createElement("span");
    element.className = `markra-math-render markra-math-render-${range.kind}`;
    element.setAttribute("aria-label", range.kind === "display" ? "Math formula" : "Inline math formula");

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
    props: {
      decorations: (state) => buildMathDecorations(state.doc, findActiveMathRange(state))
    }
  });
});
