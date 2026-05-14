import { useEffect, useMemo, useRef } from "react";
import { installNativeMarkdownFileDrop, type NativeMarkdownDroppedTarget } from "../lib/tauri";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu,
  type NativeMenuHandlers
} from "../lib/tauri";
import type { AiEditIntent } from "@markra/ai";
import {
  defaultMarkdownShortcuts,
  markdownShortcutToKeyboardEventInit,
  normalizeMarkdownShortcuts,
  type MarkdownShortcutAction,
  type MarkdownShortcutMap
} from "@markra/editor";
import { matchesKeyboardShortcutEvent, type AppLanguage } from "@markra/shared";
import { defaultAiQuickActionPrompts } from "../lib/ai-actions";

type NativeAiQuickActionIntent = Exclude<AiEditIntent, "custom">;

type NativeMenuHandlerOptions = {
  checkForUpdates?: () => unknown | Promise<unknown>;
  closeDocument?: () => unknown | Promise<unknown>;
  exportHtml?: () => unknown | Promise<unknown>;
  exportPdf?: () => unknown | Promise<unknown>;
  insertMarkdownSnippet: (open: string, close: string, placeholder: string) => unknown;
  insertMarkdownTable: () => unknown;
  language?: AppLanguage;
  markdownShortcuts?: MarkdownShortcutMap;
  openDocument: () => unknown | Promise<unknown>;
  openFolder: () => unknown | Promise<unknown>;
  runAiQuickAction?: (intent: NativeAiQuickActionIntent, prompt: string) => unknown | Promise<unknown>;
  runEditorShortcut: (key: string, modifiers?: Pick<KeyboardEventInit, "altKey" | "shiftKey">) => unknown;
  saveDocument: () => unknown | Promise<unknown>;
  saveDocumentAs: () => unknown | Promise<unknown>;
  toggleAiAgent?: () => unknown | Promise<unknown>;
  toggleAiCommand?: () => unknown | Promise<unknown>;
  toggleMarkdownFiles?: () => unknown | Promise<unknown>;
  toggleSourceMode?: () => unknown | Promise<unknown>;
};

type ApplicationShortcutOptions = {
  closeDocument?: () => unknown | Promise<unknown>;
  exportHtml?: () => unknown | Promise<unknown>;
  exportPdf?: () => unknown | Promise<unknown>;
  markdownShortcuts?: MarkdownShortcutMap;
  openDocument: () => unknown | Promise<unknown>;
  openFolder: () => unknown | Promise<unknown>;
  saveDocument: () => unknown | Promise<unknown>;
  saveDocumentAs: () => unknown | Promise<unknown>;
  toggleAiAgent?: () => unknown | Promise<unknown>;
  toggleAiCommand?: () => unknown | Promise<unknown>;
  toggleMarkdownFiles?: () => unknown | Promise<unknown>;
  toggleSourceMode?: () => unknown | Promise<unknown>;
};

