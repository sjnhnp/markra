import { Plugin } from "@milkdown/kit/prose/state";
import { $prose } from "@milkdown/kit/utils";

/**
 * Heuristic to check if a string looks like Markdown.
 * We look for patterns that are common in Markdown but rare in plain prose.
 */
function isMarkdownish(text: string) {
  // Footnotes: [^1]
  if (text.includes("[^")) return true;
  // Links/Images: [text](url) or ![alt](url)
  if (/!?\[.*\]\(.*\)/u.test(text)) return true;
  // Headings: # Header
  if (/^#+\s/mu.test(text)) return true;
  // Unordered lists: * item or - item
  if (/^[*-]\s/mu.test(text)) return true;
  // Ordered lists: 1. item
  if (/^\d+\.\s/mu.test(text)) return true;
  // Blockquotes: > quote
  if (/^>\s/mu.test(text)) return true;
  // Code blocks: ```
  if (text.includes("```")) return true;
  // Tables: | col |
  if (text.includes("|---")) return true;

  return false;
}

/**
 * A plugin that intercepts paste events and prefers plain text if it looks like Markdown.
 * This prevents Milkdown's HTML parser from over-escaping characters like [ and ^
 * when copying from other Markdown editors like VS Code.
 */
export const markraSmartPastePlugin = $prose(() => {
  return new Plugin({
    props: {
      handlePaste: (view, event) => {
        const { clipboardData } = event;
        if (!clipboardData) return false;

        const text = clipboardData.getData("text/plain");
        const html = clipboardData.getData("text/html");

        // If we only have text, let Milkdown handle it normally.
        // If we have HTML, check if we should override it with plain text.
        if (text && html) {
          // Heuristic: If it looks like Markdown, it's likely from another MD editor
          // that also provided a syntax-highlighted HTML version.
          // We prefer the raw text to avoid escaping issues.
          if (isMarkdownish(text)) {
            // Note: We don't call preventDefault here yet because we want to see 
            // if we can just insert the text as-is.
            
            // We use the default ProseMirror text insertion logic for the plain text.
            // This ensures it gets parsed by the Markdown parser rather than the HTML parser.
            const slice = view.state.schema.text(text);
            const tr = view.state.tr.replaceSelectionWith(slice);
            view.dispatch(tr.scrollIntoView());
            
            return true;
          }
        }

        return false;
      }
    }
  });
});
