import { imageSchema, linkSchema } from "@milkdown/kit/preset/commonmark";
import type { MarkType, NodeType, Node as ProseNode } from "@milkdown/kit/prose/model";
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction
} from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

const linkMarkdownPattern = /\[([^\]\n]+)]\(([^\s)\n]+)(?:\s+"([^"\n]*)")?\)/g;
const imageMarkdownPattern = /!\[([^\]\n]*)]\(([^\s)\n]+)(?:\s+"([^"\n]*)")?\)/g;
const linkImageLiveKey = new PluginKey("markra-link-image-live-markdown");

type RawImageRange = {
  kind: "image";
  alt: string;
  src: string;
  title: string;
  from: number;
  to: number;
};

type RawLinkRange = {
  kind: "link";
  label: string;
  href: string;
  title: string | null;
  from: number;
  to: number;
  labelFrom: number;
  labelTo: number;
};

type RawMarkdownRange = RawImageRange | RawLinkRange;
type AbsoluteRawMarkdownRange = RawMarkdownRange & {
  from: number;
  to: number;
};

function overlaps(ranges: RawMarkdownRange[], from: number, to: number) {
  return ranges.some((range) => from < range.to && to > range.from);
}

function cursorIsInsideMatch(cursor: number, matchStart: number, matchedText: string) {
  return matchStart <= cursor && cursor <= matchStart + matchedText.length;
}

function getRawMarkdownRanges(text: string) {
  const ranges: RawMarkdownRange[] = [];

  imageMarkdownPattern.lastIndex = 0;
  for (const match of text.matchAll(imageMarkdownPattern)) {
    if (match.index === undefined) continue;

    const [, alt = "", src, title = ""] = match;
    if (!src) continue;

    ranges.push({
      kind: "image",
      alt,
      src,
      title,
      from: match.index,
      to: match.index + match[0].length
    });
  }

  linkMarkdownPattern.lastIndex = 0;
  for (const match of text.matchAll(linkMarkdownPattern)) {
    if (match.index === undefined) continue;
    if (text[match.index - 1] === "!") continue;

    const [, label, href, title] = match;
    if (!label || !href) continue;

    const from = match.index;
    const labelFrom = from + 1;
    const labelTo = labelFrom + label.length;
    const to = from + match[0].length;
    if (overlaps(ranges, from, to)) continue;

    ranges.push({
      kind: "link",
      label,
      href,
      title: title ?? null,
      from,
      to,
      labelFrom,
      labelTo
    });
  }

  return ranges.sort((left, right) => left.from - right.from || right.to - left.to);
}

function makeAbsoluteRange(range: RawMarkdownRange, blockStart: number): AbsoluteRawMarkdownRange {
  if (range.kind === "image") {
    return {
      ...range,
      from: blockStart + range.from,
      to: blockStart + range.to
    };
  }

  return {
    ...range,
    from: blockStart + range.from,
    to: blockStart + range.to,
    labelFrom: blockStart + range.labelFrom,
    labelTo: blockStart + range.labelTo
  };
}

function findActiveRawMarkdownRange(state: EditorState): AbsoluteRawMarkdownRange | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const cursor = $from.parentOffset;
  const range = getRawMarkdownRanges($from.parent.textContent).find((candidate) =>
    cursorIsInsideMatch(cursor, candidate.from, $from.parent.textContent.slice(candidate.from, candidate.to))
  );

  return range ? makeAbsoluteRange(range, $from.start()) : null;
}

function createImagePreview(range: RawImageRange) {
  const image = document.createElement("img");
  image.className = "markra-live-image-preview";
  image.src = range.src;
  image.alt = range.alt;
  image.draggable = false;

  if (range.title) {
    image.title = range.title;
  }

  return image;
}

