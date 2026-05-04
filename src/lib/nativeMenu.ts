import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions } from "@tauri-apps/api/menu";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type NativeMenuHandlers = Partial<Record<NativeMenuCommand, () => void | Promise<void>>>;

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

function runNativeMenuAction(handler: (() => void | Promise<void>) | undefined) {
  if (!handler) return;

  void Promise.resolve(handler()).catch(() => {});
}

function customItem(
  id: string,
  text: string,
  accelerator: string | undefined,
  handler: (() => void | Promise<void>) | undefined
): MenuItemOptions {
  return {
    id,
    text,
    accelerator,
    action: () => runNativeMenuAction(handler)
  };
}

function separator(): PredefinedMenuItemOptions {
  return {
    item: "Separator"
  };
}

function predefined(item: Exclude<PredefinedMenuItemOptions["item"], { About: unknown }>): PredefinedMenuItemOptions {
  return {
    item
  };
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

export async function installNativeApplicationMenu(handlers: NativeMenuHandlers) {
  return listenNativeApplicationMenuCommands(handlers);
}

export function createNativeEditorContextMenuItems(handlers: NativeMenuHandlers) {
  return [
    predefined("Cut"),
    predefined("Copy"),
    predefined("Paste"),
    predefined("SelectAll"),
    separator(),
    customItem("markra:context:bold", "Bold", "CmdOrCtrl+B", handlers.formatBold),
    customItem("markra:context:italic", "Italic", "CmdOrCtrl+I", handlers.formatItalic),
    customItem("markra:context:link", "Link", "CmdOrCtrl+K", handlers.insertLink)
  ];
}

export async function installNativeEditorContextMenu(
  target: Pick<EventTarget, "addEventListener" | "removeEventListener">,
  handlers: NativeMenuHandlers
) {
  try {
    const menu = await Menu.new({
      items: createNativeEditorContextMenuItems(handlers)
    });

    const handleContextMenu = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest(".markdown-paper")) return;

      event.preventDefault();
      void menu.popup();
    };

    target.addEventListener("contextmenu", handleContextMenu);

    return () => {
      target.removeEventListener("contextmenu", handleContextMenu);
    };
  } catch {
    return () => {};
  }
}
