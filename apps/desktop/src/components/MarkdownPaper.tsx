import { type CSSProperties, useCallback, useEffect, useMemo, useRef } from "react";
import { defaultValueCtx, Editor, editorViewCtx, editorViewOptionsCtx, parserCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import {
  commands as commonmarkCommands,
  imageSchema,
  headingSchema,
  inputRules as commonmarkInputRules,
  keymap as commonmarkKeymap,
  linkSchema,
  paragraphSchema,
  plugins as commonmarkPlugins,
  schema as commonmarkSchema
} from "@milkdown/kit/preset/commonmark";
import {
  commands as gfmCommands,
  inputRules as gfmInputRules,
  keymap as gfmKeymap,
  pasteRules as gfmPasteRules,
  plugins as gfmPlugins,
  schema as gfmSchema
} from "@milkdown/kit/preset/gfm";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "@milkdown/react";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { markraLiveMarkdownPlugin } from "@markra/editor";
import {
  markraClipboardImagePluginWithOptions,
  type SaveClipboardImage,
  type SaveRemoteClipboardImage
} from "@markra/editor";
import { markraCodeBlockPlugin } from "@markra/editor";
import { markraHeadingSourcePlugin } from "@markra/editor";
import { normalizeHeadingSourceDocument } from "@markra/editor";
import { markraLinkImageLivePlugin } from "@markra/editor";
import { markraRawHtmlPlugin } from "@markra/editor";
import { serializeLinkImageLiveMarkdown } from "@markra/editor";
import { markraMarkdownShortcuts } from "@markra/editor";
import { normalizeMarkdownShortcuts } from "@markra/editor";
import { markraSlashCommands } from "@markra/editor";
import { markraMathPlugin } from "@markra/editor";
import { markraMathRemarkPlugin } from "@markra/editor";
import { markraMathSourcePlugin } from "@markra/editor";
import { markraTableControlsPlugin } from "@markra/editor";
import { markraAiEditorPreviewPlugin } from "@markra/editor";
import { markraAiSelectionHoldPlugin } from "@markra/editor";
import { markraBlockDragPlugin } from "@markra/editor";
import { markraSmartPastePlugin } from "@markra/editor";
import type { MarkdownShortcutMap } from "@markra/editor";
import type { SlashCommandLabels } from "@markra/editor";
import type { AiSelectionContext } from "@markra/ai";
import { t, type AppLanguage } from "@markra/shared";
import {
  editorContentWidthPixels,
  editorCustomContentWidthMax,
  editorCustomContentWidthMin,
  type EditorContentWidth
} from "../lib/editor-width";
import { readAiSelectionContextFromView } from "../hooks/useEditorController";
import { EditorWidthResizer } from "./EditorWidthResizer";

const markraCommonmark = [
  commonmarkSchema,
  commonmarkInputRules,
  commonmarkCommands,
  commonmarkKeymap,
  commonmarkPlugins
].flat();

const markraGfm = [
  gfmSchema,
  gfmInputRules,
  gfmPasteRules,
  gfmKeymap,
  gfmCommands,
  gfmPlugins
].flat();

function markdownShortcutSignature(shortcuts: MarkdownShortcutMap | undefined) {
  return JSON.stringify(normalizeMarkdownShortcuts(shortcuts));
}

type MarkdownPaperProps = {
  autoFocus?: boolean;
  bottomOverlayInset?: number;
  bodyFontSize?: number;
  contentWidth?: EditorContentWidth;
  contentWidthMax?: number;
  contentWidthMin?: number;
  contentWidthPx?: number | null;
  initialContent: string;
  language?: AppLanguage;
  lineHeight?: number;
  markdownShortcuts?: MarkdownShortcutMap;
  onEditorReady: (editor: Editor | null, options?: { autoFocus?: boolean }) => unknown;
  onMarkdownChange: (content: string) => unknown;
  onContentWidthChange?: (width: number) => unknown;
  onContentWidthResizeEnd?: () => unknown;
  onContentWidthResizeStart?: () => unknown;
  onSaveClipboardImage?: SaveClipboardImage;
  onSaveRemoteClipboardImage?: SaveRemoteClipboardImage;
  openExternalUrl?: (url: string) => unknown;
  onTextSelectionChange?: (selection: AiSelectionContext | null) => unknown;
  resolveImageSrc?: (src: string) => string;
  revision: number;
  topInset?: "tabs" | "titlebar";
};

type MilkdownSurfaceProps = {
  autoFocus: boolean;
  initialContent: string;
  language: AppLanguage;
  onEditorReady: MarkdownPaperProps["onEditorReady"];
  onMarkdownChange: (content: string) => unknown;
  onSaveClipboardImage?: MarkdownPaperProps["onSaveClipboardImage"];
  onSaveRemoteClipboardImage?: MarkdownPaperProps["onSaveRemoteClipboardImage"];
  openExternalUrl?: MarkdownPaperProps["openExternalUrl"];
  onTextSelectionChange?: MarkdownPaperProps["onTextSelectionChange"];
  resolveImageSrc?: MarkdownPaperProps["resolveImageSrc"];
  markdownShortcuts?: MarkdownPaperProps["markdownShortcuts"];
};

function markraTextSelectionObserverPlugin(
  onTextSelectionChange: (selection: AiSelectionContext | null) => unknown
) {
  return $prose(() => {
    let lastSignature = "";

    const notifySelectionChange = (view: EditorView, options: { requireFocusForEmptySelection: boolean }) => {
      const { selection } = view.state;

      if (selection.empty) {
        if (options.requireFocusForEmptySelection && !view.hasFocus()) return;

        const blockContext = readAiSelectionContextFromView(view);
        if (blockContext.text.trim()) {
          const signature = `${blockContext.source ?? "block"}:${blockContext.from}:${blockContext.to}:${blockContext.text}`;
          if (signature === lastSignature) return;

          lastSignature = signature;
          onTextSelectionChange(blockContext);
          return;
        }

        if (lastSignature) {
          lastSignature = "";
          onTextSelectionChange(null);
        }
        return;
      }

      const text = view.state.doc.textBetween(selection.from, selection.to, "\n").trim();
      if (!text) {
        if (view.hasFocus() && lastSignature) {
          lastSignature = "";
          onTextSelectionChange(null);
        }

        return;
      }

      const signature = `${selection.from}:${selection.to}:${text}`;
      if (signature === lastSignature) return;

      lastSignature = signature;
      onTextSelectionChange({
        from: selection.from,
        source: "selection",
        text,
        to: selection.to
      });
    };

    const clearStaleSelectionAfterEditorClick = (view: EditorView) => {
      if (!lastSignature) return;

      const domSelection = view.dom.ownerDocument.getSelection();
      const hasDomSelectedText = Boolean(domSelection && !domSelection.isCollapsed && domSelection.toString().trim());
      if (hasDomSelectedText) return;

      if (!view.state.selection.empty) {
        lastSignature = "";
        onTextSelectionChange(null);
        return;
      }

      notifySelectionChange(view, { requireFocusForEmptySelection: false });
    };

    return new Plugin({
      view(view) {
        const ownerDocument = view.dom.ownerDocument;
        const handleMouseUp = (event: MouseEvent) => {
          if (event.button !== 0) return;

          const targetElement =
            event.target instanceof Element
              ? event.target
              : event.target instanceof Node
                ? event.target.parentElement
                : null;
          const writingSurface = view.dom.closest(".paper-scroll");
          if (!targetElement || !writingSurface?.contains(targetElement)) return;

          ownerDocument.defaultView?.setTimeout(() => {
            clearStaleSelectionAfterEditorClick(view);
          }, 0);
        };

        ownerDocument.addEventListener("mouseup", handleMouseUp, true);

        return {
          destroy() {
            ownerDocument.removeEventListener("mouseup", handleMouseUp, true);
          },
          update(view, previousState) {
            const { selection } = view.state;
            if (selection.eq(previousState.selection)) return;
            notifySelectionChange(view, { requireFocusForEmptySelection: true });
          }
        };
      }
    });
  });
}

function linkTargetFromClickTarget(target: EventTarget | null) {
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!targetElement) return null;

  return targetElement.closest<HTMLAnchorElement | HTMLElement>("a[href], .markra-live-link-label[data-markra-href]");
}

