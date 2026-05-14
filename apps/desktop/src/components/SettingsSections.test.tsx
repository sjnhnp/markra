import { fireEvent, render, screen, within } from "@testing-library/react";
import { defaultMarkdownShortcuts } from "@markra/editor";
import { t } from "@markra/shared";
import { defaultEditorPreferences, type EditorPreferences } from "../lib/settings/app-settings";
import { EditorSettings, KeyboardShortcutsSettings, StorageSettings } from "./SettingsSections";

function translate(key: Parameters<typeof t>[1]) {
  return t("en", key);
}

function mockTitlebarActionRects(actionIds: string[]) {
  actionIds.forEach((id, index) => {
    const element = document.querySelector(`[data-titlebar-action="${id}"]`) as HTMLElement;
    const left = index * 28;
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      bottom: 24,
      height: 24,
      left,
      right: left + 24,
      top: 0,
      width: 24,
      x: left,
      y: 0,
      toJSON: () => ({})
    } as DOMRect);
  });
}

async function settleSortableDrag() {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 60);
  });
}

describe("EditorSettings", () => {
  it("keeps markdown shortcuts out of the editor tab", () => {
    render(
      <EditorSettings
        preferences={defaultEditorPreferences}
        translate={translate}
        onUpdatePreferences={vi.fn()}
      />
    );

    expect(screen.queryByRole("heading", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("toggles document tabs from the editor settings", () => {
    const onUpdatePreferences = vi.fn();

    render(
      <EditorSettings
        preferences={{
          ...defaultEditorPreferences,
          showDocumentTabs: true
        }}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    fireEvent.click(screen.getByRole("switch", { name: "Show document tabs" }));

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      showDocumentTabs: false
    });
  });

  it("shows storage type in the editor settings", () => {
    const onUpdatePreferences = vi.fn();

    render(
      <EditorSettings
        preferences={defaultEditorPreferences}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    const storageType = screen.getByRole("group", { name: "Storage type" });
    expect(within(storageType).getByRole("button", { name: "Use local storage" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(within(storageType).getByRole("button", { name: "Use WebDAV storage" }));
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      imageUpload: {
        ...defaultEditorPreferences.imageUpload,
        provider: "webdav"
      }
    });
  });
});

describe("StorageSettings", () => {
  it("switches between provider settings without changing the active storage type", () => {
    const onUpdatePreferences = vi.fn();

    render(
      <StorageSettings
        preferences={defaultEditorPreferences}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    expect(screen.queryByText("Storage type")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Storage type: Local")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use WebDAV storage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use S3-compatible storage" })).not.toBeInTheDocument();

    const settingsTypeRow = screen.getByText("Settings type").closest(".settings-row") as HTMLElement | null;
    expect(settingsTypeRow).not.toBeNull();
    expect(
      within(settingsTypeRow as HTMLElement).getByText(
        "Change the active storage type in Editor settings. The switch here only chooses which settings to configure."
      )
    ).toBeInTheDocument();

    const settingsType = within(settingsTypeRow as HTMLElement).getByRole("group", { name: "Settings type" });
    expect(within(settingsType).getByRole("button", { name: "Show local settings" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    expect(screen.queryByRole("heading", { name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Clipboard image folder" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "WebDAV server URL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "S3 endpoint URL" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "File naming pattern" }), {
      target: { value: "{name}-{timestamp}" }
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      imageUpload: {
        ...defaultEditorPreferences.imageUpload,
        fileNamePattern: "{name}-{timestamp}"
      }
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Clipboard image folder" }), {
      target: { value: "media" }
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      clipboardImageFolder: "media"
    });

    fireEvent.click(within(settingsType).getByRole("button", { name: "Show WebDAV settings" }));
    expect(within(settingsType).getByRole("button", { name: "Show WebDAV settings" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("textbox", { name: "Clipboard image folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WebDAV" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "WebDAV server URL" })).toBeInTheDocument();
    expect(screen.getByLabelText("WebDAV password")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "S3 endpoint URL" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "WebDAV server URL" }), {
      target: { value: "https://dav.example.com/images" }
    });
    fireEvent.change(screen.getByLabelText("WebDAV password"), {
      target: { value: "secret" }
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      imageUpload: {
        ...defaultEditorPreferences.imageUpload,
        webdav: {
          ...defaultEditorPreferences.imageUpload.webdav,
          serverUrl: "https://dav.example.com/images"
        }
      }
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      imageUpload: {
        ...defaultEditorPreferences.imageUpload,
        webdav: {
          ...defaultEditorPreferences.imageUpload.webdav,
          password: "secret"
        }
      }
    });

    fireEvent.click(within(settingsType).getByRole("button", { name: "Show S3-compatible settings" }));
    expect(within(settingsType).getByRole("button", { name: "Show S3-compatible settings" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByRole("textbox", { name: "Clipboard image folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "WebDAV server URL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "S3" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "S3 endpoint URL" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "S3 bucket" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "S3 endpoint URL" }), {
      target: { value: "https://s3.example.com" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "S3 bucket" }), {
      target: { value: "markra-images" }
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      imageUpload: {
        ...defaultEditorPreferences.imageUpload,
        s3: {
          ...defaultEditorPreferences.imageUpload.s3,
          endpointUrl: "https://s3.example.com"
        }
      }
    });
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      imageUpload: {
        ...defaultEditorPreferences.imageUpload,
        s3: {
          ...defaultEditorPreferences.imageUpload.s3,
          bucket: "markra-images"
        }
      }
    });
  });
});

describe("EditorSettings", () => {
  it("edits content width as a percentage with a reset button", () => {
    const onUpdatePreferences = vi.fn();

    render(
      <EditorSettings
        preferences={{
          ...defaultEditorPreferences,
          contentWidth: "default",
          contentWidthPx: 980
        }}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    const widthInput = screen.getByRole("textbox", { name: "Content width" });
    const resetButton = screen.getByRole("button", { name: "Content width Reset" });

    expect(screen.queryByRole("group", { name: "Content width" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Narrow" })).not.toBeInTheDocument();
    expect(widthInput).toHaveAttribute("inputmode", "numeric");
    expect(widthInput).toHaveAttribute("min", "0");
    expect(widthInput).toHaveAttribute("max", "100");
    expect(widthInput).toHaveValue("53");
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(resetButton.querySelector(".lucide-rotate-ccw")).toBeInTheDocument();

    fireEvent.change(widthInput, { target: { value: "0100" } });

    expect(widthInput).toHaveValue("100");
    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      contentWidth: "default",
      contentWidthPx: 1280
    });

    fireEvent.change(widthInput, { target: { value: "80" } });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      contentWidth: "default",
      contentWidthPx: 1152
    });

    fireEvent.change(widthInput, { target: { value: "0" } });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      contentWidth: "default",
      contentWidthPx: 640
    });

    fireEvent.change(widthInput, { target: { value: "200" } });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      contentWidth: "default",
      contentWidthPx: 1280
    });

    fireEvent.click(resetButton);

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...defaultEditorPreferences,
      contentWidth: "default",
      contentWidthPx: null
    });
  });

  it("manages titlebar action order and visibility with icon buttons", async () => {
    const onUpdatePreferences = vi.fn();
    const preferences: EditorPreferences = {
      ...defaultEditorPreferences,
      titlebarActions: [
        { id: "theme", visible: true },
        { id: "save", visible: false },
        { id: "open", visible: true },
        { id: "sourceMode", visible: true },
        { id: "aiAgent", visible: true }
      ]
    };

    render(
      <EditorSettings
        preferences={preferences}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    const group = screen.getByRole("group", { name: "Toolbar buttons" });
    const buttons = within(group).getAllByRole("button").filter((button) => button.ariaLabel !== "Reset toolbar buttons");

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Switch to dark theme",
      "Save Markdown",
      "Open Markdown or Folder",
      "Switch to source mode",
      "Toggle Markra AI"
    ]);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveAttribute("data-visible", "true");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveClass("aria-[pressed=true]:bg-(--bg-active)");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).not.toHaveClass("aria-[pressed=true]:border-(--accent)");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).not.toHaveClass("aria-[pressed=true]:shadow-[inset_0_0_0_1px_var(--accent)]");
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toHaveClass("transition-transform");
    expect(screen.getByRole("button", { name: "Save Markdown" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Save Markdown" })).toHaveAttribute("data-visible", "false");

    fireEvent.click(screen.getByRole("button", { name: "Save Markdown" }));

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...preferences,
      titlebarActions: [
        { id: "theme", visible: true },
        { id: "save", visible: true },
        { id: "open", visible: true },
        { id: "sourceMode", visible: true },
        { id: "aiAgent", visible: true }
      ]
    });

    const themeButton = screen.getByRole("button", { name: "Switch to dark theme" });
    mockTitlebarActionRects(["theme", "save", "open", "sourceMode", "aiAgent"]);

    fireEvent.mouseDown(themeButton, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 20, clientY: 10 });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 60, clientY: 10 });
    fireEvent.mouseUp(document, { clientX: 60, clientY: 10 });
    await settleSortableDrag();

    expect(onUpdatePreferences).toHaveBeenLastCalledWith({
      ...preferences,
      titlebarActions: [
        { id: "save", visible: false },
        { id: "open", visible: true },
        { id: "theme", visible: true },
        { id: "sourceMode", visible: true },
        { id: "aiAgent", visible: true }
      ]
    });

    const sourceModeButton = screen.getByRole("button", { name: "Switch to source mode" });

    fireEvent.mouseDown(sourceModeButton, {
      button: 0,
      clientX: 80,
      clientY: 10
    });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 70, clientY: 10 });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 20, clientY: 10 });
    fireEvent.mouseUp(document, { clientX: 20, clientY: 10 });
    await settleSortableDrag();

    expect(onUpdatePreferences).toHaveBeenLastCalledWith({
      ...preferences,
      titlebarActions: [
        { id: "theme", visible: true },
        { id: "sourceMode", visible: true },
        { id: "save", visible: false },
        { id: "open", visible: true },
        { id: "aiAgent", visible: true }
      ]
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset toolbar buttons" }));

    expect(onUpdatePreferences).toHaveBeenLastCalledWith({
      ...preferences,
      titlebarActions: [
        { id: "aiAgent", visible: true },
        { id: "sourceMode", visible: true },
        { id: "open", visible: true },
        { id: "save", visible: true },
        { id: "theme", visible: true }
      ]
    });
  });
});