export function useNativeMenuHandlers({
  checkForUpdates,
  closeDocument,
  exportHtml,
  exportPdf,
  insertMarkdownSnippet,
  insertMarkdownTable,
  language = "en",
  markdownShortcuts,
  openDocument,
  openFolder,
  runAiQuickAction,
  runEditorShortcut,
  saveDocument,
  saveDocumentAs,
  toggleAiAgent,
  toggleAiCommand,
  toggleMarkdownFiles,
  toggleSourceMode
}: NativeMenuHandlerOptions) {
  const normalizedMarkdownShortcuts = useMemo(
    () => normalizeMarkdownShortcuts(markdownShortcuts ?? defaultMarkdownShortcuts),
    [markdownShortcuts]
  );
  const latestOptionsRef = useRef({
    checkForUpdates,
    exportHtml,
    exportPdf,
    closeDocument,
    insertMarkdownSnippet,
    insertMarkdownTable,
    language,
    normalizedMarkdownShortcuts,
    openDocument,
    openFolder,
    runAiQuickAction,
    runEditorShortcut,
    saveDocument,
    saveDocumentAs,
    toggleAiAgent,
    toggleAiCommand,
    toggleMarkdownFiles,
    toggleSourceMode
  });
  latestOptionsRef.current = {
    checkForUpdates,
    exportHtml,
    exportPdf,
    closeDocument,
    insertMarkdownSnippet,
    insertMarkdownTable,
    language,
    normalizedMarkdownShortcuts,
    openDocument,
    openFolder,
    runAiQuickAction,
    runEditorShortcut,
    saveDocument,
    saveDocumentAs,
    toggleAiAgent,
    toggleAiCommand,
    toggleMarkdownFiles,
    toggleSourceMode
  };

  return useMemo<NativeMenuHandlers>(
    () => ({
      openDocument: () => latestOptionsRef.current.openDocument(),
      openFolder: () => latestOptionsRef.current.openFolder(),
      checkForUpdates: () => latestOptionsRef.current.checkForUpdates?.(),
      closeDocument: () => latestOptionsRef.current.closeDocument?.(),
      saveDocument: () => latestOptionsRef.current.saveDocument(),
      saveDocumentAs: () => latestOptionsRef.current.saveDocumentAs(),
      exportPdf: () => latestOptionsRef.current.exportPdf?.(),
      exportHtml: () => latestOptionsRef.current.exportHtml?.(),
      formatBold: () => runMarkdownShortcut("bold"),
      formatItalic: () => runMarkdownShortcut("italic"),
      formatStrikethrough: () => runMarkdownShortcut("strikethrough"),
      formatInlineCode: () => runMarkdownShortcut("inlineCode"),
      formatParagraph: () => runMarkdownShortcut("paragraph"),
      formatHeading1: () => runMarkdownShortcut("heading1"),
      formatHeading2: () => runMarkdownShortcut("heading2"),
      formatHeading3: () => runMarkdownShortcut("heading3"),
      formatBulletList: () => runMarkdownShortcut("bulletList"),
      formatOrderedList: () => runMarkdownShortcut("orderedList"),
      formatQuote: () => runMarkdownShortcut("quote"),
      formatCodeBlock: () => runMarkdownShortcut("codeBlock"),
      insertLink: () => latestOptionsRef.current.insertMarkdownSnippet("[", "](https://)", "text"),
      insertImage: () => latestOptionsRef.current.insertMarkdownSnippet("![", "](https://)", "alt"),
      insertTable: () => latestOptionsRef.current.insertMarkdownTable(),
      aiPolish: () => runLatestAiQuickAction("polish"),
      aiRewrite: () => runLatestAiQuickAction("rewrite"),
      aiContinueWriting: () => runLatestAiQuickAction("continue"),
      aiSummarize: () => runLatestAiQuickAction("summarize"),
      aiTranslate: () => runLatestAiQuickAction("translate"),
      toggleAiAgent: () => latestOptionsRef.current.toggleAiAgent?.(),
      toggleAiCommand: () => latestOptionsRef.current.toggleAiCommand?.(),
      toggleMarkdownFiles: () => latestOptionsRef.current.toggleMarkdownFiles?.(),
      toggleSourceMode: () => latestOptionsRef.current.toggleSourceMode?.()
    }),
    []
  );

  function runMarkdownShortcut(action: MarkdownShortcutAction) {
    const shortcut = markdownShortcutToKeyboardEventInit(latestOptionsRef.current.normalizedMarkdownShortcuts[action]);
    if (!shortcut) return;

    latestOptionsRef.current.runEditorShortcut(shortcut.key, {
      altKey: Boolean(shortcut.altKey),
      shiftKey: Boolean(shortcut.shiftKey)
    });
  }

  function runLatestAiQuickAction(intent: NativeAiQuickActionIntent) {
    const { language: currentLanguage, runAiQuickAction: currentRunAiQuickAction } = latestOptionsRef.current;

    return currentRunAiQuickAction?.(intent, defaultAiQuickActionPrompts[intent]);
  }
}