function linkHrefFromClickTarget(target: EventTarget | null) {
  const linkTarget = linkTargetFromClickTarget(target);
  if (!linkTarget) return null;

  if (linkTarget instanceof HTMLAnchorElement) {
    return linkTarget.getAttribute("href") ?? linkTarget.href;
  }

  return linkTarget.dataset.markraHref ?? null;
}

function linkOpenModifierIsPressed(event: MouseEvent) {
  return event.metaKey || event.ctrlKey;
}

function markraExternalLinkClickPlugin(openExternalUrl: (url: string) => unknown) {
  return $prose(() => {
    return new Plugin({
      props: {
        handleDOMEvents: {
          mousedown(_view, event) {
            const href = linkHrefFromClickTarget(event.target);
            if (!href) return false;

            if (!linkOpenModifierIsPressed(event)) {
              return false;
            }

            event.preventDefault();
            return true;
          },
          click(_view, event) {
            const href = linkHrefFromClickTarget(event.target);
            if (!href) return false;

            if (!linkOpenModifierIsPressed(event)) {
              return false;
            }

            event.preventDefault();

            try {
              Promise.resolve(openExternalUrl(href)).catch(() => {});
            } catch {
              // Opening external links is best-effort; editing should not be interrupted by opener failures.
            }

            return true;
          }
        }
      }
    });
  });
}

