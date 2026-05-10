import { fireEvent, render, waitFor } from "@testing-library/react";
import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { MarkdownPaper } from "./MarkdownPaper";
import {
  AI_EDITOR_PREVIEW_APPLIED_EVENT,
  AI_EDITOR_PREVIEW_ACTION_EVENT,
  AI_EDITOR_PREVIEW_RESTORE_EVENT,
  type AiEditorPreviewAppliedDetail,
  type AiEditorPreviewActionDetail,
  applyAiEditorResult,
  clearAiEditorPreview,
  confirmAiEditorResultApplied,
  showAiEditorPreview
} from "@markra/editor";
import {
  readAiSectionAnchorsFromView,
  readAiSelectionContextFromView,
  readAiTableAnchorsFromView
} from "../hooks/useEditorController";
import type { AiSelectionContext } from "@markra/ai";
import { clearAiSelectionHold, showAiSelectionHold } from "@markra/editor";

async function renderEditor(
  initialContent = "",
  options: {
    onMarkdownChange?: (content: string) => unknown;
    onSaveClipboardImage?: (image: File) => Promise<{ alt: string; src: string } | null>;
    openExternalUrl?: (url: string) => unknown;
    onTextSelectionChange?: (selection: AiSelectionContext | null) => unknown;
    resolveImageSrc?: (src: string) => string;
  } = {}
) {
  let editor: Editor | null = null;
  const result = render(
    <MarkdownPaper
      initialContent={initialContent}
      onEditorReady={(instance) => {
        editor = instance;
      }}
      onMarkdownChange={options.onMarkdownChange ?? (() => {})}
      onSaveClipboardImage={options.onSaveClipboardImage}
      openExternalUrl={options.openExternalUrl}
      onTextSelectionChange={options.onTextSelectionChange}
      resolveImageSrc={options.resolveImageSrc}
      revision={0}
    />
  );

  await waitFor(() => expect(editor).not.toBeNull());

  return {
    ...result,
    editor: editor!,
    view: editor!.action((ctx) => ctx.get(editorViewCtx))
  };
}

async function settleMarkdownListener() {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 250);
  });
}

function typeText(view: EditorView, text: string) {
  for (const char of text) {
    const { from, to } = view.state.selection;
    const insertText = () => view.state.tr.insertText(char, from, to).scrollIntoView();
    const handled = view.someProp("handleTextInput", (handler) => handler(view, from, to, char, insertText));

    if (!handled) {
      view.dispatch(insertText());
    }
  }
}

function insertTextDirectly(view: EditorView, text: string) {
  const { from, to } = view.state.selection;
  view.dispatch(view.state.tr.insertText(text, from, to).scrollIntoView());
}

function moveCursor(view: EditorView, position: number) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)));
}

function selectText(view: EditorView, from: number, to: number) {
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
}

function findTextPosition(view: EditorView, text: string, offset = 0) {
  let position: number | null = null;

  view.state.doc.descendants((node, nodePosition) => {
    if (position !== null) return false;
    if (!node.isText || !node.text) return;

    const textOffset = node.text.indexOf(text);
    if (textOffset === -1) return;

    position = nodePosition + textOffset + offset;
    return false;
  });

  if (position === null) {
    throw new Error(`Could not find text in editor: ${text}`);
  }

  return position;
}

function findNodeEndPosition(view: EditorView, typeName: string) {
  let position: number | null = null;

  view.state.doc.descendants((node, nodePosition) => {
    if (position !== null) return false;
    if (node.type.name !== typeName) return true;

    position = nodePosition + node.nodeSize;
    return false;
  });

  if (position === null) {
    throw new Error(`Could not find node in editor: ${typeName}`);
  }

  return position;
}

function pressEnter(view: EditorView) {
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true
  });
  return view.someProp("handleKeyDown", (handler) => handler(view, event));
}

function pressArrowRight(view: EditorView) {
  const event = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true
  });
  return view.someProp("handleKeyDown", (handler) => handler(view, event));
}

function pressArrowLeft(view: EditorView) {
  const event = new KeyboardEvent("keydown", {
    key: "ArrowLeft",
    bubbles: true,
    cancelable: true
  });
  return view.someProp("handleKeyDown", (handler) => handler(view, event));
}

function pressShortcut(
  view: EditorView,
  key: string,
  modifiers: Pick<KeyboardEventInit, "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...modifiers
  });
  return view.someProp("handleKeyDown", (handler) => handler(view, event));
}

function pasteImage(view: EditorView, image: File) {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true
  }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: {
      files: [image],
      getData: () => ""
    }
  });

  return view.someProp("handlePaste", (handler) => handler(view, event, view.state.selection.content()));
}

function expectLiveMark(container: HTMLElement, kind: string, text: string) {
  expect(container.querySelector(`.ProseMirror .markra-live-mark-${kind}`)).toHaveTextContent(text);
}

function expectLiveStrongEmphasis(container: HTMLElement, text: string) {
  const liveMark = container.querySelector(".ProseMirror .markra-live-mark-strong.markra-live-mark-emphasis");
  expect(liveMark).toHaveTextContent(text);
}

function expectMarkdownDelimiters(container: HTMLElement, count: number) {
  expect(container.querySelectorAll(".ProseMirror .markra-md-delimiter")).toHaveLength(count);
}

function expectHiddenMarkdownDelimiters(container: HTMLElement, count: number) {
  expect(container.querySelectorAll(".ProseMirror .markra-md-hidden-delimiter")).toHaveLength(count);
}

function expectMarkdownDelimiterText(container: HTMLElement, text: string) {
  expect(
    Array.from(container.querySelectorAll(".ProseMirror .markra-md-delimiter")).map((node) => node.textContent)
  ).toEqual([text, text]);
}

function expectLiveLink(container: HTMLElement, text: string) {
  const liveLink = container.querySelector(".ProseMirror .markra-live-link-label");
  expect(liveLink).toHaveTextContent(text);
  return liveLink;
}

function expectActiveSourceLinkLabel(container: HTMLElement, text: string) {
  const sourceLabel = container.querySelector(".ProseMirror .markra-live-link-source-label");
  expect(sourceLabel).toHaveTextContent(text);
  expect(sourceLabel).not.toHaveClass("markra-live-link-label");
  expect(sourceLabel).not.toHaveAttribute("data-markra-href");
  return sourceLabel;
}

function expectLinkIconCount(container: HTMLElement, count: number) {
  expect(container.querySelectorAll(".ProseMirror .markra-live-link-icon")).toHaveLength(count);
}

function expectLiveImagePreview(container: HTMLElement, src: string) {
  const image = container.querySelector<HTMLImageElement>(
    `.ProseMirror img.markra-live-image-preview[src="${src}"]`
  );
  expect(image).toBeInTheDocument();
  return image;
}

