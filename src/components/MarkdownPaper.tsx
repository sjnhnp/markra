import { useCallback, useEffect, useRef } from "react";
import { defaultValueCtx, Editor, editorViewOptionsCtx, rootCtx } from "@milkdown/kit/core";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import {
  commands as commonmarkCommands,
  inputRules as commonmarkInputRules,
  keymap as commonmarkKeymap,
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
import { markraLiveMarkdownPlugin } from "../lib/markdown/inputRules";
import { markraLinkImageLivePlugin } from "../lib/markdown/linkImageInputRules";
import { markraMarkdownShortcuts } from "../lib/markdown/shortcuts";
import { markraAiEditorPreviewPlugin } from "../lib/ai/editorPreview";
import { markraAiSelectionHoldPlugin } from "../lib/ai/selectionHold";
import type { AiSelectionContext } from "../lib/ai/agent/inlineAi";
import { t, type AppLanguage } from "../lib/i18n";

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
  initialContent: string;
  language?: AppLanguage;
  onEditorReady: (editor: Editor | null, options?: { autoFocus?: boolean }) => unknown;
  onMarkdownChange: (content: string) => unknown;
  onTextSelectionChange?: (selection: AiSelectionContext | null) => unknown;
  revision: number;
};

type MilkdownSurfaceProps = {
  autoFocus: boolean;
  initialContent: string;
  language: AppLanguage;
  onEditorReady: MarkdownPaperProps["onEditorReady"];
  onMarkdownChange: (content: string) => unknown;
  onTextSelectionChange?: MarkdownPaperProps["onTextSelectionChange"];
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
  onTextSelectionChange
}: MilkdownSurfaceProps) {
  const initialContentRef = useRef(initialContent);
  const onTextSelectionChangeRef = useRef(onTextSelectionChange);
  const markdownDocumentLabel = t(language, "app.markdownDocument");

  useEffect(() => {
    onTextSelectionChangeRef.current = onTextSelectionChange;
  }, [onTextSelectionChange]);

  const createEditor = useCallback(
    (root: HTMLElement) =>
      Editor.make()
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
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            onMarkdownChange(markdown);
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
        .use(markraLinkImageLivePlugin)
        .use(markraLiveMarkdownPlugin),
    [markdownDocumentLabel, onMarkdownChange]
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
  initialContent,
  language = "en",
  onEditorReady,
  onMarkdownChange,
  onTextSelectionChange,
  revision
}: MarkdownPaperProps) {
  return (
    <section
      className="paper-scroll min-h-0 overflow-auto overscroll-none bg-transparent"
      aria-label={t(language, "app.writingSurface")}
    >
      <article
        key={revision}
        className="markdown-paper mx-auto min-h-screen w-full max-w-215 px-18 pb-30 pt-14 text-[16px] leading-[1.65] text-(--text-primary) caret-(--accent) outline-none focus:outline-none max-[900px]:px-5.25 max-[900px]:pt-10"
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
            onTextSelectionChange={onTextSelectionChange}
          />
        </MilkdownProvider>
      </article>
    </section>
  );
}
