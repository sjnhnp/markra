import { SerializerReady, serializerCtx } from "@milkdown/kit/core";
import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import { paragraphSchema } from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import {
  markdownCalloutDefinitions,
  markdownCalloutMarkerForType,
  parseMarkdownCalloutMarker,
  restoreEscapedMarkdownCalloutMarkers,
  type MarkdownCalloutType,
  type ParsedMarkdownCalloutMarker
} from "@markra/shared";

type CalloutBlock = {
  blockquote: ProseNode;
  blockquoteFrom: number;
  blockquoteTo: number;
  marker: ParsedMarkdownCalloutMarker;
  markerBlockFrom: number;
  markerBlockTo: number;
  markerLineIsEmpty: boolean;
  markerFrom: number;
  markerTo: number;
};

const calloutTypeOrder: MarkdownCalloutType[] = ["note", "tip", "important", "warning", "caution"];

type MarkdownSerializer = (doc: ProseNode) => string;

export const markraCalloutSerializerPlugin: MilkdownPlugin = (ctx: Ctx) => async () => {
  await ctx.wait(SerializerReady);
  ctx.update(serializerCtx, (serializeMarkdown: MarkdownSerializer) => (doc: ProseNode) =>
    restoreEscapedMarkdownCalloutMarkers(serializeMarkdown(doc))
  );

  return () => {};
};

function firstTextMarkerRange(blockquote: ProseNode, blockquoteFrom: number): CalloutBlock | null {
  const firstBlock = blockquote.firstChild;
  const firstText = firstBlock?.firstChild;
  if (!firstBlock?.isTextblock || !firstText?.isText || !firstText.text) return null;

  const marker = parseMarkdownCalloutMarker(firstText.text);
  if (!marker) return null;

  const markerOffset = firstText.text.indexOf(marker.source);
  if (markerOffset < 0) return null;

  const markerBlockFrom = blockquoteFrom + 1;
  const markerFrom = blockquoteFrom + 2 + markerOffset;
  const markerLineText = firstBlock.textContent.slice(
    firstBlock.textContent.indexOf(marker.source) + marker.source.length
  );

  return {
    blockquote,
    blockquoteFrom,
    blockquoteTo: blockquoteFrom + blockquote.nodeSize,
    marker,
    markerBlockFrom,
    markerBlockTo: markerBlockFrom + firstBlock.nodeSize,
    markerLineIsEmpty: markerLineText.trim().length === 0,
    markerFrom,
    markerTo: markerFrom + marker.source.length
  };
}

function isDeleteKey(event: KeyboardEvent) {
  return event.key === "Backspace" || event.key === "Delete";
}

function hasModifier(event: KeyboardEvent) {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}

function calloutVisibleText(callout: CalloutBlock) {
  let text = "";

  callout.blockquote.forEach((child, _offset, index) => {
    if (index === 0) {
      const markerIndex = child.textContent.indexOf(callout.marker.source);
      const contentStart = markerIndex >= 0 ? markerIndex + callout.marker.source.length : 0;
      text += child.textContent.slice(contentStart);
      return;
    }

    text += child.textContent;
  });

  return text.trim();
}

function findCalloutAtSelection(view: EditorView): CalloutBlock | null {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name !== "blockquote") continue;

    return firstTextMarkerRange(node, $from.before(depth));
  }

  return null;
}

function removeEmptyCallout(view: EditorView, callout: CalloutBlock, paragraph: ReturnType<typeof paragraphSchema.type>) {
  if (calloutVisibleText(callout).length > 0) return false;

  const transaction = view.state.tr.replaceWith(callout.blockquoteFrom, callout.blockquoteTo, paragraph.create());
  const selectionPosition = Math.min(callout.blockquoteFrom + 1, transaction.doc.content.size);

  view.dispatch(
    transaction
      .setSelection(TextSelection.create(transaction.doc, selectionPosition))
      .scrollIntoView()
  );
  view.focus();

  return true;
}

function emptySelectionBlockRange(view: EditorView) {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;
  if (!selection.$from.parent.isTextblock || selection.$from.parent.content.size > 0) return null;

  return {
    from: selection.$from.before(selection.$from.depth),
    to: selection.$from.after(selection.$from.depth)
  };
}

