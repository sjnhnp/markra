import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import {
  openNativeMarkdownFolder,
  openNativeMarkdownFileInNewWindow,
  openNativeMarkdownPath,
  readNativeMarkdownFile,
  saveNativeMarkdownFile,
  installNativeMarkdownFileDrop,
  listNativeMarkdownFilesForPath,
  watchNativeMarkdownFile
} from "./lib/nativeFile";
import {
  installNativeApplicationMenu,
  installNativeEditorContextMenu,
  type NativeMenuHandlers
} from "./lib/nativeMenu";
import {
  consumeWelcomeDocumentState,
  getStoredTheme,
  resetWelcomeDocumentState,
  saveStoredTheme
} from "./lib/appSettings";
import { listenAppThemeChanged, notifyAppThemeChanged } from "./lib/settingsEvents";

vi.mock("./lib/nativeFile", () => ({
  installNativeMarkdownFileDrop: vi.fn(),
  openNativeMarkdownFolder: vi.fn(),
  openNativeMarkdownFileInNewWindow: vi.fn(),
  openNativeMarkdownPath: vi.fn(),
  readNativeMarkdownFile: vi.fn(),
  saveNativeMarkdownFile: vi.fn(),
  watchNativeMarkdownFile: vi.fn(),
  listNativeMarkdownFilesForPath: vi.fn()
}));

vi.mock("./lib/nativeMenu", () => ({
  installNativeApplicationMenu: vi.fn(),
  installNativeEditorContextMenu: vi.fn()
}));

vi.mock("./lib/appSettings", () => ({
  consumeWelcomeDocumentState: vi.fn(),
  getStoredTheme: vi.fn(),
  resetWelcomeDocumentState: vi.fn(),
  saveStoredTheme: vi.fn()
}));

vi.mock("./lib/settingsEvents", () => ({
  listenAppThemeChanged: vi.fn(),
  notifyAppThemeChanged: vi.fn()
}));

const mockedOpenNativeMarkdownFolder = vi.mocked(openNativeMarkdownFolder);
const mockedOpenNativeMarkdownFileInNewWindow = vi.mocked(openNativeMarkdownFileInNewWindow);
const mockedOpenNativeMarkdownPath = vi.mocked(openNativeMarkdownPath);
const mockedReadNativeMarkdownFile = vi.mocked(readNativeMarkdownFile);
const mockedSaveNativeMarkdownFile = vi.mocked(saveNativeMarkdownFile);
const mockedInstallNativeMarkdownFileDrop = vi.mocked(installNativeMarkdownFileDrop);
const mockedListNativeMarkdownFilesForPath = vi.mocked(listNativeMarkdownFilesForPath);
const mockedWatchNativeMarkdownFile = vi.mocked(watchNativeMarkdownFile);
const mockedInstallNativeApplicationMenu = vi.mocked(installNativeApplicationMenu);
const mockedInstallNativeEditorContextMenu = vi.mocked(installNativeEditorContextMenu);
const mockedConsumeWelcomeDocumentState = vi.mocked(consumeWelcomeDocumentState);
const mockedGetStoredTheme = vi.mocked(getStoredTheme);
const mockedResetWelcomeDocumentState = vi.mocked(resetWelcomeDocumentState);
const mockedSaveStoredTheme = vi.mocked(saveStoredTheme);
const mockedListenAppThemeChanged = vi.mocked(listenAppThemeChanged);
const mockedNotifyAppThemeChanged = vi.mocked(notifyAppThemeChanged);

const mockNativePath = "/mock-files/native.md";
const mockDroppedPath = "/mock-files/dropped.md";
const mockFolderPath = "/mock-files/vault";
const mockUntitledPath = "/mock-files/Untitled.md";

function mockOpenMarkdownFile(file: { content: string; name: string; path: string }) {
  mockedOpenNativeMarkdownPath.mockResolvedValue({
    kind: "file",
    file
  });
}

