import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { listNativeMarkdownFilesForPath, openNativeMarkdownFolder } from "../lib/nativeFile";
import { folderNameFromDocumentPath, pathNameFromPath, useMarkdownFileTree } from "./useMarkdownFileTree";

vi.mock("../lib/nativeFile", () => ({
  listNativeMarkdownFilesForPath: vi.fn(),
  openNativeMarkdownFolder: vi.fn()
}));

const mockedListNativeMarkdownFilesForPath = vi.mocked(listNativeMarkdownFilesForPath);
const mockedOpenNativeMarkdownFolder = vi.mocked(openNativeMarkdownFolder);

function FileTreeProbe({ currentPath = null }: { currentPath?: string | null }) {
  const tree = useMarkdownFileTree();

  return (
    <section>
      <p data-testid="root-name">{tree.rootNameForDocument(currentPath)}</p>
      <p data-testid="open-state">{tree.open ? "open" : "closed"}</p>
      <button type="button" onClick={tree.openMarkdownFolder}>
        Open folder
      </button>
      <button type="button" onClick={() => tree.toggle(currentPath)}>
        Toggle
      </button>
      <ol>
        {tree.files.map((file) => (
          <li key={file.path}>{file.relativePath}</li>
        ))}
      </ol>
    </section>
  );
}

describe("useMarkdownFileTree", () => {
  beforeEach(() => {
    mockedListNativeMarkdownFilesForPath.mockReset();
    mockedOpenNativeMarkdownFolder.mockReset();
  });

  it("derives compact folder labels from file and folder paths", () => {
    expect(folderNameFromDocumentPath("/vault/docs/readme.md")).toBe("docs");
    expect(folderNameFromDocumentPath(null)).toBe("No folder");
    expect(pathNameFromPath("/vault/docs")).toBe("docs");
  });

  it("opens a selected markdown folder as the tree root", async () => {
    mockedOpenNativeMarkdownFolder.mockResolvedValue({
      path: "/vault",
      name: "vault"
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { path: "/vault/index.md", name: "index.md", relativePath: "index.md" }
    ]);

    render(<FileTreeProbe />);

    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));

    expect(await screen.findByText("index.md")).toBeInTheDocument();
    expect(screen.getByTestId("root-name")).toHaveTextContent("vault");
    expect(screen.getByTestId("open-state")).toHaveTextContent("open");
    expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith("/vault");
  });

  it("refreshes from the current document path when toggled open without an explicit folder", async () => {
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { path: "/vault/readme.md", name: "readme.md", relativePath: "readme.md" }
    ]);

    render(<FileTreeProbe currentPath="/vault/readme.md" />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));

    await waitFor(() => expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith("/vault/readme.md"));
    expect(screen.getByTestId("root-name")).toHaveTextContent("vault");
    expect(screen.getByTestId("open-state")).toHaveTextContent("open");
  });
});