function MilkdownInstanceBridge({ autoFocus, onEditorReady }: Pick<MilkdownSurfaceProps, "autoFocus" | "onEditorReady">) {
  const [loading, getEditor] = useInstance();
  const autoFocusRef = useRef(autoFocus);

  useEffect(() => {
    autoFocusRef.current = autoFocus;
  }, [autoFocus]);

  useEffect(() => {
    if (loading) return;

    const editor = getEditor();
    onEditorReady(editor, { autoFocus: autoFocusRef.current });

    return () => {
      onEditorReady(null);
    };
  }, [getEditor, loading, onEditorReady]);

  return null;
}

function MilkdownSurface({
  autoFocus,
  initialContent,
  language,
  onEditorReady,
  onMarkdownChange,
  onSaveClipboardImage,
  onSaveRemoteClipboardImage,
  openExternalUrl,
  onTextSelectionChange,
  resolveImageSrc,
  markdownShortcuts
}: MilkdownSurfaceProps) {
  const initialContentRef = useRef(initialContent);
  const onSaveClipboardImageRef = useRef(onSaveClipboardImage);
  const onSaveRemoteClipboardImageRef = useRef(onSaveRemoteClipboardImage);
  const onTextSelectionChangeRef = useRef(onTextSelectionChange);
  const markdownDocumentLabel = t(language, "app.markdownDocument");
  const tableControlLabels = {
    addColumnRight: t(language, "editor.table.addColumnRight"),
    addRowBelow: t(language, "editor.table.addRowBelow"),
    alignLeft: t(language, "editor.table.alignLeft"),
    alignCenter: t(language, "editor.table.alignCenter"),
    alignRight: t(language, "editor.table.alignRight"),
    deleteColumn: t(language, "editor.table.deleteColumn"),
    deleteRow: t(language, "editor.table.deleteRow"),
    adjustTable: t(language, "editor.table.adjustTable"),
    resizeTableTo: t(language, "editor.table.resizeTableTo"),
    tableColumns: t(language, "editor.table.columns"),
    tableRows: t(language, "editor.table.rows")
  };
  const blockDragLabels = {
    addBlock: t(language, "editor.blockAdd"),
    dragBlock: t(language, "editor.blockDrag")
  };
  const slashCommandLabels = useMemo<SlashCommandLabels>(() => ({
    menu: t(language, "editor.slashCommands"),
    noResults: t(language, "editor.slashCommandsNoResults"),
    commands: {
      bulletList: t(language, "menu.bulletList"),
      codeBlock: t(language, "menu.codeBlock"),
      heading1: t(language, "menu.heading1"),
      heading2: t(language, "menu.heading2"),
      heading3: t(language, "menu.heading3"),
      orderedList: t(language, "menu.orderedList"),
      paragraph: t(language, "menu.paragraph"),
      quote: t(language, "menu.quote"),
      table: t(language, "menu.table")
    }
  }), [language]);

  useEffect(() => {
    onSaveClipboardImageRef.current = onSaveClipboardImage;
  }, [onSaveClipboardImage]);

  useEffect(() => {
    onSaveRemoteClipboardImageRef.current = onSaveRemoteClipboardImage;
  }, [onSaveRemoteClipboardImage]);

  useEffect(() => {
    onTextSelectionChangeRef.current = onTextSelectionChange;
  }, [onTextSelectionChange]);

  const createEditor = useCallback(
    (root: HTMLElement) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, initialContentRef.current);
          ctx.update(editorViewOptionsCtx, (options) => ({
            ...options,
            attributes: {
              ...options.attributes,
              "aria-label": markdownDocumentLabel,
              spellcheck: "true"
            }
          }));
          ctx.get(listenerCtx).updated((editorCtx, doc) => {
            try {
              const view = editorCtx.get(editorViewCtx);
              const normalizedDoc = normalizeHeadingSourceDocument(
                view.state,
                paragraphSchema.type(editorCtx),
                headingSchema.type(editorCtx),
                editorCtx.get(parserCtx)
              );
              onMarkdownChange(
                serializeLinkImageLiveMarkdown(
                  normalizedDoc === view.state.doc ? doc : normalizedDoc,
                  editorCtx.get(serializerCtx),
                  linkSchema.type(editorCtx),
                  imageSchema.type(editorCtx)
                )
              );
            } catch {
              // Milkdown can flush a delayed update after teardown in tests or fast window closes.
            }
          });
        })
        .use(listener)
        .use(history)
        .use(markraMathRemarkPlugin)
        .use(markraCommonmark)
        .use(markraGfm)
        .use(markraSlashCommands(slashCommandLabels))
        .use(markraMathSourcePlugin)
        .use(markraMarkdownShortcuts(markdownShortcuts))
        .use(markraCodeBlockPlugin)
        .use(markraMathPlugin)
        .use(markraAiSelectionHoldPlugin)
        .use(markraAiEditorPreviewPlugin)
        .use(markraBlockDragPlugin(blockDragLabels))
        .use(
          markraTextSelectionObserverPlugin((selection) => {
            onTextSelectionChangeRef.current?.(selection);
          })
        )
        .use(markraTableControlsPlugin(tableControlLabels))
        .use(markraLinkImageLivePlugin(resolveImageSrc))
        .use(markraHeadingSourcePlugin)
        .use(markraSmartPastePlugin)
        .use(
          markraRawHtmlPlugin({
            htmlSourceApplyLabel: t(language, "editor.htmlSourceApply"),
            htmlSourceLabel: t(language, "editor.htmlSource"),
            resolveImageSrc
          })
        )
        .use(markraLiveMarkdownPlugin);

      if (openExternalUrl) {
        editor.use(markraExternalLinkClickPlugin(openExternalUrl));
      }

      if (onSaveClipboardImageRef.current || onSaveRemoteClipboardImageRef.current) {
        editor.use(
          markraClipboardImagePluginWithOptions(
            (image) => onSaveClipboardImageRef.current?.(image) ?? Promise.resolve(null),
            {
              saveRemoteImage: (image) => onSaveRemoteClipboardImageRef.current?.(image) ?? Promise.resolve(null)
            }
          )
        );
      }

      return editor;
    },
    [language, markdownDocumentLabel, markdownShortcuts, onMarkdownChange, openExternalUrl, resolveImageSrc, slashCommandLabels]
  );

  useEditor(createEditor, [createEditor]);

  return (
    <>
      <Milkdown />
      <MilkdownInstanceBridge autoFocus={autoFocus} onEditorReady={onEditorReady} />
    </>
  );
}

