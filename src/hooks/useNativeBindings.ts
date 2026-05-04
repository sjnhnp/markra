import { useEffect, useMemo } from "react";
import { installNativeMarkdownFileDrop } from "../lib/nativeFile";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu,
  type NativeMenuHandlers
} from "../lib/nativeMenu";

type NativeMenuHandlerOptions = {
  insertMarkdownSnippet: (open: string, close: string, placeholder: string) => void;
  openDocument: () => void | Promise<void>;
  runEditorShortcut: (key: string, modifiers?: Pick<KeyboardEventInit, "altKey" | "shiftKey">) => void;
  saveDocument: () => void | Promise<void>;
  saveDocumentAs: () => void | Promise<void>;
};

type ApplicationShortcutOptions = {
  openDocument: () => void | Promise<void>;
  openFolder: () => void | Promise<void>;
  saveDocument: () => void | Promise<void>;
  saveDocumentAs: () => void | Promise<void>;
};

export function useNativeMenuHandlers({
  insertMarkdownSnippet,
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
      insertImage: () => insertMarkdownSnippet("![", "](https://)", "alt")
    }),
    [insertMarkdownSnippet, openDocument, runEditorShortcut, saveDocument, saveDocumentAs]
  );
}

export function useNativeMarkdownDrop(onDrop: (path: string) => void | Promise<void>) {
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void installNativeMarkdownFileDrop(onDrop).then((stopListening) => {
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

export function useNativeMenus(handlers: NativeMenuHandlers) {
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void installNativeApplicationMenu(handlers).then((stopListening) => {
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
  }, [handlers]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | null = null;

    void installNativeEditorContextMenu(globalThis.document, handlers).then((removeContextMenu) => {
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
  }, [handlers]);
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
        void saveDocumentAs();
      } else if (key === "s") {
        event.preventDefault();
        void saveDocument();
      } else if (key === "o" && event.shiftKey) {
        event.preventDefault();
        void openFolder();
      } else if (key === "o") {
        event.preventDefault();
        void openDocument();
      }
    };

    window.addEventListener("keydown", handleApplicationShortcut);
    return () => {
      window.removeEventListener("keydown", handleApplicationShortcut);
    };
  }, [openDocument, openFolder, saveDocument, saveDocumentAs]);
}