describe("Markra workspace", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    mockedConsumeWelcomeDocumentState.mockReset();
    mockedInstallNativeMarkdownFileDrop.mockReset();
    mockedOpenNativeMarkdownFolder.mockReset();
    mockedOpenNativeMarkdownFileInNewWindow.mockReset();
    mockedOpenNativeMarkdownPath.mockReset();
    mockedReadNativeMarkdownFile.mockReset();
    mockedSaveNativeMarkdownFile.mockReset();
    mockedListNativeMarkdownFilesForPath.mockReset();
    mockedWatchNativeMarkdownFile.mockReset();
    mockedInstallNativeApplicationMenu.mockReset();
    mockedInstallNativeEditorContextMenu.mockReset();
    mockedGetStoredTheme.mockReset();
    mockedResetWelcomeDocumentState.mockReset();
    mockedSaveStoredTheme.mockReset();
    mockedListenAppThemeChanged.mockReset();
    mockedNotifyAppThemeChanged.mockReset();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-window");
    mockedWatchNativeMarkdownFile.mockResolvedValue(() => {});
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([]);
    mockedInstallNativeMarkdownFileDrop.mockResolvedValue(() => {});
    mockedInstallNativeApplicationMenu.mockResolvedValue(() => {});
    mockedInstallNativeEditorContextMenu.mockResolvedValue(() => {});
    mockedConsumeWelcomeDocumentState.mockResolvedValue(true);
    mockedGetStoredTheme.mockResolvedValue("light");
    mockedResetWelcomeDocumentState.mockResolvedValue(undefined);
    mockedSaveStoredTheme.mockResolvedValue(undefined);
    mockedListenAppThemeChanged.mockResolvedValue(() => {});
    mockedNotifyAppThemeChanged.mockResolvedValue(undefined);
  });

  it("renders a Typora-like minimal writing surface", async () => {
    const { container } = render(<App />);
    const shell = container.querySelector(".app-shell");

    expect(screen.getByRole("heading", { name: "Untitled.md" })).toBeInTheDocument();
    expect(screen.getByLabelText("Window drag region")).toBeInTheDocument();
    expect(await screen.findByText("Welcome to Markra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Markdown or Folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Markdown Folder" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown editor")).toHaveAttribute("data-editor-engine", "milkdown");
    expect(container.querySelector("[data-milkdown-root]")).toBeInTheDocument();
    expect(screen.queryByText("文件")).not.toBeInTheDocument();
    expect(screen.queryByText("AI actions")).not.toBeInTheDocument();
    expect(container.querySelector(".traffic-light")).not.toBeInTheDocument();
    expect(container.querySelector(".native-title")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toBeInTheDocument();
    expect(shell).toHaveClass("bg-(--bg-primary)");
    expect(shell).toHaveClass("grid-rows-[minmax(0,1fr)]");
  });

  it("loads and persists the app color theme", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    mockedGetStoredTheme.mockResolvedValue("dark");

    render(<App />);

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dark"));

    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await waitFor(() => expect(mockedSaveStoredTheme).toHaveBeenCalledWith("light"));
    await waitFor(() => expect(mockedNotifyAppThemeChanged).toHaveBeenCalledWith("light"));
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });

  it("updates the editor window when another window changes the theme", async () => {
    let onThemeChanged: ((theme: "light" | "dark") => void) | null = null;
    mockedListenAppThemeChanged.mockImplementation(async (listener) => {
      onThemeChanged = listener;
      return () => {};
    });

    render(<App />);

    await waitFor(() => expect(mockedListenAppThemeChanged).toHaveBeenCalledTimes(1));
    act(() => {
      onThemeChanged?.("dark");
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("renders an independent settings window route", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    window.history.pushState({}, "", "/?settings=1");

    render(<App />);

    expect(await screen.findByRole("main", { name: "Markra settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Color theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use dark theme" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByLabelText("Markdown editor")).not.toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-window", "settings");

    fireEvent.click(screen.getByRole("button", { name: "Use dark theme" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    await waitFor(() => expect(mockedSaveStoredTheme).toHaveBeenCalledWith("dark"));
    await waitFor(() => expect(mockedNotifyAppThemeChanged).toHaveBeenCalledWith("dark"));
  });

  it("resets the welcome document from settings", async () => {
    window.history.pushState({}, "", "/?settings=1");

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Show welcome next launch" }));

    await waitFor(() => expect(mockedResetWelcomeDocumentState).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Welcome document will show next launch.");
  });

  it("opens a folder markdown tree from the lower-left file list button", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "native.md", path: mockNativePath, relativePath: "native.md" },
      { name: "guide.md", path: "/mock-files/docs/guide.md", relativePath: "docs/guide.md" }
    ]);

    const { container } = render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();
    await waitFor(() => expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockNativePath));

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("complementary", { name: "Markdown file tree" })).not.toHaveClass("fixed");
    expect(container.querySelector(".workspace-layout")).toHaveClass("grid-cols-[18rem_minmax(0,1fr)]");
    expect(screen.getByText("文件")).toBeInTheDocument();
    expect(screen.getByText("mock-files")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "docs" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "native.md" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button", { name: "docs/guide.md" })).not.toBeInTheDocument();
  });

  it("opens a markdown folder from the shared Cmd+O open picker", async () => {
    mockedOpenNativeMarkdownPath.mockResolvedValue({
      kind: "folder",
      folder: {
        path: mockFolderPath,
        name: "vault"
      }
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "index.md", path: "/mock-files/vault/index.md", relativePath: "index.md" },
      { name: "note.md", path: "/mock-files/vault/docs/note.md", relativePath: "docs/note.md" }
    ]);

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("vault")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "index.md" })).toBeInTheDocument();
    expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockFolderPath);
  });

  it("opens a markdown folder into the sidebar file tree", async () => {
    mockedOpenNativeMarkdownFolder.mockResolvedValue({
      path: mockFolderPath,
      name: "vault"
    });
    mockedListNativeMarkdownFilesForPath.mockResolvedValue([
      { name: "index.md", path: "/mock-files/vault/index.md", relativePath: "index.md" },
      { name: "note.md", path: "/mock-files/vault/docs/note.md", relativePath: "docs/note.md" }
    ]);

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true, shiftKey: true });

    expect(await screen.findByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("vault")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "index.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "docs" })).toHaveAttribute("aria-expanded", "false");
    expect(mockedListNativeMarkdownFilesForPath).toHaveBeenCalledWith(mockFolderPath);
  });

  it("opens a markdown file from the current folder tree", async () => {
    const guidePath = "/mock-files/docs/guide.md";
    const rootTree = [
      { name: "native.md", path: mockNativePath, relativePath: "native.md" },
      { name: "guide.md", path: guidePath, relativePath: "docs/guide.md" }
    ];
    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedListNativeMarkdownFilesForPath.mockImplementation(async (path) =>
      path === guidePath ? [{ name: "guide.md", path: guidePath, relativePath: "guide.md" }] : rootTree
    );
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Guide\n\nOpened from the folder tree.",
      name: "guide.md",
      path: guidePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "docs" }));
    fireEvent.click(await screen.findByRole("button", { name: "docs/guide.md" }));

    expect(await screen.findByText("Guide")).toBeInTheDocument();
    expect(screen.getByText("Opened from the folder tree.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "guide.md" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Markdown file tree" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "docs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "native.md" })).toBeInTheDocument();
    expect(mockedListNativeMarkdownFilesForPath).not.toHaveBeenCalledWith(guidePath);
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(guidePath);
  });

  it("switches the sidebar top-left action to a document outline view", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\n## Details",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));

    expect(screen.getByText("大纲")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Document outline" })).toHaveTextContent("Native file");
    expect(screen.getByRole("list", { name: "Document outline" })).toHaveTextContent("Details");
    expect(screen.getByRole("button", { name: "Toggle Markdown files" })).toHaveAttribute("aria-pressed", "true");
  });

  it("focuses the editor when an outline heading is selected", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nParagraph\n\n## Details\n\nTarget body",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    await waitFor(() => expect(screen.getByRole("textbox", { name: "Markdown document" })).toHaveFocus());
  });

  it("scrolls a selected outline heading below the top of the writing viewport", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nParagraph\n\n## Details\n\nTarget body",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("Native file")).toBeInTheDocument();

    const writingSurface = screen.getByLabelText("Writing surface");
    const detailsHeading = screen.getByRole("heading", { name: "Details" });
    const scrollTo = vi.fn();
    Object.defineProperty(writingSurface, "scrollTop", {
      configurable: true,
      value: 120
    });
    Object.defineProperty(writingSurface, "scrollTo", {
      configurable: true,
      value: scrollTo
    });
    vi.spyOn(writingSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 710,
      height: 700,
      left: 0,
      right: 900,
      top: 10,
      width: 900,
      x: 0,
      y: 10,
      toJSON: () => ({})
    });
    vi.spyOn(detailsHeading, "getBoundingClientRect").mockReturnValue({
      bottom: 350,
      height: 40,
      left: 160,
      right: 760,
      top: 310,
      width: 600,
      x: 160,
      y: 310,
      toJSON: () => ({})
    });

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "Details" }));

    await waitFor(() =>
      expect(scrollTo).toHaveBeenCalledWith({
        behavior: "auto",
        top: 396
      })
    );
  });

  it("keeps outline heading navigation stable across repeated heading clicks", async () => {
    mockOpenMarkdownFile({
      content: "# A\n\nA body\n\n# B\n\nB body",
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });
    expect(await screen.findByText("A body")).toBeInTheDocument();

    const writingSurface = screen.getByLabelText("Writing surface");
    const headingA = screen.getByRole("heading", { name: "A" });
    const headingB = screen.getByRole("heading", { name: "B" });
    const scrollTo = vi.fn();
    let currentScrollTop = 0;
    Object.defineProperty(writingSurface, "scrollTop", {
      configurable: true,
      get: () => currentScrollTop
    });
    Object.defineProperty(writingSurface, "scrollTo", {
      configurable: true,
      value: scrollTo
    });
    scrollTo.mockImplementation(({ top }: ScrollToOptions) => {
      currentScrollTop = Number(top);
    });
    vi.spyOn(writingSurface, "getBoundingClientRect").mockReturnValue({
      bottom: 710,
      height: 700,
      left: 0,
      right: 900,
      top: 10,
      width: 900,
      x: 0,
      y: 10,
      toJSON: () => ({})
    });
    vi.spyOn(headingA, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 50 - currentScrollTop,
      height: 40,
      left: 160,
      right: 760,
      top: 10 - currentScrollTop,
      width: 600,
      x: 160,
      y: 10 - currentScrollTop,
      toJSON: () => ({})
    }));
    vi.spyOn(headingB, "getBoundingClientRect").mockImplementation(() => ({
      bottom: 450 - currentScrollTop,
      height: 40,
      left: 160,
      right: 760,
      top: 410 - currentScrollTop,
      width: 600,
      x: 160,
      y: 410 - currentScrollTop,
      toJSON: () => ({})
    }));

    fireEvent.click(screen.getByRole("button", { name: "Toggle Markdown files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show outline" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    fireEvent.click(screen.getByRole("button", { name: "B" }));

    await waitFor(() =>
      expect(scrollTo.mock.calls.map(([options]) => (options as ScrollToOptions).top)).toEqual([376, 0, 376])
    );
  });

  it("shows the welcome document only on the first nonblank app launch", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const firstLaunch = render(<App />);

    expect(await screen.findByText("Welcome to Markra")).toBeInTheDocument();

    firstLaunch.unmount();
    render(<App />);

    expect(screen.getByRole("heading", { name: "Untitled.md" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Markdown editor")).toHaveTextContent(/^$/);
    expect(screen.queryByText("Welcome to Markra")).not.toBeInTheDocument();
    expect(mockedConsumeWelcomeDocumentState).toHaveBeenCalledTimes(2);
  });

  it("starts a native new-document window with an empty untitled document", async () => {
    window.history.pushState({}, "", "/?blank=1");

    render(<App />);

    expect(screen.getByRole("heading", { name: "Untitled.md" })).toBeInTheDocument();
    expect(await screen.findByLabelText("Markdown editor")).toHaveTextContent(/^$/);
    expect(screen.queryByText("Welcome to Markra")).not.toBeInTheDocument();
    expect(mockedConsumeWelcomeDocumentState).not.toHaveBeenCalled();
  });

  it("focuses the editor when a native new-document window opens", async () => {
    window.history.pushState({}, "", "/?blank=1");

    render(<App />);

    const editor = await screen.findByRole("textbox", { name: "Markdown document" });

    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it("loads a markdown file when a native file window opens with an initial path", async () => {
    window.history.pushState({}, "", "/?path=%2Fmock-files%2Fdropped.md");
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Dropped file\n\nOpened in a new window.",
      name: "dropped.md",
      path: mockDroppedPath
    });

    render(<App />);

    expect(await screen.findByText("Dropped file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dropped.md" })).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockDroppedPath);
    expect(mockedConsumeWelcomeDocumentState).not.toHaveBeenCalled();
  });

  it("opens a dropped markdown file in the current empty editor", async () => {
    mockedConsumeWelcomeDocumentState.mockResolvedValue(false);
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Dropped file\n\nOpened from drag and drop.",
      name: "dropped.md",
      path: mockDroppedPath
    });

    render(<App />);
    await waitFor(() => expect(mockedInstallNativeMarkdownFileDrop).toHaveBeenCalledTimes(1));
    const handleDrop = mockedInstallNativeMarkdownFileDrop.mock.calls[0]?.[0];

    await act(async () => {
      await handleDrop?.(mockDroppedPath);
    });

    expect(await screen.findByText("Dropped file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "dropped.md" })).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockDroppedPath);
    expect(mockedOpenNativeMarkdownFileInNewWindow).not.toHaveBeenCalled();
  });

  it("opens a dropped markdown file in a new window when the current editor has content", async () => {
    render(<App />);
    await screen.findByText("Welcome to Markra");
    await waitFor(() => expect(mockedInstallNativeMarkdownFileDrop).toHaveBeenCalledTimes(1));
    const handleDrop = mockedInstallNativeMarkdownFileDrop.mock.calls[0]?.[0];

    await act(async () => {
      await handleDrop?.(mockDroppedPath);
    });

    expect(mockedOpenNativeMarkdownFileInNewWindow).toHaveBeenCalledWith(mockDroppedPath);
    expect(mockedReadNativeMarkdownFile).not.toHaveBeenCalledWith(mockDroppedPath);
    expect(screen.getByText("Welcome to Markra")).toBeInTheDocument();
  });

  it("saves an untitled document with the native save dialog shortcut", async () => {
    mockedSaveNativeMarkdownFile.mockResolvedValue({
      name: "Untitled.md",
      path: mockUntitledPath
    });

    render(<App />);
    await screen.findByText("Welcome to Markra");

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: null,
          suggestedName: "Untitled.md"
        })
      )
    );
  });

  it("opens and saves markdown files through native Tauri file APIs", async () => {
    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedSaveNativeMarkdownFile.mockResolvedValue({
      name: "native.md",
      path: mockNativePath
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(await screen.findByText("Native file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "native.md" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: mockNativePath,
          suggestedName: "native.md"
        })
      )
    );
  });

  it("wires native menu file actions to the current document commands", async () => {
    mockOpenMarkdownFile({
      content: "# Native menu file\n\nOpened from the native menu.",
      name: "native-menu.md",
      path: mockNativePath
    });
    mockedSaveNativeMarkdownFile.mockResolvedValue({
      name: "native-menu.md",
      path: mockNativePath
    });

    render(<App />);

    await waitFor(() => expect(mockedInstallNativeApplicationMenu).toHaveBeenCalledTimes(1));
    const menuHandlers = mockedInstallNativeApplicationMenu.mock.calls[0]?.[0] as NativeMenuHandlers;

    await act(async () => {
      await menuHandlers.openDocument?.();
    });

    expect(await screen.findByText("Native menu file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "native-menu.md" })).toBeInTheDocument();

    await act(async () => {
      await menuHandlers.saveDocument?.();
    });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: mockNativePath,
          suggestedName: "native-menu.md"
        })
      )
    );

    await act(async () => {
      await menuHandlers.saveDocumentAs?.();
    });

    await waitFor(() =>
      expect(mockedSaveNativeMarkdownFile).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: null,
          suggestedName: "native-menu.md"
        })
      )
    );

    expect((menuHandlers as Record<string, unknown>).newDocument).toBeUndefined();
    expect((menuHandlers as Record<string, unknown>).openFolder).toBeUndefined();
    expect(screen.getByRole("heading", { name: "native-menu.md" })).toBeInTheDocument();
  });

  it("reloads the current file when a native watcher reports an external change", async () => {
    let emitExternalChange: (path: string) => void | Promise<void> = () => {};

    mockOpenMarkdownFile({
      content: "# Native file\n\nOpened from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedReadNativeMarkdownFile.mockResolvedValue({
      content: "# Changed elsewhere\n\nReloaded from disk.",
      name: "native.md",
      path: mockNativePath
    });
    mockedWatchNativeMarkdownFile.mockImplementation(async (_, onChange) => {
      emitExternalChange = onChange;
      return () => {};
    });

    render(<App />);

    fireEvent.keyDown(window, { key: "o", metaKey: true });

    expect(await screen.findByText("Native file")).toBeInTheDocument();

    await waitFor(() => expect(mockedWatchNativeMarkdownFile).toHaveBeenCalledWith(mockNativePath, expect.any(Function)));
    await emitExternalChange(mockNativePath);

    expect(await screen.findByText("Changed elsewhere")).toBeInTheDocument();
    expect(screen.getByText("Reloaded from disk.")).toBeInTheDocument();
    expect(mockedReadNativeMarkdownFile).toHaveBeenCalledWith(mockNativePath);
  });
});
