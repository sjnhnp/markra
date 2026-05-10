import { imageSchema, linkSchema } from "@milkdown/kit/preset/commonmark";
import type { Mark, MarkType, NodeType, Node as ProseNode } from "@milkdown/kit/prose/model";
import {
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction
} from "@milkdown/kit/prose/state";
import { Transform } from "@milkdown/kit/prose/transform";
import { Decoration, DecorationSet, type EditorView, type ViewMutationRecord } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

const linkMarkdownPattern = /\[([^\]\n]+)]\(([^\s)\n]+)(?:\s+"([^"\n]*)")?\)/g;
const imageMarkdownPattern = /!\[([^\]\n]*)]\(([^\s)\n]+)(?:\s+"([^"\n]*)")?\)/g;
const linkImageLiveKey = new PluginKey("markra-link-image-live-markdown");
const linkOpenModifierClass = "markra-link-open-modifier-active";

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
type FinalizedLinkRange = {
  from: number;
  mark: Mark;
  to: number;
};
type LiveMarkdownReplacement = {
  from: number;
  node: ProseNode;
  to: number;
};
export type ResolveMarkdownImageSrc = (src: string) => string;

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
  if (!(selection instanceof TextSelection)) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  if (!$from.sameParent(selection.$to)) return null;

  const from = Math.min($from.parentOffset, selection.$to.parentOffset);
  const to = Math.max($from.parentOffset, selection.$to.parentOffset);
  const range = getRawMarkdownRanges($from.parent.textContent).find((candidate) =>
    selection.empty
      ? cursorIsInsideMatch(from, candidate.from, $from.parent.textContent.slice(candidate.from, candidate.to))
      : candidate.from <= from && to <= candidate.to
  );

  return range ? makeAbsoluteRange(range, $from.start()) : null;
}

function createImagePreview(range: RawImageRange, resolveImageSrc: ResolveMarkdownImageSrc | undefined) {
  const image = document.createElement("img");
  image.className = "markra-live-image-preview";
  image.src = resolveImageSrc?.(range.src) ?? range.src;
  image.alt = range.alt;
  image.draggable = false;

  if (range.title) {
    image.title = range.title;
  }

  return image;
}

function createLinkIconWidget() {
  const icon = document.createElement("span");
  icon.className = "markra-live-link-icon markra-md-virtual-delimiter";
  icon.ariaHidden = "true";
  icon.contentEditable = "false";
  icon.draggable = false;
  return icon;
}

function markdownLinkDestination(href: string) {
  if (!/[\s()<>]/u.test(href)) return href;

  return `<${href.replace(/>/gu, "%3E")}>`;
}