describe("MarkdownPaper editing", () => {
  it("keeps the writing surface from macOS-style scroll dragging", async () => {
    const { container } = await renderEditor();

    expect(container.querySelector(".paper-scroll")).toHaveClass("overscroll-none");
    expect(container.querySelector(".paper-scroll")).toHaveClass("h-full", "min-h-0", "overflow-auto");
  });

  it("saves pasted clipboard images and inserts markdown image references", async () => {
    const onMarkdownChange = vi.fn();
    const onSaveClipboardImage = vi.fn().mockResolvedValue({
      alt: "Screenshot",
      src: "assets/pasted-image.png"
    });
    const image = new File([new Uint8Array([1, 2, 3])], "Screenshot.png", { type: "image/png" });
    const { container, editor, view } = await renderEditor("", { onMarkdownChange, onSaveClipboardImage });

    expect(pasteImage(view, image)).toBe(true);

    await waitFor(() => expect(onSaveClipboardImage).toHaveBeenCalledWith(image));
    await waitFor(() => {
      const insertedImage = container.querySelector<HTMLImageElement>('img[src="assets/pasted-image.png"]');
      expect(insertedImage).toHaveAttribute("alt", "Screenshot");
    });
    const serializeMarkdown = editor.action((ctx) => ctx.get(serializerCtx));
    expect(serializeMarkdown(view.state.doc)).toContain("![Screenshot](assets/pasted-image.png)");
    expect(serializeMarkdown(view.state.doc)).not.toContain("!\\[Screenshot\\]\\(assets/pasted-image.png\\)");
    await waitFor(() => expect(onMarkdownChange).toHaveBeenCalledWith(expect.stringContaining("![Screenshot](assets/pasted-image.png)")));
  });

  it("renders AI replacement comparison inside the editor", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const to = from + "Original".length;

    showAiEditorPreview(view, {
      from,
      original: "Original",
      replacement: "Improved",
      to,
      type: "replace"
    });

    expect(container.querySelector(".ProseMirror .markra-ai-preview-delete")).toHaveTextContent("Original");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toBeInTheDocument();
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toHaveClass("markra-ai-preview-actions-quiet");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-apply")).toHaveAccessibleName("Apply");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-apply svg")).toBeInTheDocument();

    clearAiEditorPreview(view);

    expect(container.querySelector(".ProseMirror .markra-ai-preview-delete")).not.toBeInTheDocument();
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();
  });

  it("shows AI preview impact scope for selected text", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const to = from + "Original".length;

    showAiEditorPreview(view, {
      from,
      original: "Original",
      replacement: "Improved",
      to,
      type: "replace"
    });

    const scope = container.querySelector(".ProseMirror .markra-ai-preview-scope");
    const toolbar = scope?.closest(".markra-ai-preview-actions");
    const widget = container.querySelector(".ProseMirror .markra-ai-preview-widget");

    expect(scope).toHaveTextContent("Replace selection");
    expect(scope).toHaveTextContent("8 chars");
    expect(toolbar).toHaveClass("markra-ai-preview-actions-quiet");
    expect(widget?.firstElementChild).toHaveClass("markra-ai-preview-insert");
  });

  it("shows AI preview impact scope for whole-document replacements", async () => {
    const { container, view } = await renderEditor("Original text");

    showAiEditorPreview(view, {
      from: 0,
      original: "Original text",
      replacement: "Focused note",
      to: view.state.doc.content.size,
      type: "replace"
    });

    const scope = container.querySelector(".ProseMirror .markra-ai-preview-scope");

    expect(scope).toHaveTextContent("Replace entire document");
    expect(scope).toHaveTextContent("13 chars");
  });

  it("shows AI preview target details for table replacements", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const to = from + "Original".length;

    showAiEditorPreview(view, {
      from,
      original: "Original",
      replacement: "Improved",
      target: {
        from,
        id: "table:0",
        kind: "table",
        title: "Cost impact",
        to
      },
      to,
      type: "replace"
    });

    const scope = container.querySelector(".ProseMirror .markra-ai-preview-scope");

    expect(scope).toHaveTextContent("table: Cost impact");
  });

  it("updates an existing AI replacement preview when streaming text grows", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const to = from + "Original".length;

    showAiEditorPreview(view, {
      from,
      original: "Original",
      replacement: "I",
      to,
      type: "replace"
    });
    showAiEditorPreview(view, {
      from,
      original: "Original",
      replacement: "Improved",
      to,
      type: "replace"
    });

    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");

    clearAiEditorPreview(view);
  });

  it("shows inline success feedback when copying an AI suggestion", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");

    showAiEditorPreview(
      view,
      {
        from,
        original: "Original",
        replacement: "Improved",
        to: from + "Original".length,
        type: "replace"
      },
      {
        apply: "Apply",
        copied: "Copied",
        copy: "Copy",
        reject: "Reject"
      }
    );

    container.querySelector<HTMLButtonElement>(".ProseMirror .markra-ai-preview-copy")?.click();

    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-copy")).toHaveAccessibleName("Copied");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-copy")).toHaveAttribute("data-copied", "true");

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("does not let markdown replacement preview inherit heading styling", async () => {
    const { container, view } = await renderEditor("> Original quote\n\n## Existing heading");
    const from = findTextPosition(view, "Original quote");
    const to = from + "Original quote".length;

    showAiEditorPreview(view, {
      from,
      original: "Original quote",
      replacement: "> Improved quote",
      to,
      type: "replace"
    });

    const insertedPreview = container.querySelector(".ProseMirror .markra-ai-preview-insert");

    expect(insertedPreview).toHaveTextContent("> Improved quote");
    expect(insertedPreview?.closest("h1,h2,h3,h4,h5,h6")).toBeNull();
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toBeInTheDocument();
  });

  it("appends AI replacement preview after the original text inside a selected block", async () => {
    const { container, view } = await renderEditor("> First quote\n>\n> Second quote\n\n## Existing heading");
    const from = findTextPosition(view, "First quote");
    const to = findNodeEndPosition(view, "blockquote");

    showAiEditorPreview(view, {
      from,
      original: "First quote\n\nSecond quote",
      replacement: "Improved quote",
      to,
      type: "replace"
    });

    const insertedPreview = container.querySelector(".ProseMirror .markra-ai-preview-insert");

    expect(insertedPreview).toHaveTextContent("Improved quote");
    expect(insertedPreview?.closest("blockquote")).toBeInTheDocument();
    expect(insertedPreview?.closest("h1,h2,h3,h4,h5,h6")).toBeNull();
  });

  it("keeps AI replacement preview inside the current heading block", async () => {
    const { container, view } = await renderEditor("# Original title\n\nBody");
    const from = findTextPosition(view, "Original title");
    const to = from + "Original title".length;

    showAiEditorPreview(view, {
      from,
      original: "Original title",
      replacement: "Improved title",
      to,
      type: "replace"
    });

    const insertedPreview = container.querySelector(".ProseMirror .markra-ai-preview-insert");

    expect(insertedPreview).toHaveTextContent("Improved title");
    expect(insertedPreview?.closest("h1")).toBeInTheDocument();

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("keeps multiline markdown replacement preview out of the current heading block", async () => {
    const { container, view } = await renderEditor("# Original title\n\nBody");
    const from = findTextPosition(view, "Original title");
    const to = from + "Original title".length;

    showAiEditorPreview(view, {
      from,
      original: "Original title",
      replacement: "# Improved title\n\nVersion: v1\n\nBody paragraph.",
      to,
      type: "replace"
    });

    const previewWidget = container.querySelector(".ProseMirror .markra-ai-preview-widget");
    const insertedPreview = container.querySelector(".ProseMirror .markra-ai-preview-insert");

    expect(previewWidget).toHaveClass("markra-ai-preview-widget-block");
    expect(insertedPreview).toHaveTextContent("# Improved title");
    expect(insertedPreview).toHaveTextContent("Body paragraph.");
    expect(insertedPreview?.closest("h1,h2,h3,h4,h5,h6")).toBeNull();

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("applies multiline markdown replacement as parsed document blocks", async () => {
    const { container, editor, view } = await renderEditor("# Original title\n\nTail");
    const from = findTextPosition(view, "Original title");
    const result = {
      from,
      original: "Original title",
      replacement: "# Improved title\n\nVersion: v1\n\nBody paragraph.",
      to: from + "Original title".length,
      type: "replace" as const
    };
    const parseMarkdown = editor.action((ctx) => ctx.get(parserCtx));

    expect(applyAiEditorResult(view, result, { parseMarkdown })).toBe(true);

    expect(container.querySelector(".ProseMirror h1")).toHaveTextContent("Improved title");
    expect(container.querySelector(".ProseMirror h1")).not.toHaveTextContent("#");
    expect(container.querySelector(".ProseMirror p")).toHaveTextContent("Version: v1");
    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Tail");
    expect(view.state.selection.from).toBeLessThanOrEqual(findTextPosition(view, "Tail"));

    await settleMarkdownListener();
  });

  it("previews and applies a full Markdown table replacement from editor table anchors", async () => {
    const table = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (old-token) |"
    ].join("\n");
    const replacement = [
      "| Field | Variant One | Variant Two |",
      "| ----- | ----------- | ----------- |",
      "| Sync note | None | Needs source token (new-token) |"
    ].join("\n");
    const { container, editor, view } = await renderEditor(["### Section Alpha", "", table, "", "Tail"].join("\n"));
    const [tableAnchor] = readAiTableAnchorsFromView(view);

    expect(tableAnchor).toEqual(expect.objectContaining({
      id: "table:0",
      kind: "table",
      text: table
    }));
    expect(tableAnchor?.from).toBeGreaterThan(0);
    expect(tableAnchor?.to).toBeGreaterThan(tableAnchor?.from ?? 0);

    const result = {
      from: tableAnchor?.from,
      original: tableAnchor?.text ?? table,
      replacement,
      to: tableAnchor?.to,
      type: "replace" as const
    };
    const parseMarkdown = editor.action((ctx) => ctx.get(parserCtx));
    showAiEditorPreview(view, result, undefined, { parseMarkdown });

    const insertedPreview = container.querySelector(".ProseMirror .markra-ai-preview-insert");
    expect(insertedPreview).toHaveTextContent("new-token");
    expect(insertedPreview?.querySelector("table")).toBeInTheDocument();
    expect(insertedPreview?.textContent).not.toContain("| Field |");
    expect(insertedPreview?.closest("td,th")).toBeNull();

    expect(applyAiEditorResult(view, result, { parseMarkdown })).toBe(true);
    expect(container.querySelector(".ProseMirror table")).toHaveTextContent("new-token");
    expect(container.querySelector(".ProseMirror table")).not.toHaveTextContent("old-token");

    await settleMarkdownListener();
  });

  it("reads section anchors from editor document positions", async () => {
    const { view } = await renderEditor([
      "# Section Alpha",
      "",
      "Alpha body",
      "",
      "## Section Beta",
      "",
      "Beta body",
      "",
      "# Section Gamma",
      "",
      "Gamma body"
    ].join("\n"));

    const sections = readAiSectionAnchorsFromView(view);

    expect(sections[0]).toEqual(expect.objectContaining({
      from: 0,
      id: "section:0",
      kind: "section",
      text: expect.stringContaining("Alpha body"),
      title: "Section Alpha"
    }));
    expect(sections[0]?.text).toContain("Section Beta");
    expect(sections[0]?.text).not.toContain("Section Gamma");
    expect(sections[1]).toEqual(expect.objectContaining({
      id: "section:1",
      kind: "section",
      text: expect.stringContaining("Beta body"),
      title: "Section Beta"
    }));
    expect(sections[2]).toEqual(expect.objectContaining({
      id: "section:2",
      kind: "section",
      text: expect.stringContaining("Gamma body"),
      title: "Section Gamma"
    }));
    expect(sections[0]?.to).toBe(sections[2]?.from);
  });

  it("keeps an applied block markdown preview cleared when the replacement still contains the original heading text", async () => {
    const { container, editor, view } = await renderEditor("### Section Alpha\n\nOld body\n\nTail");
    const from = findTextPosition(view, "Section Alpha");
    const result = {
      from,
      original: "Section Alpha",
      replacement: [
        "### Section Alpha",
        "",
        "| Field | Variant One | Variant Two |",
        "| ----- | ----------- | ----------- |",
        "| Sync note | None | Needs source token (new-token) |"
      ].join("\n"),
      to: from + "Section Alpha".length,
      type: "replace" as const
    };
    const parseMarkdown = editor.action((ctx) => ctx.get(parserCtx));

    showAiEditorPreview(view, result);
    expect(applyAiEditorResult(view, result, { parseMarkdown })).toBe(true);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();

    const tailPosition = findTextPosition(view, "Tail", "Tail".length);
    view.dispatch(view.state.tr.insertText(" updated", tailPosition, tailPosition));

    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();
    await settleMarkdownListener();
  });

  it("notifies when the user selects text in the editor", async () => {
    const onTextSelectionChange = vi.fn();
    const { view } = await renderEditor("First sentence. Second sentence.", { onTextSelectionChange });
    const from = findTextPosition(view, "Second");
    const to = from + "Second sentence.".length;

    selectText(view, from, to);

    expect(onTextSelectionChange).toHaveBeenCalledWith({
      from,
      source: "selection",
      text: "Second sentence.",
      to
    });
  });

  it("falls back to the current text block when the editor text selection is cleared", async () => {
    const onTextSelectionChange = vi.fn();
    const { view } = await renderEditor("First sentence. Second sentence.", { onTextSelectionChange });
    const from = findTextPosition(view, "Second");
    const to = from + "Second sentence.".length;

    view.focus();
    selectText(view, from, to);
    moveCursor(view, from);

    expect(onTextSelectionChange).toHaveBeenLastCalledWith({
      cursor: from,
      from: 1,
      source: "block",
      text: "First sentence. Second sentence.",
      to: "First sentence. Second sentence.".length + 1
    });
  });

  it("keeps the active text selection when focus moves out of the editor", async () => {
    const onTextSelectionChange = vi.fn();
    const outsideInput = document.createElement("textarea");
    document.body.append(outsideInput);
    const { view } = await renderEditor("First sentence. Second sentence.", { onTextSelectionChange });
    const from = findTextPosition(view, "Second");
    const to = from + "Second sentence.".length;

    view.focus();
    selectText(view, from, to);
    outsideInput.focus();
    moveCursor(view, to);

    expect(onTextSelectionChange).not.toHaveBeenLastCalledWith(null);
    outsideInput.remove();
  });

  it("uses the current text block as AI context when no text is selected", async () => {
    const { view } = await renderEditor("# Title\n\nFirst paragraph.\n\nSecond paragraph.");
    const from = findTextPosition(view, "First paragraph.");
    const to = from + "First paragraph.".length;

    moveCursor(view, findTextPosition(view, "paragraph", 2));

    expect(readAiSelectionContextFromView(view)).toEqual({
      cursor: findTextPosition(view, "paragraph", 2),
      from,
      source: "block",
      text: "First paragraph.",
      to
    });
    await settleMarkdownListener();
  });

  it("reports the current text block through the selection callback when only the cursor moves", async () => {
    const onTextSelectionChange = vi.fn();
    const { view } = await renderEditor("# Title\n\nFirst paragraph.\n\nSecond paragraph.", { onTextSelectionChange });

    view.focus();
    moveCursor(view, findTextPosition(view, "paragraph", 2));

    expect(onTextSelectionChange).toHaveBeenLastCalledWith({
      cursor: findTextPosition(view, "paragraph", 2),
      from: findTextPosition(view, "First paragraph."),
      source: "block",
      text: "First paragraph.",
      to: findTextPosition(view, "First paragraph.") + "First paragraph.".length
    });
    await settleMarkdownListener();
  });

  it("restores the pending AI comparison when undoing an applied suggestion", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };

    showAiEditorPreview(view, result);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");

    expect(applyAiEditorResult(view, result)).toBe(true);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("Improved text");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();

    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Original");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-delete")).toHaveTextContent("Original");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toBeInTheDocument();

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("restores the pending AI comparison in a heading after undoing an applied suggestion", async () => {
    const { container, view } = await renderEditor("# Original title\n\nBody");
    const from = findTextPosition(view, "Original title");
    const result = {
      from,
      original: "Original title",
      replacement: "Improved title",
      to: from + "Original title".length,
      type: "replace" as const
    };

    showAiEditorPreview(view, result);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved title");

    expect(applyAiEditorResult(view, result)).toBe(true);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();

    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    const insertedPreview = container.querySelector(".ProseMirror .markra-ai-preview-insert");

    expect(container.querySelector(".ProseMirror .markra-ai-preview-delete")).toHaveTextContent("Original title");
    expect(insertedPreview).toHaveTextContent("Improved title");
    expect(insertedPreview?.closest("h1")).toBeInTheDocument();
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toBeInTheDocument();

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("notifies the app when undo restores an applied AI comparison", async () => {
    const { view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };
    const onRestore = vi.fn();

    window.addEventListener(AI_EDITOR_PREVIEW_RESTORE_EVENT, onRestore);

    showAiEditorPreview(view, result);
    expect(applyAiEditorResult(view, result)).toBe(true);
    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          result
        })
      })
    );

    window.removeEventListener(AI_EDITOR_PREVIEW_RESTORE_EVENT, onRestore);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("keeps an AI selection highlight visible after the editor loses its native selection", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const selection = {
      from,
      text: "Original",
      to: from + "Original".length
    };

    showAiSelectionHold(view, selection);
    expect(container.querySelector(".ProseMirror .markra-ai-selection-hold")).toHaveTextContent("Original");

    moveCursor(view, selection.to);

    expect(container.querySelector(".ProseMirror .markra-ai-selection-hold")).toHaveTextContent("Original");

    clearAiSelectionHold(view);

    expect(container.querySelector(".ProseMirror .markra-ai-selection-hold")).not.toBeInTheDocument();
    await settleMarkdownListener();
  });

  it("can apply a restored AI comparison and undo it back to pending again", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };
    const onPreviewAction = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<AiEditorPreviewActionDetail>).detail;
      if (detail.action === "apply") applyAiEditorResult(view, detail.result, { previewId: detail.previewId });
    });

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);

    showAiEditorPreview(view, result);
    expect(applyAiEditorResult(view, result)).toBe(true);
    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    container.querySelector<HTMLButtonElement>(".ProseMirror .markra-ai-preview-apply")?.click();

    expect(onPreviewAction).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "apply",
          result
        })
      })
    );
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("Improved text");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();

    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    expect(container.querySelector(".ProseMirror .markra-ai-preview-delete")).toHaveTextContent("Original");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toBeInTheDocument();

    window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("clears a stale pending preview after the applied result is confirmed", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };

    showAiEditorPreview(view, result);
    expect(applyAiEditorResult(view, result)).toBe(true);

    showAiEditorPreview(view, result);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");

    confirmAiEditorResultApplied(view, result);

    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();

    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("dispatches an applied acknowledgement when an AI preview is applied", async () => {
    const { view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };
    const onApplied = vi.fn((event: Event) => (event as CustomEvent<AiEditorPreviewAppliedDetail>).detail);

    window.addEventListener(AI_EDITOR_PREVIEW_APPLIED_EVENT, onApplied);
    showAiEditorPreview(view, result);

    expect(applyAiEditorResult(view, result)).toBe(true);

    expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        result
      })
    }));

    window.removeEventListener(AI_EDITOR_PREVIEW_APPLIED_EVENT, onApplied);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("logs preview queue details when a block insert preview is applied", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const { view } = await renderEditor("# Alpha\n\nBody");
    const afterAlpha = findTextPosition(view, "Alpha") + "Alpha".length;
    const result = {
      from: afterAlpha,
      original: "",
      replacement: "\n\n## Follow-up\n\nGenerated block.",
      to: afterAlpha,
      type: "insert" as const
    };

    showAiEditorPreview(view, result, undefined, { previewId: "follow-up-preview" });
    expect(applyAiEditorResult(view, result, { previewId: "follow-up-preview" })).toBe(true);

    expect(debugSpy.mock.calls).toEqual(expect.arrayContaining([
      [
        "[markra-ai-preview] plugin apply meta",
        expect.objectContaining({
          appliedPreviewId: "follow-up-preview",
          pendingCount: 0
        })
      ]
    ]));

    debugSpy.mockRestore();
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("keeps AI preview actions clickable after mousedown inside the editor widget", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };
    const onPreviewAction = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<AiEditorPreviewActionDetail>).detail;
      if (detail.action === "apply") applyAiEditorResult(view, detail.result, { previewId: detail.previewId });
    });

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    showAiEditorPreview(view, result);

    const applyButton = container.querySelector<HTMLButtonElement>(".ProseMirror .markra-ai-preview-apply");
    expect(applyButton).toBeInTheDocument();

    applyButton?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    applyButton?.click();

    expect(onPreviewAction).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "apply",
          result
        })
      })
    );
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("Improved text");

    window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("applies an AI preview action directly on pointerdown for editor widgets", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };
    const onPreviewAction = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<AiEditorPreviewActionDetail>).detail;
      if (detail.action === "apply") applyAiEditorResult(view, detail.result, { previewId: detail.previewId });
    });

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    showAiEditorPreview(view, result);

    const applyButton = container.querySelector<HTMLButtonElement>(".ProseMirror .markra-ai-preview-apply");
    expect(applyButton).toBeInTheDocument();

    applyButton?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));

    expect(onPreviewAction).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "apply",
          result
        })
      })
    );
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("Improved text");

    window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("marks the AI preview apply action busy and prevents repeated dispatches", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };
    const onPreviewAction = vi.fn();

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    showAiEditorPreview(view, result);

    const applyButton = container.querySelector<HTMLButtonElement>(".ProseMirror .markra-ai-preview-apply");
    expect(applyButton).toBeInTheDocument();

    applyButton?.click();
    applyButton?.click();

    expect(onPreviewAction).toHaveBeenCalledTimes(1);
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute("aria-busy", "true");
    expect(applyButton).toHaveClass("markra-ai-preview-applying");
    expect(applyButton?.querySelector(".markra-ai-preview-spinner")).toBeInTheDocument();

    window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("keeps remaining AI previews visible after applying one of multiple insertions", async () => {
    const { container, view } = await renderEditor("# Alpha\n\nBeta");
    const afterAlpha = findTextPosition(view, "Alpha") + "Alpha".length;
    const beforeBeta = findTextPosition(view, "Beta");
    const firstResult = {
      from: afterAlpha,
      original: "",
      replacement: "\n\n## Intro",
      to: afterAlpha,
      type: "insert" as const
    };
    const secondResult = {
      from: beforeBeta,
      original: "",
      replacement: "## Summary\n\n",
      to: beforeBeta,
      type: "insert" as const
    };
    const onPreviewAction = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<AiEditorPreviewActionDetail>).detail;
      if (detail.action === "apply") applyAiEditorResult(view, detail.result, { previewId: detail.previewId });
    });

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    showAiEditorPreview(view, firstResult);
    showAiEditorPreview(view, secondResult);

    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(2);

    const applyButtons = container.querySelectorAll<HTMLButtonElement>(".ProseMirror .markra-ai-preview-apply");
    expect(applyButtons).toHaveLength(2);

    applyButtons[0]?.click();

    expect(onPreviewAction).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          action: "apply",
          result: firstResult
        })
      })
    );
    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(1);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("## Summary");
    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Intro");

    window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("keeps separate AI insert previews at the same position when preview ids differ", async () => {
    const { container, view } = await renderEditor("# Alpha");
    const documentEnd = view.state.doc.content.size;
    const firstResult = {
      from: documentEnd,
      original: "",
      replacement: "\n\n## Intro",
      to: documentEnd,
      type: "insert" as const
    };
    const secondResult = {
      from: documentEnd,
      original: "",
      replacement: "\n\n## Summary",
      to: documentEnd,
      type: "insert" as const
    };

    showAiEditorPreview(view, firstResult, undefined, { previewId: "intro-preview" });
    showAiEditorPreview(view, secondResult, undefined, { previewId: "summary-preview" });

    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(2);
    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Intro");
    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Summary");

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("applies identical insert previews independently when their preview ids differ", async () => {
    const { container, view } = await renderEditor("# Alpha");
    const documentEnd = view.state.doc.content.size;
    const sharedResult = {
      from: documentEnd,
      original: "",
      replacement: "\n\n## Follow-up",
      to: documentEnd,
      type: "insert" as const
    };
    const onPreviewAction = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<AiEditorPreviewActionDetail>).detail;
      if (detail.action === "apply") applyAiEditorResult(view, detail.result, { previewId: detail.previewId });
    });

    window.addEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    showAiEditorPreview(view, sharedResult, undefined, { previewId: "follow-up-a" });
    showAiEditorPreview(view, sharedResult, undefined, { previewId: "follow-up-b" });

    const applyButtons = container.querySelectorAll<HTMLButtonElement>(".ProseMirror .markra-ai-preview-apply");
    expect(applyButtons).toHaveLength(2);

    applyButtons[0]?.click();

    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(1);
    expect(container.querySelector(".ProseMirror")?.textContent).toContain("Follow-up");

    applyButtons[1]?.click();

    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(0);
    expect((container.querySelector(".ProseMirror")?.textContent?.match(/Follow-up/g) ?? []).length).toBe(2);

    window.removeEventListener(AI_EDITOR_PREVIEW_ACTION_EVENT, onPreviewAction);
    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("does not restore a block insert preview after later document changes", async () => {
    const { container, view } = await renderEditor("# Alpha\n\nBody");
    const afterAlpha = findTextPosition(view, "Alpha") + "Alpha".length;
    const result = {
      from: afterAlpha,
      original: "",
      replacement: "\n\n## Follow-up\n\nGenerated block.",
      to: afterAlpha,
      type: "insert" as const
    };

    showAiEditorPreview(view, result, undefined, { previewId: "follow-up-preview" });
    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(1);

    expect(applyAiEditorResult(view, result, { previewId: "follow-up-preview" })).toBe(true);
    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(0);

    view.dispatch(view.state.tr.insertText(" ", view.state.doc.content.size, view.state.doc.content.size));

    expect(container.querySelectorAll(".ProseMirror .markra-ai-preview-insert")).toHaveLength(0);

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("can reject an AI comparison and undo it back to pending again", async () => {
    const { container, view } = await renderEditor("Original text");
    const from = findTextPosition(view, "Original");
    const result = {
      from,
      original: "Original",
      replacement: "Improved",
      to: from + "Original".length,
      type: "replace" as const
    };

    showAiEditorPreview(view, result);
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");

    clearAiEditorPreview(view);

    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).not.toBeInTheDocument();

    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    expect(container.querySelector(".ProseMirror .markra-ai-preview-delete")).toHaveTextContent("Original");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-insert")).toHaveTextContent("Improved");
    expect(container.querySelector(".ProseMirror .markra-ai-preview-actions")).toBeInTheDocument();

    clearAiEditorPreview(view);
    await settleMarkdownListener();
  });

  it("turns typed strong markdown into bold text", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "**a**");

    expectLiveMark(container, "strong", "a");
    expectMarkdownDelimiters(container, 2);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("**a**");

    expect(pressEnter(view)).toBe(true);

    const strong = container.querySelector(".ProseMirror strong");
    expect(strong).toHaveTextContent("a");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("a");
    await settleMarkdownListener();
  });

  it("supports inline markdown formatting shortcuts", async () => {
    const strong = await renderEditor();
    typeText(strong.view, "bold");
    selectText(strong.view, 1, 5);

    expect(pressShortcut(strong.view, "b", { metaKey: true })).toBe(true);

    expect(strong.container.querySelector(".ProseMirror strong")).toHaveTextContent("bold");

    const emphasis = await renderEditor();
    typeText(emphasis.view, "italic");
    selectText(emphasis.view, 1, 7);

    expect(pressShortcut(emphasis.view, "i", { metaKey: true })).toBe(true);

    expect(emphasis.container.querySelector(".ProseMirror em")).toHaveTextContent("italic");

    const strikethrough = await renderEditor();
    typeText(strikethrough.view, "strike");
    selectText(strikethrough.view, 1, 7);

    expect(pressShortcut(strikethrough.view, "x", { metaKey: true, shiftKey: true })).toBe(true);

    expect(strikethrough.container.querySelector(".ProseMirror del")).toHaveTextContent("strike");

    const inlineCode = await renderEditor();
    typeText(inlineCode.view, "code");
    selectText(inlineCode.view, 1, 5);

    expect(pressShortcut(inlineCode.view, "e", { metaKey: true })).toBe(true);

    expect(inlineCode.container.querySelector(".ProseMirror code")).toHaveTextContent("code");
    await settleMarkdownListener();
  });

  it("supports block markdown formatting shortcuts", async () => {
    const heading = await renderEditor();
    typeText(heading.view, "Heading");

    expect(pressShortcut(heading.view, "2", { metaKey: true, altKey: true })).toBe(true);

    expect(heading.container.querySelector(".ProseMirror h2")).toHaveTextContent("Heading");

    const bullet = await renderEditor();
    typeText(bullet.view, "Bullet");

    expect(pressShortcut(bullet.view, "8", { metaKey: true, shiftKey: true })).toBe(true);

    expect(bullet.container.querySelector(".ProseMirror ul li")).toHaveTextContent("Bullet");

    const ordered = await renderEditor();
    typeText(ordered.view, "Ordered");

    expect(pressShortcut(ordered.view, "7", { metaKey: true, shiftKey: true })).toBe(true);

    expect(ordered.container.querySelector(".ProseMirror ol li")).toHaveTextContent("Ordered");

    const quote = await renderEditor();
    typeText(quote.view, "Quote");

    expect(pressShortcut(quote.view, "b", { metaKey: true, shiftKey: true })).toBe(true);

    expect(quote.container.querySelector(".ProseMirror blockquote")).toHaveTextContent("Quote");
    await settleMarkdownListener();
  });

  it("supports undo and redo shortcuts", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "undoable");

    expect(container.querySelector(".ProseMirror")?.textContent).toBe("undoable");

    expect(pressShortcut(view, "z", { metaKey: true })).toBe(true);

    expect(container.querySelector(".ProseMirror")?.textContent).toBe("");

    expect(pressShortcut(view, "z", { metaKey: true, shiftKey: true })).toBe(true);

    expect(container.querySelector(".ProseMirror")?.textContent).toBe("undoable");
    await settleMarkdownListener();
  });

  it("turns typed strong markdown into bold text after existing prose", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "后**a**");

    expectLiveMark(container, "strong", "a");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("后**a**");

    expect(pressEnter(view)).toBe(true);

    const strong = container.querySelector(".ProseMirror strong");
    expect(strong).toHaveTextContent("a");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("后a");
    await settleMarkdownListener();
  });

  it("turns typed strong markdown into bold text after latin prose", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "after**a**");

    expectLiveMark(container, "strong", "a");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("after**a**");

    expect(pressEnter(view)).toBe(true);

    const strong = container.querySelector(".ProseMirror strong");
    expect(strong).toHaveTextContent("a");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("aftera");
    await settleMarkdownListener();
  });

  it("turns typed strong emphasis markdown into bold italic text", async () => {
    const stars = await renderEditor();
    typeText(stars.view, "***粗斜体文本***");

    expectLiveStrongEmphasis(stars.container, "粗斜体文本");
    expectMarkdownDelimiters(stars.container, 2);
    expect(stars.container.querySelector(".ProseMirror")?.textContent).toBe("***粗斜体文本***");

    expect(pressEnter(stars.view)).toBe(true);

    expect(stars.container.querySelector(".ProseMirror strong")).toHaveTextContent("粗斜体文本");
    expect(stars.container.querySelector(".ProseMirror em")).toHaveTextContent("粗斜体文本");
    expect(stars.container.querySelector(".ProseMirror")?.textContent).toBe("粗斜体文本");

    const underscores = await renderEditor();
    typeText(underscores.view, "___粗斜体文本___");

    expectLiveStrongEmphasis(underscores.container, "粗斜体文本");
    expectMarkdownDelimiters(underscores.container, 2);
    expect(underscores.container.querySelector(".ProseMirror")?.textContent).toBe("___粗斜体文本___");

    expect(pressEnter(underscores.view)).toBe(true);

    expect(underscores.container.querySelector(".ProseMirror strong")).toHaveTextContent("粗斜体文本");
    expect(underscores.container.querySelector(".ProseMirror em")).toHaveTextContent("粗斜体文本");
    expect(underscores.container.querySelector(".ProseMirror")?.textContent).toBe("粗斜体文本");
    await settleMarkdownListener();
  });

  it("turns filled strong emphasis delimiters into bold italic text", async () => {
    const stars = await renderEditor();
    typeText(stars.view, "******");
    moveCursor(stars.view, 4);
    typeText(stars.view, "2");

    expectLiveStrongEmphasis(stars.container, "2");
    expectMarkdownDelimiters(stars.container, 2);
    expect(stars.container.querySelector(".ProseMirror")?.textContent).toBe("***2***");

    expect(pressEnter(stars.view)).toBe(true);

    expect(stars.container.querySelector(".ProseMirror strong")).toHaveTextContent("2");
    expect(stars.container.querySelector(".ProseMirror em")).toHaveTextContent("2");
    expect(stars.container.querySelector(".ProseMirror")?.textContent).toBe("2");

    const underscores = await renderEditor();
    typeText(underscores.view, "______");
    moveCursor(underscores.view, 4);
    typeText(underscores.view, "2");

    expectLiveStrongEmphasis(underscores.container, "2");
    expectMarkdownDelimiters(underscores.container, 2);
    expect(underscores.container.querySelector(".ProseMirror")?.textContent).toBe("___2___");

    expect(pressEnter(underscores.view)).toBe(true);

    expect(underscores.container.querySelector(".ProseMirror strong")).toHaveTextContent("2");
    expect(underscores.container.querySelector(".ProseMirror em")).toHaveTextContent("2");
    expect(underscores.container.querySelector(".ProseMirror")?.textContent).toBe("2");
    await settleMarkdownListener();
  });

  it("reveals folded markdown delimiters when the cursor returns to a formatted edge", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "~~123~~");

    expectLiveMark(container, "strikethrough", "123");
    expectMarkdownDelimiterText(container, "~~");

    expect(pressEnter(view)).toBe(true);

    expect(container.querySelector(".ProseMirror del")).toHaveTextContent("123");
    expectMarkdownDelimiters(container, 0);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("123");

    moveCursor(view, 1);
    moveCursor(view, 4);

    expectMarkdownDelimiterText(container, "~~");
    expect(container.querySelector(".ProseMirror del")).toHaveTextContent("123");
    await settleMarkdownListener();
  });

  it("hides folded markdown delimiters after the cursor moves to other text", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "~~around~~ selected text");

    expectLiveMark(container, "strikethrough", "around");
    expectMarkdownDelimiters(container, 0);

    moveCursor(view, findTextPosition(view, "around", "around".length));
    expectMarkdownDelimiterText(container, "~~");

    moveCursor(view, findTextPosition(view, "selected", "selected".length));

    expectMarkdownDelimiters(container, 0);
    await settleMarkdownListener();
  });

  it("moves the cursor over live markdown delimiters as a single visible step", async () => {
    const { view } = await renderEditor();

    typeText(view, "~~around~~");

    moveCursor(view, 1);
    expect(pressArrowRight(view)).toBe(true);
    expect(view.state.selection.from).toBe(3);

    moveCursor(view, 2);
    expect(pressArrowRight(view)).toBe(true);
    expect(view.state.selection.from).toBe(3);

    moveCursor(view, 9);
    expect(pressArrowRight(view)).toBe(true);
    expect(view.state.selection.from).toBe(11);

    moveCursor(view, 10);
    expect(pressArrowRight(view)).toBe(true);
    expect(view.state.selection.from).toBe(11);

    moveCursor(view, 11);
    expect(pressArrowLeft(view)).toBe(true);
    expect(view.state.selection.from).toBe(9);

    moveCursor(view, 3);
    expect(pressArrowLeft(view)).toBe(true);
    expect(view.state.selection.from).toBe(1);
    await settleMarkdownListener();
  });

  it("keeps the cursor on the visible text edge when collapsing a live markdown mark", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "~~a~~b");
    moveCursor(view, 6);

    expect(pressArrowRight(view)).toBe(true);

    expect(view.state.selection.from).toBe(4);
    expectMarkdownDelimiters(container, 0);
    expectHiddenMarkdownDelimiters(container, 2);

    expect(pressArrowRight(view)).toBe(true);

    expect(view.state.selection.from).toBe(7);
    expectMarkdownDelimiters(container, 0);
    expectHiddenMarkdownDelimiters(container, 2);

    expect(pressArrowRight(view)).toBeUndefined();
    expect(view.state.selection.from).toBe(7);
    expectMarkdownDelimiters(container, 0);
    expectHiddenMarkdownDelimiters(container, 2);
    await settleMarkdownListener();
  });

  it("turns filled strong delimiters into bold text", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "****");
    moveCursor(view, 3);
    typeText(view, "2");

    expectLiveMark(container, "strong", "2");
    expectMarkdownDelimiters(container, 2);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("**2**");

    expect(pressEnter(view)).toBe(true);

    const strong = container.querySelector(".ProseMirror strong");
    expect(strong).toHaveTextContent("2");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("2");
    await settleMarkdownListener();
  });

  it("turns filled underscore strong delimiters into bold text", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "____");
    moveCursor(view, 3);
    typeText(view, "2");

    expectLiveMark(container, "strong", "2");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("__2__");

    expect(pressEnter(view)).toBe(true);

    const strong = container.querySelector(".ProseMirror strong");
    expect(strong).toHaveTextContent("2");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("2");
    await settleMarkdownListener();
  });

  it("turns filled inline delimiters into styled marks", async () => {
    const emphasis = await renderEditor();
    typeText(emphasis.view, "**");
    moveCursor(emphasis.view, 2);
    typeText(emphasis.view, "2");

    expectLiveMark(emphasis.container, "emphasis", "2");
    expect(emphasis.container.querySelector(".ProseMirror")?.textContent).toBe("*2*");

    expect(pressEnter(emphasis.view)).toBe(true);

    expect(emphasis.container.querySelector(".ProseMirror em")).toHaveTextContent("2");
    expect(emphasis.container.querySelector(".ProseMirror")?.textContent).toBe("2");

    const underscoreEmphasis = await renderEditor();
    typeText(underscoreEmphasis.view, "__");
    moveCursor(underscoreEmphasis.view, 2);
    typeText(underscoreEmphasis.view, "2");

    expectLiveMark(underscoreEmphasis.container, "emphasis", "2");
    expect(underscoreEmphasis.container.querySelector(".ProseMirror")?.textContent).toBe("_2_");

    expect(pressEnter(underscoreEmphasis.view)).toBe(true);

    expect(underscoreEmphasis.container.querySelector(".ProseMirror em")).toHaveTextContent("2");
    expect(underscoreEmphasis.container.querySelector(".ProseMirror")?.textContent).toBe("2");

    const inlineCode = await renderEditor();
    typeText(inlineCode.view, "``");
    moveCursor(inlineCode.view, 2);
    typeText(inlineCode.view, "2");

    expectLiveMark(inlineCode.container, "inlineCode", "2");
    expect(inlineCode.container.querySelector(".ProseMirror")?.textContent).toBe("`2`");

    expect(pressEnter(inlineCode.view)).toBe(true);

    expect(inlineCode.container.querySelector(".ProseMirror code")).toHaveTextContent("2");
    expect(inlineCode.container.querySelector(".ProseMirror")?.textContent).toBe("2");

    const strikethrough = await renderEditor();
    typeText(strikethrough.view, "~~~~");

    expect(strikethrough.container.querySelector(".ProseMirror")?.textContent).toBe("~~~~");
    expectHiddenMarkdownDelimiters(strikethrough.container, 0);

    moveCursor(strikethrough.view, 3);
    typeText(strikethrough.view, "2");

    expectLiveMark(strikethrough.container, "strikethrough", "2");
    expect(strikethrough.container.querySelector(".ProseMirror")?.textContent).toBe("~~2~~");

    expect(pressEnter(strikethrough.view)).toBe(true);

    expect(strikethrough.container.querySelector(".ProseMirror del")).toHaveTextContent("2");
    expect(strikethrough.container.querySelector(".ProseMirror")?.textContent).toBe("2");
    await settleMarkdownListener();
  });

  it("keeps typing inside filled inline delimiters styled", async () => {
    const strong = await renderEditor();
    typeText(strong.view, "****");
    moveCursor(strong.view, 3);
    typeText(strong.view, "23");

    expectLiveMark(strong.container, "strong", "23");
    expect(strong.container.querySelector(".ProseMirror")?.textContent).toBe("**23**");

    expect(pressEnter(strong.view)).toBe(true);

    expect(strong.container.querySelector(".ProseMirror strong")).toHaveTextContent("23");
    expect(strong.container.querySelector(".ProseMirror")?.textContent).toBe("23");

    const inlineCode = await renderEditor();
    typeText(inlineCode.view, "``");
    moveCursor(inlineCode.view, 2);
    typeText(inlineCode.view, "23");

    expectLiveMark(inlineCode.container, "inlineCode", "23");
    expect(inlineCode.container.querySelector(".ProseMirror")?.textContent).toBe("`23`");

    expect(pressEnter(inlineCode.view)).toBe(true);

    expect(inlineCode.container.querySelector(".ProseMirror code")).toHaveTextContent("23");
    expect(inlineCode.container.querySelector(".ProseMirror")?.textContent).toBe("23");
    await settleMarkdownListener();
  });

  it("turns typed markdown shortcuts into styled document nodes", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "## Title");

    expect(container.querySelector(".ProseMirror h2")).toHaveTextContent("Title");
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("Title");
    await settleMarkdownListener();
  });

  it("renders GFM markdown tables as document tables", async () => {
    const { container } = await renderEditor("| Name | Role |\n| --- | --- |\n| Markra | Editor |");

    const table = container.querySelector(".ProseMirror table");

    expect(table).toBeInTheDocument();
    expect(table?.querySelectorAll("th")).toHaveLength(2);
    expect(table?.querySelectorAll("td")).toHaveLength(2);
    expect(table).toHaveTextContent("Name");
    expect(table).toHaveTextContent("Editor");
  });

  it("renders links and images from existing markdown", async () => {
    const { container } = await renderEditor(
      "[Markra](https://example.com)\n\n![Markra logo](https://example.com/logo.png)"
    );

    const link = container.querySelector<HTMLAnchorElement>('.ProseMirror a[href="https://example.com"]');
    const image = container.querySelector<HTMLImageElement>('.ProseMirror img[src="https://example.com/logo.png"]');

    expect(link).toHaveTextContent("Markra");
    expectLinkIconCount(container, 1);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "Markra logo");
    await settleMarkdownListener();
  });

  it("keeps normal finalized link clicks editable and opens links with a modifier click", async () => {
    const openExternalUrl = vi.fn();
    const modifierCase = await renderEditor("[Markra](https://example.com)", { openExternalUrl });

    const modifierLink = modifierCase.container.querySelector<HTMLAnchorElement>(
      '.ProseMirror a[href="https://example.com"]'
    );
    expect(modifierLink).toBeInTheDocument();

    expect(fireEvent.mouseDown(modifierLink!, { metaKey: true })).toBe(false);
    modifierLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));

    expect(openExternalUrl).toHaveBeenCalledWith("https://example.com");
    expect(modifierCase.container.querySelector(".ProseMirror")?.textContent).toBe("Markra");

    const editCase = await renderEditor("[Markra](https://example.com)", { openExternalUrl });
    const editableLink = editCase.container.querySelector<HTMLAnchorElement>('.ProseMirror a[href="https://example.com"]');
    const editableSurface = editCase.container.querySelector<HTMLElement>(".ProseMirror");
    expect(editableLink).toBeInTheDocument();
    expect(editableSurface).not.toHaveClass("markra-link-open-modifier-active");

    fireEvent.keyDown(editableSurface!, { key: "Meta", metaKey: true });

    expect(editableSurface).toHaveClass("markra-link-open-modifier-active");

    fireEvent.keyUp(editableSurface!, { key: "Meta" });

    expect(editableSurface).not.toHaveClass("markra-link-open-modifier-active");

    expect(fireEvent.dragStart(editableLink!)).toBe(false);
    editableLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    expect(editCase.container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://example.com)");
    expectActiveSourceLinkLabel(editCase.container, "Markra");
    expect(editCase.container.querySelector(".ProseMirror .markra-live-link-mark-source-text")).not.toBeInTheDocument();
  });

  it("expands finalized links into editable markdown source", async () => {
    const { container, editor, view } = await renderEditor("[Markra](https://example.com) after");

    const link = container.querySelector<HTMLAnchorElement>('.ProseMirror a[href="https://example.com"]');
    expect(link).toBeInTheDocument();
    expectLinkIconCount(container, 1);

    expect(fireEvent.dragStart(link!)).toBe(false);
    link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    expectLinkIconCount(container, 0);
    expect(container.querySelector(".ProseMirror .markra-live-link-mark-source-text")).not.toBeInTheDocument();
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://example.com) after");
    expectActiveSourceLinkLabel(container, "Markra");

    const hrefFrom = findTextPosition(view, "https://example.com");
    selectText(view, hrefFrom, hrefFrom + "https://example.com".length);

    expect(container.querySelectorAll(".ProseMirror .markra-live-link-source.markra-md-delimiter")).toHaveLength(2);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://example.com) after");

    insertTextDirectly(view, "https://edited.example");

    expect(container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://edited.example) after");
    expect(pressEnter(view)).toBe(true);
    expect(container.querySelector<HTMLAnchorElement>('.ProseMirror a[href="https://edited.example"]')).toHaveTextContent(
      "Markra"
    );

    const serializeMarkdown = editor.action((ctx) => ctx.get(serializerCtx));
    expect(serializeMarkdown(view.state.doc)).toContain("[Markra](https://edited.example)");
  });

  it("serializes edited expanded links as markdown instead of escaped text", async () => {
    const onMarkdownChange = vi.fn();
    const { container, view } = await renderEditor("[关于我们](https://m.techflowpost.com/article/9424)", {
      onMarkdownChange
    });

    const link = container.querySelector<HTMLAnchorElement>(
      '.ProseMirror a[href="https://m.techflowpost.com/article/9424"]'
    );
    expect(link).toBeInTheDocument();

    link?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const labelFrom = findTextPosition(view, "关于我们");
    selectText(view, labelFrom, labelFrom + "关于我们".length);
    insertTextDirectly(view, "是关于我们");

    await waitFor(() => {
      expect(
        onMarkdownChange.mock.calls.some(([markdown]) =>
          String(markdown).includes("[是关于我们](https://m.techflowpost.com/article/9424)")
        )
      ).toBe(true);
    });

    const latestMarkdown = String(onMarkdownChange.mock.calls.at(-1)?.[0] ?? "");
    expect(latestMarkdown).not.toContain("\\[是关于我们\\]");
    expect(latestMarkdown).not.toContain("\\(https\\://m.techflowpost.com/article/9424\\)");
  });

  it("renders local image markdown with resolved preview sources", async () => {
    const { container } = await renderEditor("![Screenshot](assets/pasted-image.png)", {
      resolveImageSrc: (src) => `asset://current-note/${src}`
    });

    const image = container.querySelector<HTMLImageElement>(
      '.ProseMirror img[src="asset://current-note/assets/pasted-image.png"]'
    );
    const imageNode = image?.closest<HTMLElement>(".markra-image-node");

    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "Screenshot");
    expect(imageNode?.draggable).toBe(false);
    expect(image?.draggable).toBe(false);
    expect(fireEvent.dragStart(imageNode!)).toBe(false);
  });

  it("shows finalized image markdown source when the image is clicked", async () => {
    const { container, editor, view } = await renderEditor("![Screenshot](assets/pasted-image.png)");

    const image = container.querySelector<HTMLImageElement>('.ProseMirror img[src="assets/pasted-image.png"]');
    expect(image).toBeInTheDocument();

    expect(fireEvent.mouseDown(image!)).toBe(false);

    const sourceRow = container.querySelector<HTMLElement>(".ProseMirror .markra-image-node-source-row");
    expect(sourceRow?.querySelector(".markra-image-node-source-icon")).toHaveAttribute("aria-hidden", "true");

    const source = container.querySelector<HTMLInputElement>(".ProseMirror .markra-image-node-source");
    expect(source).toHaveValue("![Screenshot](assets/pasted-image.png)");
    expect(image?.closest(".markra-image-node")).not.toHaveClass("ProseMirror-selectednode");

    fireEvent.change(source!, { target: { value: "![Edited screenshot](assets/edited.png)" } });

    expect(source).toHaveValue("![Edited screenshot](assets/edited.png)");
    expect(container.querySelector<HTMLImageElement>('.ProseMirror img[src="assets/edited.png"]')).toBeInTheDocument();

    const serializeMarkdown = editor.action((ctx) => ctx.get(serializerCtx));
    expect(serializeMarkdown(view.state.doc)).toContain("![Edited screenshot](assets/edited.png)");
  });

  it("hides finalized image markdown source when another editor area is pressed", async () => {
    const { container } = await renderEditor("Intro\n\n![Screenshot](assets/pasted-image.png)");

    const image = container.querySelector<HTMLImageElement>('.ProseMirror img[src="assets/pasted-image.png"]');
    expect(image).toBeInTheDocument();

    expect(fireEvent.mouseDown(image!)).toBe(false);
    expect(container.querySelector(".ProseMirror .markra-image-node-source")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(container.querySelector(".ProseMirror .markra-image-node-source")).not.toBeInTheDocument();
  });

  it("keeps typed link markdown editable and styles the label live", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "[Markra](https://example.com)");

    expectActiveSourceLinkLabel(container, "Markra");
    expect(container.querySelector('.ProseMirror a[href="https://example.com"]')).not.toBeInTheDocument();
    expect(container.querySelectorAll(".ProseMirror .markra-live-link-source.markra-md-delimiter")).toHaveLength(2);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://example.com)");
    await settleMarkdownListener();
  });

  it("keeps typed image markdown editable until it folds into a live preview", async () => {
    const { container, view } = await renderEditor();

    typeText(view, "![Markra logo](https://example.com/logo.png) after");
    moveCursor(view, findTextPosition(view, "Markra logo", "Markra logo".length));

    expect(container.querySelector(".ProseMirror img.markra-live-image-preview")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".ProseMirror .markra-live-image-source.markra-md-delimiter")).toHaveLength(1);
    expect(container.querySelector(".ProseMirror")?.textContent).toBe(
      "![Markra logo](https://example.com/logo.png) after"
    );

    moveCursor(view, findTextPosition(view, "after", "after".length));

    const image = expectLiveImagePreview(container, "https://example.com/logo.png");
    expect(image).toHaveAttribute("alt", "Markra logo");
    expect(
      container.querySelectorAll(".ProseMirror .markra-live-image-source.markra-md-hidden-delimiter")
    ).toHaveLength(1);
    await settleMarkdownListener();
  });

  it("folds raw link markdown when the cursor leaves the source", async () => {
    const { container, view } = await renderEditor();

    insertTextDirectly(view, "[Markra](https://example.com) after");
    moveCursor(view, findTextPosition(view, "Markra", "Markra".length));

    expectActiveSourceLinkLabel(container, "Markra");
    expectLinkIconCount(container, 0);
    expect(container.querySelectorAll(".ProseMirror .markra-live-link-source.markra-md-delimiter")).toHaveLength(2);

    moveCursor(view, findTextPosition(view, "after", "after".length));

    expectLiveLink(container, "Markra");
    expectLinkIconCount(container, 1);
    expect(container.querySelectorAll(".ProseMirror .markra-live-link-source.markra-md-hidden-delimiter")).toHaveLength(
      2
    );
    expect(container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://example.com) after");
    await settleMarkdownListener();
  });

  it("finalizes raw link and image markdown on enter", async () => {
    const linkCase = await renderEditor();
    insertTextDirectly(linkCase.view, "[Markra](https://example.com)");

    expect(linkCase.container.querySelector(".ProseMirror")?.textContent).toBe("[Markra](https://example.com)");
    expect(pressEnter(linkCase.view)).toBe(true);

    const link = linkCase.container.querySelector<HTMLAnchorElement>('.ProseMirror a[href="https://example.com"]');
    expect(link).toHaveTextContent("Markra");
    expect(linkCase.container.querySelector(".ProseMirror")?.textContent).toBe("Markra");
    expect(linkCase.container.querySelector(".ProseMirror .markra-live-link-mark-source-text")).not.toBeInTheDocument();

    const imageCase = await renderEditor();
    insertTextDirectly(imageCase.view, "![Markra logo](https://example.com/logo.png)");

    expect(imageCase.container.querySelector(".ProseMirror")?.textContent).toBe(
      "![Markra logo](https://example.com/logo.png)"
    );
    expect(pressEnter(imageCase.view)).toBe(true);

    const image = imageCase.container.querySelector<HTMLImageElement>(
      '.ProseMirror img[src="https://example.com/logo.png"]'
    );
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("alt", "Markra logo");
    await settleMarkdownListener();
  });

  it("turns list and quote markdown shortcuts into styled blocks", async () => {
    const bullet = await renderEditor();
    typeText(bullet.view, "- item");

    expect(bullet.container.querySelector(".ProseMirror ul li")).toHaveTextContent("item");
    expect(bullet.container.querySelector(".ProseMirror")?.textContent).toBe("item");

    const ordered = await renderEditor();
    typeText(ordered.view, "1. item");

    expect(ordered.container.querySelector(".ProseMirror ol li")).toHaveTextContent("item");
    expect(ordered.container.querySelector(".ProseMirror")?.textContent).toBe("item");

    const quote = await renderEditor();
    typeText(quote.view, "> quote");

    expect(quote.container.querySelector(".ProseMirror blockquote")).toHaveTextContent("quote");
    expect(quote.container.querySelector(".ProseMirror")?.textContent).toBe("quote");
    await settleMarkdownListener();
  });

  it("turns inline markdown shortcuts into styled marks", async () => {
    const emphasis = await renderEditor();
    typeText(emphasis.view, "after*a*");

    expectLiveMark(emphasis.container, "emphasis", "a");
    expect(emphasis.container.querySelector(".ProseMirror")?.textContent).toBe("after*a*");

    expect(pressEnter(emphasis.view)).toBe(true);

    expect(emphasis.container.querySelector(".ProseMirror em")).toHaveTextContent("a");
    expect(emphasis.container.querySelector(".ProseMirror")?.textContent).toBe("aftera");

    const inlineCode = await renderEditor();
    typeText(inlineCode.view, "use `code`");

    expectLiveMark(inlineCode.container, "inlineCode", "code");
    expect(inlineCode.container.querySelector(".ProseMirror")?.textContent).toBe("use `code`");

    expect(pressEnter(inlineCode.view)).toBe(true);

    expect(inlineCode.container.querySelector(".ProseMirror code")).toHaveTextContent("code");
    expect(inlineCode.container.querySelector(".ProseMirror")?.textContent).toBe("use code");

    const strikethrough = await renderEditor();
    typeText(strikethrough.view, "after~~a~~");

    expectLiveMark(strikethrough.container, "strikethrough", "a");
    expect(strikethrough.container.querySelector(".ProseMirror")?.textContent).toBe("after~~a~~");

    expect(pressEnter(strikethrough.view)).toBe(true);

    expect(strikethrough.container.querySelector(".ProseMirror del")).toHaveTextContent("a");
    expect(strikethrough.container.querySelector(".ProseMirror")?.textContent).toBe("aftera");
    await settleMarkdownListener();
  });
});
