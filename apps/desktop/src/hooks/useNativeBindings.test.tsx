import { renderHook } from "@testing-library/react";
import { useNativeMenuHandlers } from "./useNativeBindings";

describe("useNativeMenuHandlers", () => {
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
});
