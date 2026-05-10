import { imageSchema, linkSchema } from "@milkdown/kit/preset/commonmark";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";
import { buildLiveLinkImageDecorations } from "./decorations.ts";
import { replaceRawMarkdownTarget } from "./finalize.ts";
import { createFinalizedImageNodeView } from "./images.ts";
import { expandFinalizedLinkMarkdown, linkElementFromEventTarget } from "./links.ts";
import { findActiveRawMarkdownRange } from "./ranges.ts";
import type { ResolveMarkdownImageSrc } from "./types.ts";

const linkImageLiveKey = new PluginKey("markra-link-image-live-markdown");
const linkOpenModifierClass = "markra-link-open-modifier-active";

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
          buildLiveLinkImageDecorations(state.doc, findActiveRawMarkdownRange(state), link, resolveImageSrc),
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
