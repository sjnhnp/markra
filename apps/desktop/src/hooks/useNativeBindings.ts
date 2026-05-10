import { useEffect, useMemo } from "react";
import { installNativeMarkdownFileDrop, type NativeMarkdownDroppedTarget } from "../lib/tauri";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu,
  type NativeMenuHandlers
} from "../lib/tauri";
import type { AppLanguage } from "@markra/shared";

type NativeMenuHandlerOptions = {
  insertMarkdownSnippet: (open: string, close: string, placeholder: string) => unknown;
  insertMarkdownTable: () => unknown;
  openDocument: () => unknown | Promise<unknown>;
  runEditorShortcut: (key: string, modifiers?: Pick<KeyboardEventInit, "altKey" | "shiftKey">) => unknown;
  saveDocument: () => unknown | Promise<unknown>;
  saveDocumentAs: () => unknown | Promise<unknown>;
};

type ApplicationShortcutOptions = {
  openDocument: () => unknown | Promise<unknown>;
  openFolder: () => unknown | Promise<unknown>;
  saveDocument: () => unknown | Promise<unknown>;
  saveDocumentAs: () => unknown | Promise<unknown>;
};

export function useNativeMenuHandlers({
  insertMarkdownSnippet,
  insertMarkdownTable,
  openDocument,
  runEditorShortcut,
  saveDocument,
  saveDocumentAs
}: NativeMenuHandlerOptions) {
  return useMemo<NativeMenuHandlers>(
    () => ({
      openDocument,
      saveDocument,
      saveDocumentAs,
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
      insertTable: insertMarkdownTable
    }),
    [insertMarkdownSnippet, insertMarkdownTable, openDocument, runEditorShortcut, saveDocument, saveDocumentAs]
  );
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

export function useNativeMenus(handlers: NativeMenuHandlers, language: AppLanguage | null = "en") {
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

    installNativeEditorContextMenu(globalThis.document, handlers, language).then((removeContextMenu) => {
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
  }, [handlers, language]);
}

export function useApplicationShortcuts({
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
      }
    };

    window.addEventListener("keydown", handleApplicationShortcut);
    return () => {
      window.removeEventListener("keydown", handleApplicationShortcut);
    };
  }, [openDocument, openFolder, saveDocument, saveDocumentAs]);
}