describe("KeyboardShortcutsSettings", () => {
  it("records and resets custom markdown shortcuts", () => {
    const onUpdatePreferences = vi.fn();
    const preferences: EditorPreferences = {
      ...defaultEditorPreferences,
      markdownShortcuts: defaultMarkdownShortcuts
    };

    render(
      <KeyboardShortcutsSettings
        preferences={preferences}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Application" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editor" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Formatting" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Insert" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markra AI shortcut" })).toHaveTextContent("⌘+⌥+J");
    expect(screen.getByRole("button", { name: "AI writing command shortcut" })).toHaveTextContent("⌘+⇧+J");
    expect(screen.getByRole("button", { name: "Switch to source mode shortcut" })).toHaveTextContent("⌘+⌥+S");
    expect(screen.getByRole("button", { name: "Link shortcut" })).toHaveTextContent("⌘+K");
    expect(screen.getByRole("button", { name: "Bold shortcut" })).toHaveTextContent("⌘+B");
    expect(screen.queryByText("Mod+B")).not.toBeInTheDocument();

    const boldShortcut = screen.getByRole("button", { name: "Bold shortcut" });
    fireEvent.click(boldShortcut);
    fireEvent.keyDown(boldShortcut, {
      key: "b",
      altKey: true,
      metaKey: true
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...preferences,
      markdownShortcuts: {
        ...defaultMarkdownShortcuts,
        bold: "Mod+Alt+B"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset keyboard shortcuts" }));

    expect(onUpdatePreferences).toHaveBeenLastCalledWith({
      ...preferences,
      markdownShortcuts: defaultMarkdownShortcuts
    });
  });

  it("records shortcuts from the active window while capture is active", () => {
    const onUpdatePreferences = vi.fn();
    const preferences: EditorPreferences = {
      ...defaultEditorPreferences,
      markdownShortcuts: defaultMarkdownShortcuts
    };

    render(
      <KeyboardShortcutsSettings
        preferences={preferences}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Bold shortcut" }));
    fireEvent.keyDown(window, {
      key: "b",
      altKey: true,
      metaKey: true
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...preferences,
      markdownShortcuts: {
        ...defaultMarkdownShortcuts,
        bold: "Mod+Alt+B"
      }
    });
  });

  it("uses Ctrl labels for markdown shortcuts on Windows and Linux", () => {
    render(
      <KeyboardShortcutsSettings
        platform="windows"
        preferences={defaultEditorPreferences}
        translate={translate}
        onUpdatePreferences={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Bold shortcut" })).toHaveTextContent("Ctrl+B");
    expect(screen.getByRole("button", { name: "Toggle Markra AI shortcut" })).toHaveTextContent("Ctrl+Alt+J");
    expect(screen.getByRole("button", { name: "AI writing command shortcut" })).toHaveTextContent("Ctrl+Shift+J");
    expect(screen.getByRole("button", { name: "Switch to source mode shortcut" })).toHaveTextContent("Ctrl+Alt+S");
    expect(screen.getByRole("button", { name: "Link shortcut" })).toHaveTextContent("Ctrl+K");
    expect(screen.getByRole("button", { name: "Strikethrough shortcut" })).toHaveTextContent("Ctrl+Shift+X");
  });

  it("records app-level shortcuts from the keyboard shortcuts tab", () => {
    const onUpdatePreferences = vi.fn();
    const preferences: EditorPreferences = {
      ...defaultEditorPreferences,
      markdownShortcuts: defaultMarkdownShortcuts
    };

    render(
      <KeyboardShortcutsSettings
        preferences={preferences}
        translate={translate}
        onUpdatePreferences={onUpdatePreferences}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markra AI shortcut" }));
    fireEvent.keyDown(window, {
      key: "j",
      altKey: true,
      metaKey: true,
    });

    expect(onUpdatePreferences).toHaveBeenCalledWith({
      ...preferences,
      markdownShortcuts: {
        ...defaultMarkdownShortcuts,
        toggleAiAgent: "Mod+Alt+J"
      }
    });
  });

  it("leaves recording mode when shortcuts are reset", () => {
    render(
      <KeyboardShortcutsSettings
        preferences={{
          ...defaultEditorPreferences,
          markdownShortcuts: {
            ...defaultMarkdownShortcuts,
            bold: "Mod+Alt+B"
          }
        }}
        translate={translate}
        onUpdatePreferences={vi.fn()}
      />
    );

    const boldShortcut = screen.getByRole("button", { name: "Bold shortcut" });
    fireEvent.click(boldShortcut);

    expect(boldShortcut).toHaveTextContent("Press keys");

    fireEvent.click(screen.getByRole("button", { name: "Reset keyboard shortcuts" }));

    expect(boldShortcut).toHaveTextContent("⌘+⌥+B");
  });
});
