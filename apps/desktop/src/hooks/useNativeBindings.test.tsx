import { renderHook } from "@testing-library/react";
import { useNativeMenuHandlers } from "./useNativeBindings";

describe("useNativeMenuHandlers", () => {
  const baseOptions = {
    insertMarkdownSnippet: vi.fn(),
    insertMarkdownTable: vi.fn(),
    openDocument: vi.fn(),
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
});
