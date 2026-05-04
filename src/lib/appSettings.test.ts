import { load } from "@tauri-apps/plugin-store";
import {
  consumeWelcomeDocumentState,
  getStoredLanguage,
  getStoredTheme,
  resetWelcomeDocumentState,
  saveStoredLanguage,
  saveStoredTheme
} from "./appSettings";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn()
}));

const mockedLoad = vi.mocked(load);

describe("app settings", () => {
  const store = {
    delete: vi.fn(),
    get: vi.fn(),
    save: vi.fn(),
    set: vi.fn()
  };

  beforeEach(() => {
    mockedLoad.mockReset();
    store.delete.mockReset();
    store.get.mockReset();
    store.save.mockReset();
    store.set.mockReset();
    mockedLoad.mockResolvedValue(store as unknown as Awaited<ReturnType<typeof load>>);
  });

  it("consumes and persists the first welcome document state in the Tauri app data store", async () => {
    store.get.mockResolvedValue(undefined);

    await expect(consumeWelcomeDocumentState()).resolves.toBe(true);

    expect(mockedLoad).toHaveBeenCalledWith("settings.json", { autoSave: false, defaults: {} });
    expect(store.get).toHaveBeenCalledWith("welcomeDocumentSeen");
    expect(store.set).toHaveBeenCalledWith("welcomeDocumentSeen", true);
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite settings after the welcome document was already seen", async () => {
    store.get.mockResolvedValue(true);

    await expect(consumeWelcomeDocumentState()).resolves.toBe(false);

    expect(store.set).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("loads a persisted color theme from settings", async () => {
    store.get.mockResolvedValue("dark");

    await expect(getStoredTheme()).resolves.toBe("dark");

    expect(store.get).toHaveBeenCalledWith("theme");
  });

  it("falls back to light when the stored theme is missing or invalid", async () => {
    store.get.mockResolvedValue("sepia");

    await expect(getStoredTheme()).resolves.toBe("light");
  });

  it("persists the selected color theme", async () => {
    await saveStoredTheme("dark");

    expect(store.set).toHaveBeenCalledWith("theme", "dark");
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("loads English as the default app language", async () => {
    store.get.mockResolvedValue("pirate");

    await expect(getStoredLanguage()).resolves.toBe("en");

    expect(store.get).toHaveBeenCalledWith("language");
  });

  it("loads and persists a supported app language", async () => {
    store.get.mockResolvedValue("zh-CN");

    await expect(getStoredLanguage()).resolves.toBe("zh-CN");

    await saveStoredLanguage("ja");

    expect(store.set).toHaveBeenCalledWith("language", "ja");
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("resets the welcome document state for the next launch", async () => {
    await resetWelcomeDocumentState();

    expect(store.delete).toHaveBeenCalledWith("welcomeDocumentSeen");
    expect(store.save).toHaveBeenCalledTimes(1);
  });
});
