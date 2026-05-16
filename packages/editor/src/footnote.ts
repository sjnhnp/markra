import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

function footnoteReferenceLabel(node: ProseNode): string {
  return node.attrs.label ?? "";
}

function footnoteDefinitionLabel(node: ProseNode): string {
  return node.attrs.label ?? "";
}

function footnoteId(label: string): string {
  return `fn-${label}`;
}

function footnoteRefId(label: string): string {
  return `fnref-${label}`;
}

function buildFootnoteDecorations(doc: ProseNode) {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (node.type.name === "footnote_reference") {
      const label = footnoteReferenceLabel(node);

      decorations.push(
        Decoration.node(position, position + node.nodeSize, {
          class: "footnote-reference",
          id: footnoteRefId(label),
          "data-label": label,
          role: "doc-noteref"
        })
      );
    }

    if (node.type.name === "footnote_definition") {
      const label = footnoteDefinitionLabel(node);

      decorations.push(
        Decoration.node(position, position + node.nodeSize, {
          class: "footnote-definition",
          id: footnoteId(label),
          "data-label": label,
          role: "doc-endnote"
        }),
        Decoration.widget(position + node.nodeSize - 1, (view) => {
          const ownerDocument = view.dom.ownerDocument;
          const backref = ownerDocument.createElement("a");
          backref.className = "footnote-backref";
          backref.href = `#${footnoteRefId(label)}`;
          backref.setAttribute("aria-label", `Back to reference ${label}`);
          backref.textContent = "↩";
          backref.addEventListener("click", (event) => {
            event.preventDefault();
            const target = view.dom.querySelector(`#${footnoteRefId(label)}`);
            if (target) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          });
          return backref;
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export const markraFootnotePlugin = $prose(() => {
  return new Plugin({
    props: {
      decorations: (state) => buildFootnoteDecorations(state.doc),
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return false;

        const footnoteRef = target.closest(".footnote-reference");
        if (footnoteRef) {
          const label = footnoteRef.getAttribute("data-label");
          if (label) {
            event.preventDefault();
            const definition = view.dom.querySelector(`#${footnoteId(label)}`);
            if (definition) {
              definition.scrollIntoView({ behavior: "smooth", block: "center" });

              const originalBg = (definition as HTMLElement).style.backgroundColor;
              (definition as HTMLElement).style.backgroundColor = "var(--accent-soft)";
              (definition as HTMLElement).style.transition = "background-color 0.5s ease-out";
              setTimeout(() => {
                (definition as HTMLElement).style.backgroundColor = originalBg;
              }, 1500);
            }
            return true;
          }
        }

        return false;
      }
    }
  });
});
