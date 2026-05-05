import { listen } from "@tauri-apps/api/event";
import {
  Menu,
  type MenuItemOptions,
  type PredefinedMenuItemOptions,
  type SubmenuOptions
} from "@tauri-apps/api/menu";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { t, type AppLanguage, type I18nKey } from "../i18n";

export type NativeMenuHandlers = Partial<Record<NativeMenuCommand, () => unknown | Promise<unknown>>>;

export type NativeMenuCommand =
  | "openDocument"
  | "saveDocument"
  | "saveDocumentAs"
  | "formatBold"
  | "formatItalic"
  | "formatStrikethrough"
  | "formatInlineCode"
  | "formatParagraph"
  | "formatHeading1"
  | "formatHeading2"
  | "formatHeading3"
  | "formatBulletList"
  | "formatOrderedList"
  | "formatQuote"
  | "formatCodeBlock"
  | "insertLink"
  | "insertImage";

type NativeMenuCommandPayload = {
  command: NativeMenuCommand;
};

function runNativeMenuAction(handler: (() => unknown | Promise<unknown>) | undefined) {
  if (!handler) return;

  Promise.resolve(handler()).catch(() => {});
}

function invokeNativeWindowCommand(command: "open_blank_editor_window" | "open_settings_window") {
  invoke(command).catch(() => {});
}

function customItem(
  id: string,
  text: string,
  accelerator: string | undefined,
  handler: (() => unknown | Promise<unknown>) | undefined
): MenuItemOptions {
  return {
    id,
    text,
    accelerator,
    action: () => runNativeMenuAction(handler)
  };
}

function commandItem(
  id: string,
  text: string,
  accelerator: string | undefined,
  command: "open_blank_editor_window" | "open_settings_window"
): MenuItemOptions {
  return {
    id,
    text,
    accelerator,
    action: () => invokeNativeWindowCommand(command)
  };
}

function separator(): PredefinedMenuItemOptions {
  return {
    item: "Separator"
  };
}

function predefined(item: PredefinedMenuItemOptions["item"], text?: string): PredefinedMenuItemOptions {
  return text ? { item, text } : { item };
}

function menuLabel(language: AppLanguage, key: I18nKey) {
  return t(language, key);
}

async function isCurrentNativeWindowFocused() {
  try {
    return await getCurrentWindow().isFocused();
  } catch {
    return true;
  }
}

export async function listenNativeApplicationMenuCommands(handlers: NativeMenuHandlers) {
  return listen<NativeMenuCommandPayload>("markra://menu-command", async (event) => {
    if (!(await isCurrentNativeWindowFocused())) return;

    runNativeMenuAction(handlers[event.payload.command]);
  });
}