function hasMarkdownShortcutOverrides(shortcuts: MarkdownShortcutMap | undefined) {
  if (!shortcuts) return false;

  const normalizedShortcuts = normalizeMarkdownShortcuts(shortcuts);

  return (Object.keys(defaultMarkdownShortcuts) as MarkdownShortcutAction[]).some(
    (action) => normalizedShortcuts[action] !== defaultMarkdownShortcuts[action]
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

export function useNativeMenus(
  handlers: NativeMenuHandlers,
  language: AppLanguage | null = "en",
  options: { getAiCommandsAvailable?: () => boolean; markdownShortcuts?: MarkdownShortcutMap } = {}
) {
  const markdownShortcuts = hasMarkdownShortcutOverrides(options.markdownShortcuts)
    ? options.markdownShortcuts
    : undefined;

  useEffect(() => {
    if (!language) return;

    let active = true;
    let cleanup: (() => unknown) | null = null;

    const installMenu = markdownShortcuts
      ? installNativeApplicationMenu(handlers, language, markdownShortcuts)
      : installNativeApplicationMenu(handlers, language);

    installMenu.then((stopListening) => {
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
  }, [handlers, language, markdownShortcuts]);

  useEffect(() => {
    if (!language) return;

    let active = true;
    let cleanup: (() => unknown) | null = null;

    installNativeEditorContextMenu(globalThis.document, handlers, language, {
      getAiCommandsAvailable: options.getAiCommandsAvailable,
      markdownShortcuts
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
  }, [handlers, language, options.getAiCommandsAvailable, markdownShortcuts]);
}

export function useApplicationShortcuts({
  closeDocument,
  exportHtml,
  exportPdf,
  markdownShortcuts,
  openDocument,
  openFolder,
  saveDocument,
  saveDocumentAs,
  toggleAiAgent,
  toggleAiCommand,
  toggleMarkdownFiles,
  toggleSourceMode
}: ApplicationShortcutOptions) {
  const normalizedMarkdownShortcuts = useMemo(
    () => normalizeMarkdownShortcuts(markdownShortcuts ?? defaultMarkdownShortcuts),
    [markdownShortcuts]
  );

  useEffect(() => {
    const handleApplicationShortcut = (event: KeyboardEvent) => {
      const isModKey = event.metaKey || event.ctrlKey;
      if (event.defaultPrevented || !isModKey) return;

      const configurableActions: Array<[string, (() => unknown | Promise<unknown>) | undefined]> = [
        [normalizedMarkdownShortcuts.toggleMarkdownFiles, toggleMarkdownFiles],
        [normalizedMarkdownShortcuts.toggleAiAgent, toggleAiAgent],
        [normalizedMarkdownShortcuts.toggleAiCommand, toggleAiCommand],
        [normalizedMarkdownShortcuts.toggleSourceMode, toggleSourceMode]
      ];

      for (const [shortcut, handler] of configurableActions) {
        if (!handler || !matchesKeyboardShortcutEvent(event, shortcut)) continue;

        event.preventDefault();
        event.stopPropagation();
        handler();
        return;
      }

      if (event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "s" && event.shiftKey) {
        event.preventDefault();
        saveDocumentAs();
      } else if (key === "w" && !event.shiftKey && closeDocument) {
        event.preventDefault();
        closeDocument();
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

    window.addEventListener("keydown", handleApplicationShortcut, true);
    return () => {
      window.removeEventListener("keydown", handleApplicationShortcut, true);
    };
  }, [
    exportHtml,
    exportPdf,
    closeDocument,
    normalizedMarkdownShortcuts,
    openDocument,
    openFolder,
    saveDocument,
    saveDocumentAs,
    toggleAiAgent,
    toggleAiCommand,
    toggleMarkdownFiles,
    toggleSourceMode
  ]);
}
