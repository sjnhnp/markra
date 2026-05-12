import { useEffect, useMemo } from "react";
import { installNativeMarkdownFileDrop, type NativeMarkdownDroppedTarget } from "../lib/tauri";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu,
  type NativeMenuHandlers
} from "../lib/tauri";
import type { AiEditIntent } from "@markra/ai";
import { t, type AppLanguage, type I18nKey } from "@markra/shared";

type NativeAiQuickActionIntent = Exclude<AiEditIntent, "custom">;

type NativeMenuHandlerOptions = {
  exportHtml?: () => unknown | Promise<unknown>;
  exportPdf?: () => unknown | Promise<unknown>;
  insertMarkdownSnippet: (open: string, close: string, placeholder: string) => unknown;
  insertMarkdownTable: () => unknown;
  language?: AppLanguage;
  openDocument: () => unknown | Promise<unknown>;
  runAiQuickAction?: (intent: NativeAiQuickActionIntent, prompt: string) => unknown | Promise<unknown>;
  runEditorShortcut: (key: string, modifiers?: Pick<KeyboardEventInit, "altKey" | "shiftKey">) => unknown;
  saveDocument: () => unknown | Promise<unknown>;
  saveDocumentAs: () => unknown | Promise<unknown>;
};

type ApplicationShortcutOptions = {
  exportHtml?: () => unknown | Promise<unknown>;
  exportPdf?: () => unknown | Promise<unknown>;
  openDocument: () => unknown | Promise<unknown>;
  openFolder: () => unknown | Promise<unknown>;
  saveDocument: () => unknown | Promise<unknown>;
  saveDocumentAs: () => unknown | Promise<unknown>;
};

export function useNativeMenuHandlers({
  exportHtml,
  exportPdf,
  insertMarkdownSnippet,
  insertMarkdownTable,
  language = "en",
  openDocument,
  runAiQuickAction,
  runEditorShortcut,
  saveDocument,
  saveDocumentAs
}: NativeMenuHandlerOptions) {
  return useMemo<NativeMenuHandlers>(
    () => ({
      openDocument,
      saveDocument,
      saveDocumentAs,
      exportPdf,
      exportHtml,
      formatBold: () => runEditorShortcut("b"),
      formatItalic: () => runEditorShortcut("i"),
      formatStrikethrough: () => runEditorShortcut("x", { shiftKey: true }),
      formatInlineCode: () => runEditorShortcut("e"),
      formatParagraph: () => runEditorShortcut("0", { altKey: true }),
      formatHeading1: () => runEditorShortcut("1", { altKey: true }),
      formatHeading2: () => runEditorShortcut("2", { altKey: true }),
      formatHeading3: () => runEditorShortcut("3", { altKey: true }),
      formatBulletList: () => runEditorShortcut("8", { shiftKey: true }),
      formatOrderedList: () => runEditorShortcut("7", { shiftKey: true }),
      formatQuote: () => runEditorShortcut("b", { shiftKey: true }),
      formatCodeBlock: () => runEditorShortcut("c", { altKey: true }),
      insertLink: () => insertMarkdownSnippet("[", "](https://)", "text"),
      insertImage: () => insertMarkdownSnippet("![", "](https://)", "alt"),
      insertTable: insertMarkdownTable,
      aiPolish: aiQuickAction(runAiQuickAction, "polish", "app.aiPolish", language),
      aiRewrite: aiQuickAction(runAiQuickAction, "rewrite", "app.aiRewrite", language),
      aiContinueWriting: aiQuickAction(runAiQuickAction, "continue", "app.aiContinueWriting", language),
      aiSummarize: aiQuickAction(runAiQuickAction, "summarize", "app.aiSummarize", language),
      aiTranslate: aiQuickAction(runAiQuickAction, "translate", "app.aiTranslate", language)
    }),
    [
      insertMarkdownSnippet,
      insertMarkdownTable,
      language,
      openDocument,
      exportHtml,
      exportPdf,
      runAiQuickAction,
      runEditorShortcut,
      saveDocument,
      saveDocumentAs
    ]
  );
}

function aiQuickAction(
  runAiQuickAction: NativeMenuHandlerOptions["runAiQuickAction"],
  intent: NativeAiQuickActionIntent,
  labelKey: I18nKey,
  language: AppLanguage
) {
  return () => runAiQuickAction?.(intent, t(language, labelKey));
}

export function useNativeMarkdownDrop(onDrop: (target: NativeMarkdownDroppedTarget) => unknown | Promise<unknown>) {
  useEffect(() => {
    let active = true;
    let cleanup: (() => unknown) | null = null;

    installNativeMarkdownFileDrop(onDrop).then((stopListening) => {
      if (!active) {
        stopListening();
        return;
      }

      cleanup = stopListening;
    }).catch(() => {});

    return () => {
      active = false;
      cleanup?.();
    };
  }, [onDrop]);
}

export function useNativeMenus(
  handlers: NativeMenuHandlers,
  language: AppLanguage | null = "en",
  options: { getAiCommandsAvailable?: () => boolean } = {}
) {
  useEffect(() => {
    if (!language) return;

    let active = true;
    let cleanup: (() => unknown) | null = null;

    installNativeApplicationMenu(handlers, language).then((stopListening) => {
      if (!active) {
        stopListening();
        return;
      }

      cleanup = stopListening;
    }).catch(() => {});

    return () => {
      active = false;
      cleanup?.();
    };
  }, [handlers, language]);

  useEffect(() => {
    if (!language) return;

    let active = true;
    let cleanup: (() => unknown) | null = null;

    installNativeEditorContextMenu(globalThis.document, handlers, language, {
      getAiCommandsAvailable: options.getAiCommandsAvailable
    }).then((removeContextMenu) => {
      if (!active) {
        removeContextMenu();
        return;
      }

      cleanup = removeContextMenu;
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [handlers, language, options.getAiCommandsAvailable]);
}

export function useApplicationShortcuts({
  exportHtml,
  exportPdf,
  openDocument,
  openFolder,
  saveDocument,
  saveDocumentAs
}: ApplicationShortcutOptions) {
  useEffect(() => {
    const handleApplicationShortcut = (event: KeyboardEvent) => {
      const isModKey = event.metaKey || event.ctrlKey;
      if (!isModKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "s" && event.shiftKey) {
        event.preventDefault();
        saveDocumentAs();
      } else if (key === "s") {
        event.preventDefault();
        saveDocument();
      } else if (key === "o" && event.shiftKey) {
        event.preventDefault();
        openFolder();
      } else if (key === "o") {
        event.preventDefault();
        openDocument();
      } else if (key === "p" && !event.shiftKey && exportPdf) {
        event.preventDefault();
        exportPdf();
      } else if (key === "e" && event.shiftKey && exportHtml) {
        event.preventDefault();
        exportHtml();
      }
    };

    window.addEventListener("keydown", handleApplicationShortcut);
    return () => {
      window.removeEventListener("keydown", handleApplicationShortcut);
    };
  }, [exportHtml, exportPdf, openDocument, openFolder, saveDocument, saveDocumentAs]);
}