export function createNativeApplicationMenuItems(
  handlers: NativeMenuHandlers,
  language: AppLanguage = "en"
): SubmenuOptions[] {
  const label = (key: I18nKey) => menuLabel(language, key);
  const newDocument = commandItem("newDocument", label("menu.newDocument"), "CmdOrCtrl+N", "open_blank_editor_window");
  const openDocument = customItem("openDocument", label("menu.openDocument"), "CmdOrCtrl+O", handlers.openDocument);
  const saveDocument = customItem("saveDocument", label("menu.saveDocument"), "CmdOrCtrl+S", handlers.saveDocument);
  const saveDocumentAs = customItem(
    "saveDocumentAs",
    label("menu.saveDocumentAs"),
    "CmdOrCtrl+Shift+S",
    handlers.saveDocumentAs
  );
  const settings = commandItem("openSettings", label("menu.settings"), "CmdOrCtrl+,", "open_settings_window");
  const bold = customItem("formatBold", label("menu.bold"), "CmdOrCtrl+B", handlers.formatBold);
  const italic = customItem("formatItalic", label("menu.italic"), "CmdOrCtrl+I", handlers.formatItalic);
  const strikethrough = customItem(
    "formatStrikethrough",
    label("menu.strikethrough"),
    "CmdOrCtrl+Shift+X",
    handlers.formatStrikethrough
  );
  const inlineCode = customItem("formatInlineCode", label("menu.inlineCode"), "CmdOrCtrl+E", handlers.formatInlineCode);
  const paragraph = customItem("formatParagraph", label("menu.paragraph"), "CmdOrCtrl+Alt+0", handlers.formatParagraph);
  const heading1 = customItem("formatHeading1", label("menu.heading1"), "CmdOrCtrl+Alt+1", handlers.formatHeading1);
  const heading2 = customItem("formatHeading2", label("menu.heading2"), "CmdOrCtrl+Alt+2", handlers.formatHeading2);
  const heading3 = customItem("formatHeading3", label("menu.heading3"), "CmdOrCtrl+Alt+3", handlers.formatHeading3);
  const bulletList = customItem(
    "formatBulletList",
    label("menu.bulletList"),
    "CmdOrCtrl+Shift+8",
    handlers.formatBulletList
  );
  const orderedList = customItem(
    "formatOrderedList",
    label("menu.orderedList"),
    "CmdOrCtrl+Shift+7",
    handlers.formatOrderedList
  );
  const quote = customItem("formatQuote", label("menu.quote"), "CmdOrCtrl+Shift+B", handlers.formatQuote);
  const codeBlock = customItem("formatCodeBlock", label("menu.codeBlock"), "CmdOrCtrl+Alt+C", handlers.formatCodeBlock);
  const link = customItem("insertLink", label("menu.link"), "CmdOrCtrl+K", handlers.insertLink);
  const image = customItem("insertImage", label("menu.image"), "CmdOrCtrl+Shift+I", handlers.insertImage);

  return [
    {
      id: "markra:app",
      text: "Markra",
      items: [
        predefined({ About: { name: "Markra" } }),
        separator(),
        settings,
        separator(),
        predefined("Hide", label("menu.hide")),
        predefined("HideOthers", label("menu.hideOthers")),
        predefined("ShowAll", label("menu.showAll")),
        separator(),
        predefined("Quit", label("menu.quit"))
      ]
    },
    {
      id: "markra:file",
      text: label("menu.file"),
      items: [
        newDocument,
        openDocument,
        separator(),
        saveDocument,
        saveDocumentAs,
        separator(),
        predefined("CloseWindow", label("menu.closeWindow"))
      ]
    },
    {
      id: "markra:edit",
      text: label("menu.edit"),
      items: [
        predefined("Undo", label("menu.undo")),
        predefined("Redo", label("menu.redo")),
        separator(),
        predefined("Cut", label("menu.cut")),
        predefined("Copy", label("menu.copy")),
        predefined("Paste", label("menu.paste")),
        predefined("SelectAll", label("menu.selectAll"))
      ]
    },
    {
      id: "markra:format",
      text: label("menu.format"),
      items: [
        bold,
        italic,
        strikethrough,
        inlineCode,
        separator(),
        paragraph,
        heading1,
        heading2,
        heading3,
        separator(),
        bulletList,
        orderedList,
        quote,
        codeBlock,
        separator(),
        link,
        image
      ]
    },
    {
      id: "markra:view",
      text: label("menu.view"),
      items: [predefined("Fullscreen", label("menu.fullscreen"))]
    }
  ];
}

export async function installNativeApplicationMenu(handlers: NativeMenuHandlers, language: AppLanguage = "en") {
  const stopListening = await listenNativeApplicationMenuCommands(handlers);

  try {
    const menu = await Menu.new({
      items: createNativeApplicationMenuItems(handlers, language)
    });
    await menu.setAsAppMenu();
  } catch {
    // Keep the Rust-installed startup menu working if the JS menu API is unavailable.
  }

  return stopListening;
}

export function createNativeEditorContextMenuItems(handlers: NativeMenuHandlers, language: AppLanguage = "en") {
  const label = (key: I18nKey) => menuLabel(language, key);

  return [
    predefined("Cut", label("menu.cut")),
    predefined("Copy", label("menu.copy")),
    predefined("Paste", label("menu.paste")),
    predefined("SelectAll", label("menu.selectAll")),
    separator(),
    customItem("markra:context:bold", label("menu.bold"), "CmdOrCtrl+B", handlers.formatBold),
    customItem("markra:context:italic", label("menu.italic"), "CmdOrCtrl+I", handlers.formatItalic),
    customItem("markra:context:link", label("menu.link"), "CmdOrCtrl+K", handlers.insertLink)
  ];
}

export async function installNativeEditorContextMenu(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  handlers: NativeMenuHandlers,
  language: AppLanguage = "en"
) {
  try {
    const menu = await Menu.new({
      items: createNativeEditorContextMenuItems(handlers, language)
    });

    const handleContextMenu = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest(".markdown-paper")) return;

      event.preventDefault();
      menu.popup();
    };

    target.addEventListener("contextmenu", handleContextMenu);

    return () => {
      target.removeEventListener("contextmenu", handleContextMenu);
    };
  } catch {
    return () => {};
  }
}
