import {
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  emphasisSchema,
  headingSchema,
  inlineCodeSchema,
  orderedListSchema,
  paragraphSchema,
  strongSchema
} from "@milkdown/kit/preset/commonmark";
import { strikethroughSchema } from "@milkdown/kit/preset/gfm";
import { setBlockType, toggleMark, wrapIn } from "@milkdown/kit/prose/commands";
import { redo, undo } from "@milkdown/kit/prose/history";
import type { Command } from "@milkdown/kit/prose/state";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { wrapInList } from "@milkdown/kit/prose/schema-list";
import { $prose } from "@milkdown/kit/utils";

type ShortcutModifiers = {
  alt?: boolean;
  shift?: boolean;
};

function isModKey(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}

function matchesShortcut(event: KeyboardEvent, key: string, modifiers: ShortcutModifiers = {}) {
  return (
    isModKey(event) &&
    event.key.toLowerCase() === key.toLowerCase() &&
    event.altKey === Boolean(modifiers.alt) &&
    event.shiftKey === Boolean(modifiers.shift)
  );
}

function runCommand(view: EditorView, command: Command) {
  const handled = command(view.state, view.dispatch, view);

  if (handled) {
    view.focus();
  }

  return handled;
}

export const markraMarkdownShortcuts = $prose((ctx) => {
  const strong = strongSchema.type(ctx);
  const emphasis = emphasisSchema.type(ctx);
  const inlineCode = inlineCodeSchema.type(ctx);
  const strikethrough = strikethroughSchema.type(ctx);
  const paragraph = paragraphSchema.type(ctx);
  const heading = headingSchema.type(ctx);
  const bulletList = bulletListSchema.type(ctx);
  const orderedList = orderedListSchema.type(ctx);
  const blockquote = blockquoteSchema.type(ctx);
  const codeBlock = codeBlockSchema.type(ctx);

  return new Plugin({
    props: {
      handleKeyDown: (view, event) => {
        let command: Command | null = null;
        const key = event.key.toLowerCase();

        // Support both Milkdown-style shortcuts and common document-editor aliases.
        if (matchesShortcut(event, "z")) {
          command = undo;
        } else if (matchesShortcut(event, "z", { shift: true }) || matchesShortcut(event, "y")) {
          command = redo;
        } else if (matchesShortcut(event, "b")) {
          command = toggleMark(strong);
        } else if (matchesShortcut(event, "i")) {
          command = toggleMark(emphasis);
        } else if (matchesShortcut(event, "e")) {
          command = toggleMark(inlineCode);
        } else if (matchesShortcut(event, "x", { shift: true }) || matchesShortcut(event, "x", { alt: true })) {
          command = toggleMark(strikethrough);
        } else if (matchesShortcut(event, "0", { alt: true })) {
          command = setBlockType(paragraph);
        } else if (event.altKey && isModKey(event) && /^[1-6]$/.test(key) && !event.shiftKey) {
          command = setBlockType(heading, { level: Number(key) });
        } else if (matchesShortcut(event, "7", { alt: true }) || matchesShortcut(event, "7", { shift: true })) {
          command = wrapInList(orderedList);
        } else if (matchesShortcut(event, "8", { alt: true }) || matchesShortcut(event, "8", { shift: true })) {
          command = wrapInList(bulletList);
        } else if (matchesShortcut(event, "b", { shift: true })) {
          command = wrapIn(blockquote);
        } else if (matchesShortcut(event, "c", { alt: true })) {
          command = setBlockType(codeBlock);
        }

        if (!command) return false;

        const handled = runCommand(view, command);
        if (!handled) return false;

        event.preventDefault();
        return true;
      }
    }
  });
});