export function MarkdownPaper({
  autoFocus = false,
  bottomOverlayInset = 0,
  bodyFontSize = 16,
  contentWidth = "default",
  contentWidthMax = editorCustomContentWidthMax,
  contentWidthMin = editorCustomContentWidthMin,
  contentWidthPx = null,
  initialContent,
  language = "en",
  lineHeight = 1.65,
  markdownShortcuts,
  onEditorReady,
  onMarkdownChange,
  onContentWidthChange,
  onContentWidthResizeEnd,
  onContentWidthResizeStart,
  onSaveClipboardImage,
  onSaveRemoteClipboardImage,
  openExternalUrl,
  onTextSelectionChange,
  resolveImageSrc,
  revision,
  topInset = "titlebar"
}: MarkdownPaperProps) {
  const resolvedContentWidth = contentWidthPx ?? editorContentWidthPixels[contentWidth];
  const paperStyle = {
    fontSize: `${bodyFontSize}px`,
    lineHeight,
    maxWidth: `${resolvedContentWidth}px`,
    ...(bottomOverlayInset > 0 ? { paddingBottom: `${bottomOverlayInset}px` } : {})
  } satisfies CSSProperties;
  const shortcutsSignature = markdownShortcutSignature(markdownShortcuts);
  const normalizedMarkdownShortcuts = useMemo(
    () => normalizeMarkdownShortcuts(markdownShortcuts),
    [shortcutsSignature]
  );
  const topInsetClassName = topInset === "tabs" ? "pt-24 max-[900px]:pt-20" : "pt-14 max-[900px]:pt-10";

  return (
    <section
      className="paper-scroll h-full min-h-0 overflow-auto overscroll-none bg-transparent"
      aria-label={t(language, "app.writingSurface")}
    >
      <article
        key={revision}
        className={`markdown-paper relative mx-auto min-h-screen w-full max-w-215 px-18 pb-30 ${topInsetClassName} text-[16px] leading-[1.65] text-(--text-primary) caret-(--accent) outline-none focus:outline-none max-[900px]:px-5.25`}
        style={paperStyle}
        aria-label={t(language, "app.markdownEditor")}
        data-editor-engine="milkdown"
      >
        <EditorWidthResizer
          language={language}
          maxWidth={contentWidthMax}
          minWidth={contentWidthMin}
          width={resolvedContentWidth}
          onResize={onContentWidthChange}
          onResizeEnd={onContentWidthResizeEnd}
          onResizeStart={onContentWidthResizeStart}
        />
        <MilkdownProvider>
          <MilkdownSurface
            autoFocus={autoFocus}
            initialContent={initialContent}
            language={language}
            markdownShortcuts={normalizedMarkdownShortcuts}
            onEditorReady={onEditorReady}
            onMarkdownChange={onMarkdownChange}
            onSaveClipboardImage={onSaveClipboardImage}
            onSaveRemoteClipboardImage={onSaveRemoteClipboardImage}
            openExternalUrl={openExternalUrl}
            onTextSelectionChange={onTextSelectionChange}
            resolveImageSrc={resolveImageSrc}
          />
        </MilkdownProvider>
      </article>
    </section>
  );
}