function markdownLinkTitle(title: string | null) {
  if (!title) return "";

  return ` "${title.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

function linkSourceSuffix(mark: Mark) {
  const href = String(mark.attrs.href ?? "");
  const title = typeof mark.attrs.title === "string" ? mark.attrs.title : null;

  return `](${markdownLinkDestination(href)}${markdownLinkTitle(title)})`;
}

function escapeLinkLabel(label: string) {
  return label.replace(/\\/gu, "\\\\").replace(/\]/gu, "\\]");
}

function linkMarkdownSource(label: string, mark: Mark) {
  return `[${escapeLinkLabel(label)}${linkSourceSuffix(mark)}`;
}

function nodeLinkMark(node: ProseNode, link: MarkType) {
  return node.isText ? node.marks.find((mark) => mark.type === link) ?? null : null;
}

function findFoldedLinkRangeAtPosition(state: EditorState, link: MarkType, position: number) {
  const docPosition = Math.max(0, Math.min(position, state.doc.content.size));
  const $position = state.doc.resolve(docPosition);
  if (!$position.parent.isTextblock) return null;

  const parent = $position.parent;
  const parentStart = $position.start();
  const children: ProseNode[] = [];
  let targetIndex: number | null = null;
  let targetMark: Mark | null = null;

  parent.forEach((node) => {
    children.push(node);
  });

  let offset = 0;
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (!node) continue;

    if (targetMark) {
      break;
    }

    const from = parentStart + offset;
    const to = from + node.nodeSize;
    if (docPosition < from || docPosition > to) {
      offset += node.nodeSize;
      continue;
    }

    const mark = nodeLinkMark(node, link);
    if (mark) {
      targetIndex = index;
      targetMark = mark;
    }
    offset += node.nodeSize;
  }

  if (targetIndex === null || !targetMark) return null;

  let startIndex = targetIndex;
  while (startIndex > 0 && nodeLinkMark(children[startIndex - 1], link)?.eq(targetMark)) {
    startIndex -= 1;
  }

  let endIndex = targetIndex;
  while (endIndex + 1 < children.length && nodeLinkMark(children[endIndex + 1], link)?.eq(targetMark)) {
    endIndex += 1;
  }

  let fromOffset = 0;
  for (let childIndex = 0; childIndex < startIndex; childIndex += 1) {
    fromOffset += children[childIndex]?.nodeSize ?? 0;
  }

  let toOffset = fromOffset;
  for (let childIndex = startIndex; childIndex <= endIndex; childIndex += 1) {
    toOffset += children[childIndex]?.nodeSize ?? 0;
  }

  return {
    from: parentStart + fromOffset,
    label: parent.textBetween(fromOffset, toOffset, ""),
    mark: targetMark,
    to: parentStart + toOffset
  };
}

function expandFinalizedLinkMarkdown(view: EditorView, link: MarkType, position: number) {
  const range = findFoldedLinkRangeAtPosition(view.state, link, position);
  if (!range) return false;

  const markdown = linkMarkdownSource(range.label, range.mark);
  const cursorOffset = Math.max(0, Math.min(position - range.from, range.label.length));
  const tr = view.state.tr.replaceWith(range.from, range.to, view.state.schema.text(markdown));

  tr.setSelection(TextSelection.create(tr.doc, range.from + 1 + cursorOffset));
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function linkElementFromEventTarget(target: EventTarget | null) {
  const targetElement = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return targetElement?.closest<HTMLAnchorElement>("a[href]") ?? null;
}

function buildLinkDecorations(
  decorations: Decoration[],
  range: Extract<AbsoluteRawMarkdownRange, { kind: "link" }>,
  isActive: boolean
) {
  const delimiterClass = isActive ? "markra-md-delimiter" : "markra-md-hidden-delimiter";
  const labelAttrs = isActive
    ? {
        class: "markra-live-link-source-label"
      }
    : {
        class: "markra-live-link-label",
        "data-markra-href": range.href
      };

  // Link Markdown remains editable source text; only the label receives link-like styling.
  decorations.push(
    Decoration.inline(range.from, range.labelFrom, {
      class: `markra-live-link-source ${delimiterClass}`
    }),
    Decoration.inline(range.labelFrom, range.labelTo, labelAttrs),
    Decoration.inline(range.labelTo, range.to, {
      class: `markra-live-link-source ${delimiterClass}`
    })
  );

  if (!isActive) {
    decorations.push(
      Decoration.widget(range.labelTo, createLinkIconWidget, {
        ignoreSelection: true,
        key: `markra-raw-link-icon-${range.from}-${range.to}`,
        side: 1
      })
    );
  }
}

function collectFinalizedLinkRanges(doc: ProseNode, link: MarkType) {
  const ranges: FinalizedLinkRange[] = [];
  let activeRange: FinalizedLinkRange | null = null;

  const flush = () => {
    if (!activeRange) return;

    ranges.push(activeRange);
    activeRange = null;
  };

  doc.descendants((node, position) => {
    const mark = nodeLinkMark(node, link);
    if (!node.isText || !mark) {
      flush();
      return;
    }

    const from = position;
    const to = position + node.nodeSize;
    if (activeRange && activeRange.to === from && activeRange.mark.eq(mark)) {
      activeRange.to = to;
      return;
    }

    flush();
    activeRange = { from, mark, to };
  });

  flush();
  return ranges;
}

function buildFinalizedLinkIconDecorations(decorations: Decoration[], doc: ProseNode, link: MarkType) {
  for (const range of collectFinalizedLinkRanges(doc, link)) {
    decorations.push(
      Decoration.widget(range.to, createLinkIconWidget, {
        ignoreSelection: true,
        key: `markra-finalized-link-icon-${range.from}-${range.to}`,
        side: 1
      })
    );
  }
}

function buildImageDecorations(
  decorations: Decoration[],
  range: Extract<AbsoluteRawMarkdownRange, { kind: "image" }>,
  isActive: boolean,
  resolveImageSrc: ResolveMarkdownImageSrc | undefined
) {
  const sourceClass = isActive ? "markra-md-delimiter" : "markra-md-hidden-delimiter";

  decorations.push(
    Decoration.inline(range.from, range.to, {
      class: `markra-live-image-source ${sourceClass}`
    })
  );

  if (!isActive) {
    // Fold inactive image source behind a preview, matching the live Markdown model used for marks.
    decorations.push(Decoration.widget(range.from, () => createImagePreview(range, resolveImageSrc), { side: -1 }));
  }
}

function buildLiveLinkImageDecorations(
  doc: ProseNode,
  activeRange: AbsoluteRawMarkdownRange | null,
  link: MarkType,
  resolveImageSrc: ResolveMarkdownImageSrc | undefined
) {
  const decorations: Decoration[] = [];

  buildFinalizedLinkIconDecorations(decorations, doc, link);

  doc.descendants((node, position) => {
    if (!node.isTextblock) return;

    const blockStart = position + 1;
    const ranges = getRawMarkdownRanges(node.textContent);

    for (const relativeRange of ranges) {
      const range = makeAbsoluteRange(relativeRange, blockStart);
      const isActive = activeRange?.from === range.from && activeRange.to === range.to;

      if (range.kind === "image") {
        buildImageDecorations(decorations, range, isActive, resolveImageSrc);
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

export function normalizeLinkImageLiveMarkdownDocument(doc: ProseNode, link: MarkType, image: NodeType) {
  const replacements: LiveMarkdownReplacement[] = [];

  doc.descendants((node, position) => {
    if (!node.isTextblock) return;

    const blockStart = position + 1;
    for (const range of getRawMarkdownRanges(node.textContent)) {
      const absoluteRange = makeAbsoluteRange(range, blockStart);
      const replacement =
        absoluteRange.kind === "image"
          ? image.create({
              alt: absoluteRange.alt,
              src: absoluteRange.src,
              title: absoluteRange.title
            })
          : doc.type.schema.text(absoluteRange.label, [
              link.create({ href: absoluteRange.href, title: absoluteRange.title })
            ]);

      replacements.push({
        from: absoluteRange.from,
        node: replacement,
        to: absoluteRange.to
      });
    }
  });

  if (replacements.length === 0) return doc;

  const transform = new Transform(doc);
  const sortedReplacements = [...replacements].sort((left, right) => right.from - left.from);
  for (const replacement of sortedReplacements) {
    transform.replaceWith(replacement.from, replacement.to, replacement.node);
  }

  return transform.doc;
}

export function serializeLinkImageLiveMarkdown(
  doc: ProseNode,
  serializeMarkdown: (doc: ProseNode) => string,
  link: MarkType,
  image: NodeType
) {
  return serializeMarkdown(normalizeLinkImageLiveMarkdownDocument(doc, link, image));
}

function updateImageNodeDom(dom: HTMLImageElement, node: ProseNode, resolveImageSrc: ResolveMarkdownImageSrc | undefined) {
  const src = String(node.attrs.src ?? "");
  const title = String(node.attrs.title ?? "");

  dom.src = resolveImageSrc?.(src) ?? src;
  dom.alt = String(node.attrs.alt ?? "");
  dom.draggable = false;

  if (title) {
    dom.title = title;
  } else {
    dom.removeAttribute("title");
  }
}

function escapeImageAlt(alt: string) {
  return alt.replace(/\\/gu, "\\\\").replace(/\]/gu, "\\]");
}

function escapeImageTitle(title: string) {
  return title.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function unescapeImageMarkdownText(text: string) {
  return text.replace(/\\([\\\]"])/gu, "$1");
}

function imageMarkdownSrc(src: string) {
  if (!/[\s()<>]/u.test(src)) return src;

  return `<${src.replace(/>/gu, "%3E")}>`;
}

function imageMarkdownSource(node: ProseNode) {
  const alt = escapeImageAlt(String(node.attrs.alt ?? ""));
  const src = String(node.attrs.src ?? "");
  const title = String(node.attrs.title ?? "");

  if (!title) return `![${alt}](${imageMarkdownSrc(src)})`;

  return `![${alt}](${imageMarkdownSrc(src)} "${escapeImageTitle(title)}")`;
}

function parseImageMarkdownSource(source: string) {
  const match = /^!\[((?:\\.|[^\]\\])*)\]\((?:<([^>\n]+)>|([^\s)\n]+))(?:\s+"((?:\\.|[^"\n])*)")?\)$/u.exec(
    source.trim()
  );
  if (!match) return null;

  const [, alt = "", angleSrc, plainSrc, title = ""] = match;

  return {
    alt: unescapeImageMarkdownText(alt),
    src: angleSrc ?? plainSrc ?? "",
    title: unescapeImageMarkdownText(title)
  };
}

function focusImageSource(source: HTMLInputElement, node: ProseNode) {
  window.setTimeout(() => {
    source.focus();
    const alt = String(node.attrs.alt ?? "");
    source.setSelectionRange(2, 2 + alt.length);
  });
}

function createImageSourceIcon(ownerDocument: Document) {
  const svg = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
  const rect = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "rect");
  const circle = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "circle");
  const path = ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "markra-image-node-source-icon");
  svg.setAttribute("fill", "none");
  svg.setAttribute("height", "18");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");

  rect.setAttribute("height", "18");
  rect.setAttribute("rx", "2");
  rect.setAttribute("ry", "2");
  rect.setAttribute("width", "18");
  rect.setAttribute("x", "3");
  rect.setAttribute("y", "3");
  circle.setAttribute("cx", "9");
  circle.setAttribute("cy", "9");
  circle.setAttribute("r", "2");
  path.setAttribute("d", "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21");

  svg.append(rect, circle, path);
  return svg;
}

function createFinalizedImageNodeView(
  node: ProseNode,
  view: EditorView,
  getPos: (() => number | undefined) | boolean,
  resolveImageSrc: ResolveMarkdownImageSrc | undefined
) {
  let currentNode = node;
  const dom = document.createElement("span");
  const sourceRow = document.createElement("span");
  const sourceIcon = createImageSourceIcon(document);
  const source = document.createElement("input");
  const image = document.createElement("img");
  const hideSourceOnOutsidePress = (event: MouseEvent) => {
    if (!sourceRow.isConnected) return;
    if (event.target instanceof Node && dom.contains(event.target)) return;

    hideSource();
  };

  dom.className = "markra-image-node";
  dom.contentEditable = "false";
  dom.draggable = false;
  sourceRow.className = "markra-image-node-source-row";
  source.className = "markra-image-node-source";
  source.type = "text";
  source.ariaLabel = "Image markdown source";
  source.spellcheck = false;
  sourceRow.append(sourceIcon, source);
  dom.append(image);

  const showSource = () => {
    source.value = imageMarkdownSource(currentNode);
    if (!sourceRow.isConnected) dom.insertBefore(sourceRow, image);
    dom.classList.add("markra-image-node-selected");
    dom.ownerDocument.addEventListener("mousedown", hideSourceOnOutsidePress, true);
  };

  const hideSource = () => {
    sourceRow.remove();
    dom.classList.remove("markra-image-node-selected");
    dom.classList.remove("markra-image-node-source-invalid");
    dom.ownerDocument.removeEventListener("mousedown", hideSourceOnOutsidePress, true);
  };

  const syncSource = () => {
    const parsed = parseImageMarkdownSource(source.value);
    if (!parsed) {
      dom.classList.add("markra-image-node-source-invalid");
      return;
    }

    dom.classList.remove("markra-image-node-source-invalid");
    const position = typeof getPos === "function" ? getPos() : undefined;
    if (typeof position !== "number") return;

    view.dispatch(
      view.state.tr.setNodeMarkup(position, undefined, {
        alt: parsed.alt,
        src: parsed.src,
        title: parsed.title
      })
    );
  };

  const selectImage = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    showSource();
    focusImageSource(source, currentNode);
  };

  updateImageNodeDom(image, currentNode, resolveImageSrc);
  image.addEventListener("mousedown", selectImage);
  image.addEventListener("click", selectImage);
  source.addEventListener("input", syncSource);
  source.addEventListener("change", syncSource);

  return {
    dom,
    selectNode: showSource,
    deselectNode: hideSource,
    update(nextNode: ProseNode) {
      if (nextNode.type.name !== "image") return false;

      currentNode = nextNode;
      updateImageNodeDom(image, currentNode, resolveImageSrc);
      if (source.isConnected && document.activeElement !== source) source.value = imageMarkdownSource(currentNode);
      return true;
    },
    stopEvent(event: Event) {
      return event.target === source;
    },
    ignoreMutation(mutation: ViewMutationRecord) {
      return mutation.target === source;
    },
    destroy() {
      hideSource();
      image.removeEventListener("mousedown", selectImage);
      image.removeEventListener("click", selectImage);
      source.removeEventListener("input", syncSource);
      source.removeEventListener("change", syncSource);
    }
  };
}

export function markraLinkImageLivePlugin(resolveImageSrc?: ResolveMarkdownImageSrc) {
  return $prose((ctx) => {
    const link = linkSchema.type(ctx);
    const image = imageSchema.type(ctx);
    (image.spec as { draggable?: boolean }).draggable = false;

    return new Plugin({
      key: linkImageLiveKey,
      view: (view) => {
        const ownerDocument = view.dom.ownerDocument;
        const ownerWindow = ownerDocument.defaultView;
        const syncModifierState = (event: KeyboardEvent) => {
          view.dom.classList.toggle(linkOpenModifierClass, event.metaKey || event.ctrlKey);
        };
        const clearModifierState = () => {
          view.dom.classList.remove(linkOpenModifierClass);
        };

        ownerDocument.addEventListener("keydown", syncModifierState, true);
        ownerDocument.addEventListener("keyup", syncModifierState, true);
        ownerWindow?.addEventListener("blur", clearModifierState);

        return {
          destroy() {
            clearModifierState();
            ownerDocument.removeEventListener("keydown", syncModifierState, true);
            ownerDocument.removeEventListener("keyup", syncModifierState, true);
            ownerWindow?.removeEventListener("blur", clearModifierState);
          }
        };
      },
      props: {
        decorations: (state) =>
          buildLiveLinkImageDecorations(
            state.doc,
            findActiveRawMarkdownRange(state),
            link,
            resolveImageSrc
          ),
        handleDOMEvents: {
          click: (view, event) => {
            if (event.metaKey || event.ctrlKey) return false;

            const linkElement = linkElementFromEventTarget(event.target);
            if (!linkElement) return false;

            event.preventDefault();
            return expandFinalizedLinkMarkdown(view, link, view.posAtDOM(linkElement, 0));
          },
          dragstart: (_view, event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target?.closest("a[href], .markra-live-link-label, .markra-image-node, .markra-live-image-preview")) {
              return false;
            }

            event.preventDefault();
            return true;
          }
        },
        handleKeyDown: (view, event) => {
          const hasModifier = event.shiftKey || event.metaKey || event.ctrlKey || event.altKey;
          if (event.key !== "Enter" || hasModifier) return false;

          const tr = replaceRawMarkdownTarget(view.state, link, image);
          if (!tr) return false;

          event.preventDefault();
          view.dispatch(tr.scrollIntoView());
          return true;
        },
        nodeViews: {
          image: (node, view, getPos) => createFinalizedImageNodeView(node, view, getPos, resolveImageSrc)
        }
      }
    });
  });
}
