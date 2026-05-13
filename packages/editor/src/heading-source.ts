import { parserCtx, serializerCtx } from "@milkdown/kit/core";
import { headingSchema, paragraphSchema } from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode, NodeType } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

type ActiveHeadingSource = {
  from: number;
  to: number;
};

type HeadingRange = {
  from: number;
  node: ProseNode;
  to: number;
};

type ParsedHeadingSource = {
  from: number;
  level: number;
  markdown: string;
  text: string;
  to: number;
};

type HeadingSourceMeta =
  | {
      range: ActiveHeadingSource;
      type: "activate";
    }
  | {
      type: "deactivate";
    };

const headingSourceKey = new PluginKey<ActiveHeadingSource | null>("markra-heading-source");

function clampPosition(position: number, docSize: number) {
  return Math.max(0, Math.min(position, docSize));
}

function headingLevel(node: ProseNode) {
  const level = Number(node.attrs.level ?? 1);
  if (!Number.isFinite(level)) return 1;

  return Math.max(1, Math.min(6, Math.trunc(level)));
}

function fallbackHeadingMarkdownSource(node: ProseNode) {
  return `${"#".repeat(headingLevel(node))} ${node.textContent}`;
}

function headingMarkdownSource(
  node: ProseNode,
  doc: NodeType,
  serializeMarkdown: (content: ProseNode) => string
) {
  try {
    const serialized = serializeMarkdown(doc.create(null, node)).trim();
    return serialized || fallbackHeadingMarkdownSource(node);
  } catch {
    return fallbackHeadingMarkdownSource(node);
  }
}

function headingElementFromEventTarget(target: EventTarget | null, root: HTMLElement) {
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const headingElement = element?.closest<HTMLElement>("h1,h2,h3,h4,h5,h6") ?? null;
  if (!headingElement || !root.contains(headingElement)) return null;

  return headingElement;
}

function findHeadingRangeAtPosition(state: EditorState, heading: NodeType, position: number): HeadingRange | null {
  const safePosition = clampPosition(position, state.doc.content.size);
  const $position = state.doc.resolve(safePosition);

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    if (node.type !== heading) continue;

    return {
      from: $position.before(depth),
      node,
      to: $position.after(depth)
    };
  }

  const nodeAfter = $position.nodeAfter;
  if (nodeAfter?.type === heading) {
    return {
      from: safePosition,
      node: nodeAfter,
      to: safePosition + nodeAfter.nodeSize
    };
  }

  const nodeBefore = $position.nodeBefore;
  if (nodeBefore?.type === heading) {
    return {
      from: safePosition - nodeBefore.nodeSize,
      node: nodeBefore,
      to: safePosition
    };
  }

  return null;
}

function headingSourceCursor(range: HeadingRange, source: string, selectionFrom: number) {
  const level = headingLevel(range.node);
  const contentStart = range.from + 1;
  const contentEnd = range.to - 1;
  const contentOffset =
    contentStart <= selectionFrom && selectionFrom <= contentEnd ? selectionFrom - contentStart : 0;
  const sourceContentStart = range.from + 1 + level + 1;

  return Math.min(range.from + 1 + source.length, sourceContentStart + contentOffset);
}

function expandHeadingSource(
  view: EditorView,
  paragraph: NodeType,
  range: HeadingRange,
  serializeMarkdown: (content: ProseNode) => string
) {
  const source = headingMarkdownSource(range.node, view.state.schema.topNodeType, serializeMarkdown);
  const cursor = headingSourceCursor(range, source, view.state.selection.from);
  const paragraphNode = paragraph.create(null, view.state.schema.text(source));
  const activeSource = {
    from: range.from,
    to: range.from + paragraphNode.nodeSize
  } satisfies ActiveHeadingSource;
  const tr = view.state.tr.replaceWith(range.from, range.to, paragraphNode);

  view.dispatch(
    tr
      .setMeta(headingSourceKey, {
        range: activeSource,
        type: "activate"
      } satisfies HeadingSourceMeta)
      .setSelection(TextSelection.create(tr.doc, cursor))
      .scrollIntoView()
  );
  view.focus();
  return true;
}

function headingPositionFromElement(view: EditorView, element: HTMLElement) {
  try {
    return view.posAtDOM(element, 0);
  } catch {
    return null;
  }
}

