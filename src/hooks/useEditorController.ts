import { useCallback, useEffect, useRef } from "react";
import { editorViewCtx, type Editor } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { getMarkdown } from "@milkdown/kit/utils";
import type { MarkdownOutlineItem } from "../lib/markdown";

const outlineScrollTopOffset = 24;

export function shouldFocusEditorOnReady() {
  const params = new URLSearchParams(window.location.search);
  return params.has("blank") || params.has("path");
}

export function scrollElementToContainerTop(element: Node | null, scrollContainer: Element | null) {
  if (!(element instanceof HTMLElement) || !(scrollContainer instanceof HTMLElement)) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  // Keep outline jumps slightly below the top edge so the heading has room to breathe.
  const top = Math.max(0, scrollContainer.scrollTop + elementRect.top - containerRect.top - outlineScrollTopOffset);

  if (typeof scrollContainer.scrollTo === "function") {
    scrollContainer.scrollTo({
      behavior: "auto",
      top
    });
    return;
  }

  scrollContainer.scrollTop = top;
}

export function useEditorController() {
  const editorRef = useRef<Editor | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const getCurrentMarkdown = useCallback((fallbackContent: string) => {
    try {
      return editorRef.current?.action(getMarkdown()) ?? fallbackContent;
    } catch {
      return fallbackContent;
    }
  }, []);

  const handleEditorReady = useCallback((editor: Editor | null) => {
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }

    editorRef.current = editor;

    if (!editor || !shouldFocusEditorOnReady()) return;

    focusTimerRef.current = window.setTimeout(() => {
      if (editorRef.current !== editor) return;

      try {
        const view = editor.action((ctx) => ctx.get(editorViewCtx));
        view.focus();
      } catch {
        // The editor may have been torn down before the deferred focus runs.
      } finally {
        focusTimerRef.current = null;
      }
    }, 0);
  }, []);

  const runEditorShortcut = useCallback(
    (key: string, modifiers: Pick<KeyboardEventInit, "altKey" | "shiftKey"> = {}) => {
      const editor = editorRef.current;
      if (!editor) return;

      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        metaKey: true,
        ...modifiers
      });
      const handled = view.someProp("handleKeyDown", (handler) => handler(view, event));

      if (handled) {
        view.focus();
      }
    },
    []
  );

  const insertMarkdownSnippet = useCallback((open: string, close: string, placeholder: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const view = editor.action((ctx) => ctx.get(editorViewCtx));
    const { from, to } = view.state.selection;
    const selectedText = view.state.doc.textBetween(from, to, " ");
    const content = selectedText || placeholder;
    const insertedText = `${open}${content}${close}`;
    const cursor = selectedText ? from + insertedText.length : from + open.length + content.length;
    const tr = view.state.tr.insertText(insertedText, from, to);
    tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView();

    view.dispatch(tr);
    view.focus();
  }, []);

  const selectOutlineItem = useCallback((targetItem: MarkdownOutlineItem, targetIndex: number) => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      let headingIndex = -1;
      let targetNodePosition: number | null = null;
      let targetPosition: number | null = null;

      view.state.doc.descendants((node, position) => {
        if (node.type.name !== "heading") return true;

        headingIndex += 1;
        if (
          headingIndex === targetIndex &&
          Number(node.attrs.level) === targetItem.level &&
          node.textContent.trim() === targetItem.title
        ) {
          // Keep the cursor inside the matched heading while the DOM scroll aligns the heading itself.
          targetNodePosition = position;
          targetPosition = position + 1;
          return false;
        }

        return true;
      });

      if (targetPosition === null) {
        view.focus();
        return;
      }

      const resolvedPosition = view.state.doc.resolve(targetPosition);
      const selection = TextSelection.near(resolvedPosition);

      view.focus();
      view.dispatch(view.state.tr.setSelection(selection));
      scrollElementToContainerTop(
        targetNodePosition === null ? null : view.nodeDOM(targetNodePosition),
        view.dom.closest(".paper-scroll")
      );
    } catch {
      // The sidebar should remain usable even if the editor is still booting.
    }
  }, []);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    };
  }, []);

  return {
    getCurrentMarkdown,
    handleEditorReady,
    insertMarkdownSnippet,
    runEditorShortcut,
    selectOutlineItem
  };
}