function adjacentCalloutTextPosition(callout: CalloutBlock, emptyBlockFrom: number, direction: "backward" | "forward") {
  let fallbackPosition: number | null = null;

  callout.blockquote.forEach((child, offset, index) => {
    if (!child.isTextblock || index === 0 || child.content.size === 0) return;

    const childFrom = callout.blockquoteFrom + 1 + offset;
    if (direction === "backward" && childFrom < emptyBlockFrom) {
      fallbackPosition = childFrom + 1 + child.content.size;
      return;
    }

    if (direction === "forward" && fallbackPosition === null && childFrom > emptyBlockFrom) {
      fallbackPosition = childFrom + 1;
    }
  });

  return fallbackPosition;
}

function removeEmptyCalloutLine(view: EditorView, callout: CalloutBlock, key: KeyboardEvent["key"]) {
  const emptyBlock = emptySelectionBlockRange(view);
  if (!emptyBlock) return false;

  const direction = key === "Delete" ? "forward" : "backward";
  const targetPosition =
    adjacentCalloutTextPosition(callout, emptyBlock.from, direction) ??
    adjacentCalloutTextPosition(callout, emptyBlock.from, direction === "forward" ? "backward" : "forward");
  if (targetPosition === null) return false;

  const transaction = view.state.tr.delete(emptyBlock.from, emptyBlock.to);
  const mappedTargetPosition = transaction.mapping.map(targetPosition);

  view.dispatch(
    transaction
      .setSelection(TextSelection.create(transaction.doc, mappedTargetPosition))
      .scrollIntoView()
  );
  view.focus();

  return true;
}

function createCalloutTypeSelect(
  ownerDocument: Document,
  view: EditorView,
  callout: CalloutBlock
) {
  const select = ownerDocument.createElement("select");
  select.className = "markra-callout-type-select";
  select.setAttribute("aria-label", "Callout type");
  select.contentEditable = "false";

  for (const type of calloutTypeOrder) {
    const definition = markdownCalloutDefinitions[type];
    const option = ownerDocument.createElement("option");
    option.value = type;
    option.textContent = definition.label;
    option.selected = type === callout.marker.type;
    select.append(option);
  }

  select.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  select.addEventListener("change", () => {
    const nextType = select.value as MarkdownCalloutType;
    const nextMarker = markdownCalloutMarkerForType(nextType);
    const transaction = view.state.tr
      .insertText(nextMarker, callout.markerFrom, callout.markerTo)
      .scrollIntoView();

    view.dispatch(transaction);
    view.focus();
  });

  return select;
}

function createCalloutHeader(callout: CalloutBlock) {
  return (view: EditorView) => {
    const ownerDocument = view.dom.ownerDocument;
    const header = ownerDocument.createElement("div");
    header.className = "markra-callout-header";
    header.contentEditable = "false";

    const icon = ownerDocument.createElement("span");
    icon.className = "markra-callout-icon";
    icon.setAttribute("aria-hidden", "true");

    const title = ownerDocument.createElement("span");
    title.className = "markra-callout-title";
    title.textContent = callout.marker.label;

    header.append(icon, title, createCalloutTypeSelect(ownerDocument, view, callout));
    return header;
  };
}

function buildCalloutDecorations(doc: ProseNode) {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (node.type.name !== "blockquote") return;

    const callout = firstTextMarkerRange(node, position);
    if (!callout) return;

    decorations.push(
      Decoration.node(callout.blockquoteFrom, callout.blockquoteTo, {
        class: `markra-callout markra-callout-${callout.marker.type}`,
        "data-callout-label": callout.marker.label,
        "data-callout-type": callout.marker.type
      }),
      Decoration.widget(callout.blockquoteFrom + 1, createCalloutHeader(callout), {
        key: `markra-callout-header-${callout.blockquoteFrom}-${callout.marker.type}`,
        side: -1
      }),
      Decoration.inline(callout.markerFrom, callout.markerTo, {
        class: "markra-callout-source-marker"
      })
    );

    if (callout.markerLineIsEmpty) {
      decorations.push(
        Decoration.node(callout.markerBlockFrom, callout.markerBlockTo, {
          class: "markra-callout-marker-line"
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const markraCalloutPlugin = $prose((ctx) => {
  const paragraph = paragraphSchema.type(ctx);

  return new Plugin({
    props: {
      decorations: (state) => buildCalloutDecorations(state.doc),
      handleKeyDown: (view, event) => {
        if (!isDeleteKey(event) || hasModifier(event)) return false;

        const callout = findCalloutAtSelection(view);
        if (!callout) return false;

        const handled = removeEmptyCallout(view, callout, paragraph);
        if (!handled && !removeEmptyCalloutLine(view, callout, event.key)) return false;

        event.preventDefault();
        return true;
      }
    }
  });
});