function parseHeadingSource(text: string) {
  const match = /^(#{1,6})(?:[ \t]+|$)(.*)$/u.exec(text);
  if (!match) return null;

  const marker = match[1] ?? "";
  const rawText = match[2] ?? "";

  return {
    level: marker.length,
    markdown: text,
    text: rawText.replace(/[ \t]+#+[ \t]*$/u, "").trim()
  };
}

function findActiveHeadingSource(
  state: EditorState,
  paragraph: NodeType,
  heading: NodeType
): ParsedHeadingSource | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  const { $from } = selection;
  if ($from.parent.type !== paragraph) return null;

  const parsed = parseHeadingSource($from.parent.textContent);
  if (!parsed) return null;

  const parentDepth = $from.depth - 1;
  const parent = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  if (!parent.canReplaceWith(index, index + 1, heading)) return null;

  return {
    from: $from.before($from.depth),
    level: parsed.level,
    markdown: parsed.markdown,
    text: parsed.text,
    to: $from.after($from.depth)
  };
}

function findHeadingSourceByRange(
  state: EditorState,
  paragraph: NodeType,
  heading: NodeType,
  range: ActiveHeadingSource
): ParsedHeadingSource | null {
  const node = state.doc.nodeAt(range.from);
  if (!node || node.type !== paragraph) return null;

  const parsed = parseHeadingSource(node.textContent);
  if (!parsed) return null;

  const $from = state.doc.resolve(range.from);
  const parentDepth = Math.max(0, $from.depth - 1);
  const parent = $from.node(parentDepth);
  const index = $from.index(parentDepth);
  if (!parent.canReplaceWith(index, index + 1, heading)) return null;

  return {
    from: range.from,
    level: parsed.level,
    markdown: parsed.markdown,
    text: parsed.text,
    to: range.from + node.nodeSize
  };
}

function parseHeadingSourceNode(
  parseMarkdown: (markdown: string) => ProseNode,
  heading: NodeType,
  source: ParsedHeadingSource
) {
  try {
    const parsedDocument = parseMarkdown(source.markdown);
    let parsedHeading: ProseNode | null = null;

    parsedDocument.forEach((node) => {
      if (!parsedHeading && node.type === heading) {
        parsedHeading = node;
      }
    });

    return parsedHeading;
  } catch {
    return null;
  }
}

function fallbackHeadingNode(view: EditorView, heading: NodeType, source: ParsedHeadingSource) {
  return heading.create({ level: source.level }, source.text ? view.state.schema.text(source.text) : null);
}

function fallbackHeadingNodeFromState(state: EditorState, heading: NodeType, source: ParsedHeadingSource) {
  return heading.create({ level: source.level }, source.text ? state.schema.text(source.text) : null);
}

function headingNodeFromSource(
  state: EditorState,
  heading: NodeType,
  source: ParsedHeadingSource,
  parseMarkdown: (markdown: string) => ProseNode
) {
  return parseHeadingSourceNode(parseMarkdown, heading, source) ?? fallbackHeadingNodeFromState(state, heading, source);
}

function finalizeHeadingSource(
  view: EditorView,
  heading: NodeType,
  source: ParsedHeadingSource,
  parseMarkdown: (markdown: string) => ProseNode
) {
  const headingNode =
    parseHeadingSourceNode(parseMarkdown, heading, source) ?? fallbackHeadingNode(view, heading, source);
  const tr = view.state.tr.replaceWith(source.from, source.to, headingNode);
  const cursor = source.from + 1 + headingNode.textContent.length;

  view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView());
  view.focus();
  return true;
}

function selectionIsInsideHeadingSource(state: EditorState, source: ActiveHeadingSource) {
  const { selection } = state;
  if (!(selection instanceof TextSelection)) return false;

  return source.from < selection.from && selection.to < source.to;
}

function finalizeInactiveHeadingSource(
  state: EditorState,
  paragraph: NodeType,
  heading: NodeType,
  source: ActiveHeadingSource,
  parseMarkdown: (markdown: string) => ProseNode
): Transaction | null {
  if (selectionIsInsideHeadingSource(state, source)) return null;

  const tr = state.tr.setMeta(headingSourceKey, {
    type: "deactivate"
  } satisfies HeadingSourceMeta);
  const parsedSource = findHeadingSourceByRange(state, paragraph, heading, source);
  if (!parsedSource) return tr;

  const headingNode = headingNodeFromSource(state, heading, parsedSource, parseMarkdown);
  return tr.replaceWith(parsedSource.from, parsedSource.to, headingNode);
}

export const markraHeadingSourcePlugin = $prose((ctx) => {
  const paragraph = paragraphSchema.type(ctx);
  const heading = headingSchema.type(ctx);
  const parseMarkdown = ctx.use(parserCtx);
  const serializeMarkdown = ctx.use(serializerCtx);

  return new Plugin({
    key: headingSourceKey,
    state: {
      init: (): ActiveHeadingSource | null => null,
      apply(transaction, activeSource: ActiveHeadingSource | null): ActiveHeadingSource | null {
        const meta = transaction.getMeta(headingSourceKey) as HeadingSourceMeta | undefined;
        if (meta?.type === "deactivate") return null;
        if (meta?.type === "activate") return meta.range;
        if (!activeSource) return null;

        const mappedSource = {
          from: transaction.mapping.map(activeSource.from, 1),
          to: transaction.mapping.map(activeSource.to, -1)
        } satisfies ActiveHeadingSource;
        if (mappedSource.from >= mappedSource.to) return null;

        return mappedSource;
      }
    },
    appendTransaction: (_transactions, _oldState, newState) => {
      const activeSource = headingSourceKey.getState(newState);
      if (!activeSource) return null;

      return finalizeInactiveHeadingSource(newState, paragraph, heading, activeSource, parseMarkdown.get());
    },
    props: {
      handleDOMEvents: {
        click: (view, event) => {
          if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;

          const headingElement = headingElementFromEventTarget(event.target, view.dom);
          if (!headingElement) return false;

          const position = headingPositionFromElement(view, headingElement);
          if (position === null) return false;

          const range = findHeadingRangeAtPosition(view.state, heading, position);
          if (!range) return false;

          event.preventDefault();
          return expandHeadingSource(view, paragraph, range, serializeMarkdown.get());
        }
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;

        const source = findActiveHeadingSource(view.state, paragraph, heading);
        if (!source) return false;

        event.preventDefault();
        return finalizeHeadingSource(view, heading, source, parseMarkdown.get());
      }
    }
  });
});
