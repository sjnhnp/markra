import { type CSSProperties, useCallback, useEffect, useRef } from "react";
import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx, serializerCtx } from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import {
  commands as commonmarkCommands,
  imageSchema,
  inputRules as commonmarkInputRules,
  keymap as commonmarkKeymap,
  linkSchema,
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
import { $prose } from "@milkdown/kit/utils";
import { markraLiveMarkdownPlugin } from "@markra/editor";
import { markraClipboardImagePlugin, type SaveClipboardImage } from "@markra/editor";
import { markraLinkImageLivePlugin } from "@markra/editor";
import { serializeLinkImageLiveMarkdown } from "@markra/editor";
import { markraMarkdownShortcuts } from "@markra/editor";
import { markraTableControlsPlugin } from "@markra/editor";
import { markraAiEditorPreviewPlugin } from "@markra/editor";
import { markraAiSelectionHoldPlugin } from "@markra/editor";
import type { AiSelectionContext } from "@markra/ai";
import { t, type AppLanguage } from "@markra/shared";
import type { EditorContentWidth } from "../lib/settings/app-settings";
import { readAiSelectionContextFromView } from "../hooks/useEditorController";

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

type MarkdownPaperProps = {
  autoFocus?: boolean;
  bodyFontSize?: number;
  contentWidth?: EditorContentWidth;
  initialContent: string;
  language?: AppLanguage;
  lineHeight?: number;
  onEditorReady: (editor: Editor | null, options?: { autoFocus?: boolean }) => unknown;
  onMarkdownChange: (content: string) => unknown;
  onSaveClipboardImage?: SaveClipboardImage;
  openExternalUrl?: (url: string) => unknown;
  onTextSelectionChange?: (selection: AiSelectionContext | null) => unknown;
  resolveImageSrc?: (src: string) => string;
  revision: number;
};

const editorContentWidths: Record<EditorContentWidth, string> = {
  default: "860px",
  narrow: "720px",
  wide: "1040px"
};

type MilkdownSurfaceProps = {
  autoFocus: boolean;
  initialContent: string;
  language: AppLanguage;
  onEditorReady: MarkdownPaperProps["onEditorReady"];
  onMarkdownChange: (content: string) => unknown;
  onSaveClipboardImage?: MarkdownPaperProps["onSaveClipboardImage"];
  openExternalUrl?: MarkdownPaperProps["openExternalUrl"];
  onTextSelectionChange?: MarkdownPaperProps["onTextSelectionChange"];
  resolveImageSrc?: MarkdownPaperProps["resolveImageSrc"];
};

function markraTextSelectionObserverPlugin(
  onTextSelectionChange: (selection: AiSelectionContext | null) => unknown
) {
  return $prose(() => {
    let lastSignature = "";

    return new Plugin({
      view() {
        return {
          update(view, previousState) {
            const { selection } = view.state;
            if (selection.eq(previousState.selection)) return;

            if (selection.empty) {
              if (!view.hasFocus()) return;

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
  openExternalUrl,
  onTextSelectionChange,
  resolveImageSrc
}: MilkdownSurfaceProps) {
  const initialContentRef = useRef(initialContent);
  const onSaveClipboardImageRef = useRef(onSaveClipboardImage);
  const onTextSelectionChangeRef = useRef(onTextSelectionChange);
  const markdownDocumentLabel = t(language, "app.markdownDocument");
  const tableControlLabels = {
    addColumnRight: t(language, "editor.table.addColumnRight"),
    addRowBelow: t(language, "editor.table.addRowBelow"),
    alignLeft: t(language, "editor.table.alignLeft"),
    alignCenter: t(language, "editor.table.alignCenter"),
    alignRight: t(language, "editor.table.alignRight"),
    deleteColumn: t(language, "editor.table.deleteColumn"),
    deleteRow: t(language, "editor.table.deleteRow")
  };

  useEffect(() => {
    onSaveClipboardImageRef.current = onSaveClipboardImage;
  }, [onSaveClipboardImage]);

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
              onMarkdownChange(
                serializeLinkImageLiveMarkdown(
                  doc,
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
        .use(markraCommonmark)
        .use(markraGfm)
        .use(markraMarkdownShortcuts)
        .use(markraAiSelectionHoldPlugin)
        .use(markraAiEditorPreviewPlugin)
        .use(
          markraTextSelectionObserverPlugin((selection) => {
            onTextSelectionChangeRef.current?.(selection);
          })
        )
        .use(markraTableControlsPlugin(tableControlLabels))
        .use(markraLinkImageLivePlugin(resolveImageSrc))
        .use(markraLiveMarkdownPlugin);

      if (openExternalUrl) {
        editor.use(markraExternalLinkClickPlugin(openExternalUrl));
      }

      if (onSaveClipboardImageRef.current) {
        editor.use(
          markraClipboardImagePlugin((image) => onSaveClipboardImageRef.current?.(image) ?? Promise.resolve(null))
        );
      }

      return editor;
    },
    [markdownDocumentLabel, onMarkdownChange, openExternalUrl, resolveImageSrc]
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
  bodyFontSize = 16,
  contentWidth = "default",
  initialContent,
  language = "en",
  lineHeight = 1.65,
  onEditorReady,
  onMarkdownChange,
  onSaveClipboardImage,
  openExternalUrl,
  onTextSelectionChange,
  resolveImageSrc,
  revision
}: MarkdownPaperProps) {
  const paperStyle = {
    fontSize: `${bodyFontSize}px`,
    lineHeight,
    maxWidth: editorContentWidths[contentWidth]
  } satisfies CSSProperties;

  return (
    <section
      className="paper-scroll h-full min-h-0 overflow-auto overscroll-none bg-transparent"
      aria-label={t(language, "app.writingSurface")}
    >
      <article
        key={revision}
        className="markdown-paper mx-auto min-h-screen w-full max-w-215 px-18 pb-30 pt-14 text-[16px] leading-[1.65] text-(--text-primary) caret-(--accent) outline-none focus:outline-none max-[900px]:px-5.25 max-[900px]:pt-10"
        style={paperStyle}
        aria-label={t(language, "app.markdownEditor")}
        data-editor-engine="milkdown"
      >
        <MilkdownProvider>
          <MilkdownSurface
            autoFocus={autoFocus}
            initialContent={initialContent}
            language={language}
            onEditorReady={onEditorReady}
            onMarkdownChange={onMarkdownChange}
            onSaveClipboardImage={onSaveClipboardImage}
            openExternalUrl={openExternalUrl}
            onTextSelectionChange={onTextSelectionChange}
            resolveImageSrc={resolveImageSrc}
          />
        </MilkdownProvider>
      </article>
    </section>
  );
}
