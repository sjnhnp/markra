import { fireEvent, renderHook } from "@testing-library/react";
import { useApplicationShortcuts, useNativeMenuHandlers } from "./useNativeBindings";

describe("useNativeMenuHandlers", () => {
  const baseOptions = {
    insertMarkdownSnippet: vi.fn(),
    insertMarkdownTable: vi.fn(),
    openDocument: vi.fn(),
    openFolder: vi.fn(),
    runEditorShortcut: vi.fn(),
    saveDocument: vi.fn(),
    saveDocumentAs: vi.fn()
  };

  it("routes the insert table menu command to the editor table insertion", () => {
    const insertMarkdownSnippet = vi.fn();
    const insertMarkdownTable = vi.fn();
    const { result } = renderHook(() =>
      useNativeMenuHandlers({
        insertMarkdownSnippet,
        insertMarkdownTable,
        openDocument: vi.fn(),
        openFolder: vi.fn(),
        runEditorShortcut: vi.fn(),
        saveDocument: vi.fn(),
        saveDocumentAs: vi.fn()
      })
    );

    result.current.insertTable?.();

    expect(insertMarkdownTable).toHaveBeenCalledTimes(1);
    expect(insertMarkdownSnippet).not.toHaveBeenCalled();
  });

  it("routes native AI context menu commands to localized inline AI actions", () => {
    const runAiQuickAction = vi.fn();
    const { result } = renderHook(() =>
      useNativeMenuHandlers({
        ...baseOptions,
        language: "zh-CN",
        runAiQuickAction
      })
    );

    result.current.aiPolish?.();
    result.current.aiContinueWriting?.();
    result.current.aiTranslate?.();

    expect(runAiQuickAction).toHaveBeenNthCalledWith(1, "polish", "润色");
    expect(runAiQuickAction).toHaveBeenNthCalledWith(2, "continue", "续写");
    expect(runAiQuickAction).toHaveBeenNthCalledWith(3, "translate", "翻译");
  });

  it("routes native formatting commands through custom markdown shortcuts", () => {
    const runEditorShortcut = vi.fn();
    const { result } = renderHook(() =>
      useNativeMenuHandlers({
        ...baseOptions,
        markdownShortcuts: {
          bold: "Mod+Alt+B"
        },
        runEditorShortcut
      })
    );

    result.current.formatBold?.();

    expect(runEditorShortcut).toHaveBeenCalledWith("B", {
      altKey: true,
      shiftKey: false
    });
  });

  it("routes native application commands to app toggles", () => {
    const closeDocument = vi.fn();
    const toggleAiAgent = vi.fn();
    const toggleAiCommand = vi.fn();
    const toggleMarkdownFiles = vi.fn();
    const toggleSourceMode = vi.fn();
    const { result } = renderHook(() =>
      useNativeMenuHandlers({
        ...baseOptions,
        closeDocument,
        toggleAiAgent,
        toggleAiCommand,
        toggleMarkdownFiles,
        toggleSourceMode
      })
    );

    result.current.closeDocument?.();
    result.current.toggleMarkdownFiles?.();
    result.current.toggleAiAgent?.();
    result.current.toggleAiCommand?.();
    result.current.toggleSourceMode?.();

    expect(closeDocument).toHaveBeenCalledTimes(1);
    expect(toggleMarkdownFiles).toHaveBeenCalledTimes(1);
    expect(toggleAiAgent).toHaveBeenCalledTimes(1);
    expect(toggleAiCommand).toHaveBeenCalledTimes(1);
    expect(toggleSourceMode).toHaveBeenCalledTimes(1);
  });

  it("routes the native open folder menu command to the folder opener", () => {
    const openFolder = vi.fn();
    const { result } = renderHook(() =>
      useNativeMenuHandlers({
        ...baseOptions,
        openFolder
      })
    );

    result.current.openFolder?.();

    expect(openFolder).toHaveBeenCalledTimes(1);
  });
});

describe("useApplicationShortcuts", () => {
  const baseOptions = {
    openDocument: vi.fn(),
    openFolder: vi.fn(),
    saveDocument: vi.fn(),
    saveDocumentAs: vi.fn()
  };

  it("routes configurable app shortcuts to panel toggles", () => {
    const toggleAiAgent = vi.fn();
    renderHook(() =>
      useApplicationShortcuts({
        ...baseOptions,
        markdownShortcuts: {
          toggleAiAgent: "Mod+Alt+A"
        },
        toggleAiAgent
      })
    );

    fireEvent.keyDown(window, {
      key: "a",
      altKey: true,
      metaKey: true
    });

    expect(toggleAiAgent).toHaveBeenCalledTimes(1);
  });

  it("routes the configurable inline AI command shortcut", () => {
    const toggleAiCommand = vi.fn();
    renderHook(() =>
      useApplicationShortcuts({
        ...baseOptions,
        markdownShortcuts: {
          toggleAiCommand: "Mod+Alt+U"
        },
        toggleAiCommand
      })
    );

    fireEvent.keyDown(window, {
      key: "u",
      altKey: true,
      metaKey: true
    });

    expect(toggleAiCommand).toHaveBeenCalledTimes(1);
  });

  it("routes the default source mode shortcut", () => {
    const toggleSourceMode = vi.fn();
    renderHook(() =>
      useApplicationShortcuts({
        ...baseOptions,
        toggleSourceMode
      })
    );

    fireEvent.keyDown(window, {
      key: "s",
      altKey: true,
      metaKey: true
    });

    expect(toggleSourceMode).toHaveBeenCalledTimes(1);
  });

  it("closes the current document from the default close shortcut", () => {
    const closeDocument = vi.fn();
    renderHook(() =>
      useApplicationShortcuts({
        ...baseOptions,
        closeDocument
      })
    );

    fireEvent.keyDown(window, {
      key: "w",
      metaKey: true
    });

    expect(closeDocument).toHaveBeenCalledTimes(1);
  });
});
