import { useCallback, useEffect, useRef } from "react";
import { editorViewCtx, type Editor } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getMarkdown } from "@milkdown/kit/utils";
import type { AiDiffResult, AiSelectionContext } from "../lib/ai/agent/inlineAi";
import {
  applyAiEditorResult,
  clearAiEditorPreview,
  showAiEditorPreview,
  type AiEditorPreviewLabels
} from "../lib/ai/editorPreview";
import { clearAiSelectionHold, showAiSelectionHold } from "../lib/ai/selectionHold";
import type { MarkdownOutlineItem } from "../lib/markdown/markdown";

const outlineScrollTopOffset = 24;

type EditorReadyOptions = {
  autoFocus?: boolean;
};

export function shouldFocusEditorOnReady(markdown = "") {
  const params = new URLSearchParams(window.location.search);
  return params.has("blank") || params.has("path") || markdown.trim() === "";
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

export function readAiSelectionContextFromView(view: EditorView): AiSelectionContext {
  const { doc, selection } = view.state;

  if (!selection.empty) {
    return {
      from: selection.from,
      text: doc.textBetween(selection.from, selection.to, "\n"),
      to: selection.to
    };
  }

  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.textContent.trim().length === 0) {
    return {
      from: selection.from,
      text: "",
      to: selection.to
    };
  }

  const from = $from.start();
  const to = $from.end();

  return {
    from,
    text: doc.textBetween(from, to, "\n"),
    to
  };
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

  const getSelection = useCallback((): AiSelectionContext | null => {
    try {
      const view = editorRef.current?.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return null;

      return readAiSelectionContextFromView(view);
    } catch {
      return null;
    }
  }, []);

  const handleEditorReady = useCallback((editor: Editor | null, options: EditorReadyOptions = {}) => {
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }

    editorRef.current = editor;

    if (!editor || !options.autoFocus) return;

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

  const applyAiResult = useCallback((result: AiDiffResult) => {
    if (result.type === "error") return false;

    try {
      const editor = editorRef.current;
      if (!editor) return false;

      const view = editor.action((ctx) => ctx.get(editorViewCtx));
      return applyAiEditorResult(view, result);
    } catch {
      return false;
    }
  }, []);

  const previewAiResult = useCallback((result: AiDiffResult, labels?: AiEditorPreviewLabels) => {
    try {
      const view = editorRef.current?.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return;

      showAiEditorPreview(view, result, labels);
    } catch {
      // AI preview is a visual affordance. Failing to draw it should not block the command flow.
    }
  }, []);

  const holdAiSelection = useCallback((selection: AiSelectionContext) => {
    try {
      const view = editorRef.current?.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return;

      showAiSelectionHold(view, selection);
    } catch {
      // Losing this decoration should not interrupt the AI command flow.
    }
  }, []);

  const clearAiPreview = useCallback(() => {
    try {
      const view = editorRef.current?.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return;

      clearAiEditorPreview(view);
    } catch {
      // The editor may be unavailable while windows are changing.
    }
  }, []);

  const clearAiSelection = useCallback(() => {
    try {
      const view = editorRef.current?.action((ctx) => ctx.get(editorViewCtx));
      if (!view) return;

      clearAiSelectionHold(view);
    } catch {
      // The editor may be unavailable while the AI command is closing.
    }
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
    applyAiResult,
    clearAiPreview,
    clearAiSelection,
    getCurrentMarkdown,
    getSelection,
    handleEditorReady,
    holdAiSelection,
    insertMarkdownSnippet,
    previewAiResult,
    runEditorShortcut,
    selectOutlineItem
  };
}
