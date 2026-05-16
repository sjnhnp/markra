import { Plugin } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

/**
 * Heuristic to check if a string looks like Markdown.
 * We look for patterns that are common in Markdown but rare in plain prose.
 */
function isMarkdownish(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // If it's a single line and contains escaped-prone characters, it might be MD
  const hasCommonMdChars = /[\[\]\^\*\_~`]/.test(text);
  const isMultiLine = text.includes("\n");

  // Footnotes: [^1]
  if (text.includes("[^")) return true;
  // Links/Images: [text](url) or ![alt](url)
  if (/!?\[.*\]\(.*\)/u.test(text)) return true;
  // Headings: # Header
  if (/^#+\s/mu.test(text)) return true;
  // Unordered lists: * item or - item or + item
  if (/^[*-+]\s/mu.test(text)) return true;
  // Ordered lists: 1. item
  if (/^\d+\.\s/mu.test(text)) return true;
  // Blockquotes: > quote
  if (/^>\s/mu.test(text)) return true;
  // Code blocks: ``` or ~~~
  if (text.includes("```") || text.includes("~~~")) return true;
  // Tables: | col |
  if (text.includes("|---") || (/\|.*\|/u.test(text) && text.includes("\n"))) return true;
  // Bold/Italic/Strikethrough: **bold**, __bold__, *italic*, _italic_, ~~strike~~
  if (/\*\*.*\*\*|__.*__|~~.*~~/u.test(text)) return true;
  // Inline code: `code`
  if (/`.*`/u.test(text)) return true;
  
  // High probability if multi-line and has MD-like chars
  if (isMultiLine && hasCommonMdChars) return true;

  return false;
}

/**
 * A plugin that intercepts paste events and prefers plain text if it looks like Markdown.
 * This prevents Milkdown's HTML parser from over-escaping characters like [ and ^
 * when copying from other Markdown editors like VS Code.
 */
import { parserCtx } from "@milkdown/kit/core";
import { Slice } from "@milkdown/kit/prose/model";

export const markraSmartPastePlugin = $prose((ctx) => {
  return new Plugin({
    props: {
      handlePaste: (view, event) => {
        const { clipboardData } = event;
        if (!clipboardData) return false;

        const text = clipboardData.getData("text/plain");
        if (!text || !isMarkdownish(text)) return false;

        const parser = ctx.get(parserCtx);
        const doc = parser(text);
        if (doc) {
          event.preventDefault();
          const slice = new Slice(doc.content, 0, 0);
          const tr = view.state.tr.replaceSelection(slice);
          view.dispatch(tr.scrollIntoView());
          return true;
        }

        return false;
      }
    }
  });
});
