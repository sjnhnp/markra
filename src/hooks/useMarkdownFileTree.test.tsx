import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { listNativeMarkdownFilesForPath, openNativeMarkdownFolder } from "../lib/tauri/file";
import { createAiAgentSessionId, saveStoredWorkspaceState } from "../lib/settings/appSettings";
import { useMarkdownFileTree } from "./useMarkdownFileTree";

vi.mock("../lib/tauri/file", () => ({
  listNativeMarkdownFilesForPath: vi.fn(),
  openNativeMarkdownFolder: vi.fn()
}));

vi.mock("../lib/settings/appSettings", () => ({
  createAiAgentSessionId: vi.fn(),
  saveStoredWorkspaceState: vi.fn()
}));

const mockedListNativeMarkdownFilesForPath = vi.mocked(listNativeMarkdownFilesForPath);
const mockedOpenNativeMarkdownFolder = vi.mocked(openNativeMarkdownFolder);
const mockedCreateAiAgentSessionId = vi.mocked(createAiAgentSessionId);
const mockedSaveStoredWorkspaceState = vi.mocked(saveStoredWorkspaceState);

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
    mockedCreateAiAgentSessionId.mockReset();
    mockedSaveStoredWorkspaceState.mockReset();
    mockedCreateAiAgentSessionId.mockReturnValue("session-folder");
    mockedSaveStoredWorkspaceState.mockResolvedValue(undefined);
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
    expect(mockedSaveStoredWorkspaceState).toHaveBeenCalledWith({
      aiAgentSessionId: "session-folder",
      fileTreeOpen: true,
      folderName: "vault",
      folderPath: "/vault"
    });
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
    expect(mockedSaveStoredWorkspaceState).toHaveBeenCalledWith({ fileTreeOpen: true });
  });
});