function buildLinkDecorations(
  decorations: Decoration[],
  range: Extract<AbsoluteRawMarkdownRange, { kind: "link" }>,
  isActive: boolean
) {
  const delimiterClass = isActive ? "markra-md-delimiter" : "markra-md-hidden-delimiter";

  // Link Markdown remains editable source text; only the label receives link-like styling.
  decorations.push(
    Decoration.inline(range.from, range.labelFrom, {
      class: `markra-live-link-source ${delimiterClass}`
    }),
    Decoration.inline(range.labelFrom, range.labelTo, {
      class: "markra-live-link-label",
      "data-markra-href": range.href
    }),
    Decoration.inline(range.labelTo, range.to, {
      class: `markra-live-link-source ${delimiterClass}`
    })
  );
}

function buildImageDecorations(
  decorations: Decoration[],
  range: Extract<AbsoluteRawMarkdownRange, { kind: "image" }>,
  isActive: boolean
) {
  const sourceClass = isActive ? "markra-md-delimiter" : "markra-md-hidden-delimiter";

  decorations.push(
    Decoration.inline(range.from, range.to, {
      class: `markra-live-image-source ${sourceClass}`
    })
  );

  if (!isActive) {
    // Fold inactive image source behind a preview, matching the live Markdown model used for marks.
    decorations.push(Decoration.widget(range.from, () => createImagePreview(range), { side: -1 }));
  }
}

function buildLiveLinkImageDecorations(doc: ProseNode, activeRange: AbsoluteRawMarkdownRange | null) {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isTextblock) return;

    const blockStart = position + 1;
    const ranges = getRawMarkdownRanges(node.textContent);

    for (const relativeRange of ranges) {
      const range = makeAbsoluteRange(relativeRange, blockStart);
      const isActive = activeRange?.from === range.from && activeRange.to === range.to;

      if (range.kind === "image") {
        buildImageDecorations(decorations, range, isActive);
      } else {
        buildLinkDecorations(decorations, range, isActive);
      }
    }
  });

  return DecorationSet.create(doc, decorations);
}

function findRawMarkdownTarget(state: EditorState): AbsoluteRawMarkdownRange | null {
  return findActiveRawMarkdownRange(state);
}

function replaceLinkMarkdown(
  state: EditorState,
  link: MarkType,
  target: Extract<AbsoluteRawMarkdownRange, { kind: "link" }>
) {
  const linkText = state.schema.text(target.label, [link.create({ href: target.href, title: target.title })]);
  const tr = state.tr.replaceWith(target.from, target.to, linkText);

  return tr.setSelection(TextSelection.create(tr.doc, target.from + target.label.length));
}

function replaceImageMarkdown(
  state: EditorState,
  image: NodeType,
  target: Extract<AbsoluteRawMarkdownRange, { kind: "image" }>
) {
  const imageNode = image.create({ src: target.src, alt: target.alt, title: target.title });
  const tr = state.tr.replaceWith(target.from, target.to, imageNode);

  // Image is an inline atom, so place the cursor after it with a nearby valid selection.
  return tr.setSelection(Selection.near(tr.doc.resolve(target.from + imageNode.nodeSize)));
}

function replaceRawMarkdownTarget(state: EditorState, link: MarkType, image: NodeType): Transaction | null {
  const target = findRawMarkdownTarget(state);
  if (!target) return null;

  return target.kind === "image"
    ? replaceImageMarkdown(state, image, target)
    : replaceLinkMarkdown(state, link, target);
}

export const markraLinkImageLivePlugin = $prose((ctx) => {
  const link = linkSchema.type(ctx);
  const image = imageSchema.type(ctx);

  return new Plugin({
    key: linkImageLiveKey,
    props: {
      decorations: (state) => buildLiveLinkImageDecorations(state.doc, findActiveRawMarkdownRange(state)),
      handleKeyDown: (view, event) => {
        const hasModifier = event.shiftKey || event.metaKey || event.ctrlKey || event.altKey;
        if (event.key !== "Enter" || hasModifier) return false;

        const tr = replaceRawMarkdownTarget(view.state, link, image);
        if (!tr) return false;

        event.preventDefault();
        view.dispatch(tr.scrollIntoView());
        return true;
      }
    }
  });
});
