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
import { markraLiveMarkdownPlugin } from "../lib/markdownInputRules";
import { markraLinkImageLivePlugin } from "../lib/markdownLinkImageInputRules";
import { markraMarkdownShortcuts } from "../lib/markdownShortcuts";
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
  initialContent: string;
  language?: AppLanguage;
  onEditorReady: (editor: Editor | null) => void;
  onMarkdownChange: (content: string) => void;
  revision: number;
};

type MilkdownSurfaceProps = {
  initialContent: string;
  language: AppLanguage;
  onEditorReady: (editor: Editor | null) => void;
  onMarkdownChange: (content: string) => void;
};

function MilkdownInstanceBridge({ onEditorReady }: Pick<MilkdownSurfaceProps, "onEditorReady">) {
  const [loading, getEditor] = useInstance();

  useEffect(() => {
    if (loading) return;

    const editor = getEditor();
    onEditorReady(editor);

    return () => {
      onEditorReady(null);
    };
  }, [getEditor, loading, onEditorReady]);

  return null;
}

function MilkdownSurface({ initialContent, language, onEditorReady, onMarkdownChange }: MilkdownSurfaceProps) {
  const initialContentRef = useRef(initialContent);
  const markdownDocumentLabel = t(language, "app.markdownDocument");

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
        .use(markraLinkImageLivePlugin)
        .use(markraLiveMarkdownPlugin),
    [markdownDocumentLabel, onMarkdownChange]
  );

  useEditor(createEditor, [createEditor]);

  return (
    <>
      <Milkdown />
      <MilkdownInstanceBridge onEditorReady={onEditorReady} />
    </>
  );
}

export function MarkdownPaper({
  initialContent,
  language = "en",
  onEditorReady,
  onMarkdownChange,
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
            initialContent={initialContent}
            language={language}
            onEditorReady={onEditorReady}
            onMarkdownChange={onMarkdownChange}
          />
        </MilkdownProvider>
      </article>
    </section>
  );
}
