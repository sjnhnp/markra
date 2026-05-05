import { load } from "@tauri-apps/plugin-store";
import {
  consumeWelcomeDocumentState,
  getStoredAiSettings,
  getStoredLanguage,
  getStoredTheme,
  resetWelcomeDocumentState,
  saveStoredAiSettings,
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

  it("loads and persists the system color theme preference", async () => {
    store.get.mockResolvedValue("system");

    await expect(getStoredTheme()).resolves.toBe("system");

    await saveStoredTheme("system");

    expect(store.set).toHaveBeenCalledWith("theme", "system");
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("falls back to the system theme preference when the stored theme is missing or invalid", async () => {
    store.get.mockResolvedValue("sepia");

    await expect(getStoredTheme()).resolves.toBe("system");
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

  it("loads default AI provider settings when none are stored", async () => {
    store.get.mockResolvedValue(undefined);

    const settings = await getStoredAiSettings();

    expect(store.get).toHaveBeenCalledWith("aiProviders");
    expect(settings.providers.map((provider) => provider.id)).toContain("openai");
    expect(settings.providers.find((provider) => provider.id === "azure-openai")?.baseUrl).toBe(
      "https://your-resource-name.openai.azure.com"
    );
    expect(settings.providers[0]?.models[0]?.capability).toBe("text");
  });

  it("fills default API URLs for stored built-in AI providers without one", async () => {
    store.get.mockResolvedValue({
      defaultModelId: "gpt-4o",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "gpt-4o",
          enabled: false,
          id: "openai",
          models: [{ capability: "text", enabled: true, id: "gpt-4o", name: "GPT-4o" }],
          name: "OpenAI",
          type: "openai"
        },
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "default",
          enabled: false,
          id: "custom-provider-1",
          models: [{ capability: "text", enabled: true, id: "default", name: "Default model" }],
          name: "Custom Provider",
          type: "openai-compatible"
        }
      ]
    });

    const settings = await getStoredAiSettings();

    expect(settings.providers.find((provider) => provider.id === "openai")?.baseUrl).toBe("https://api.openai.com/v1");
    expect(settings.providers.find((provider) => provider.id === "custom-provider-1")?.baseUrl).toBe("");
  });

  it("refreshes stale built-in AI provider model defaults from stored settings", async () => {
    store.get.mockResolvedValue({
      defaultModelId: "gpt-4o",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "gpt-4o",
          enabled: false,
          id: "openai",
          models: [{ capability: "text", enabled: true, id: "gpt-4o", name: "GPT-4o" }],
          name: "OpenAI",
          type: "openai"
        },
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "deepseek-chat",
          enabled: false,
          id: "deepseek",
          models: [
            { capability: "text", enabled: true, id: "deepseek-chat", name: "DeepSeek Chat" },
            { capability: "text", enabled: true, id: "deepseek-reasoner", name: "DeepSeek Reasoner" }
          ],
          name: "DeepSeek",
          type: "deepseek"
        }
      ]
    });

    const settings = await getStoredAiSettings();
    const openai = settings.providers.find((provider) => provider.id === "openai");
    const deepseek = settings.providers.find((provider) => provider.id === "deepseek");

    expect(settings.defaultModelId).toBe("gpt-5.4");
    expect(openai?.defaultModelId).toBe("gpt-5.4");
    expect(openai?.models.map((model) => model.id)).toEqual(["gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-image-1.5"]);
    expect(deepseek?.defaultModelId).toBe("deepseek-v4-pro");
    expect(deepseek?.models.map((model) => model.id)).toEqual(["deepseek-v4-pro", "deepseek-v4-flash"]);
  });

  it("preserves user-added AI provider models during normalization", async () => {
    store.get.mockResolvedValue({
      defaultModelId: "gpt-custom",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "",
          baseUrl: "https://proxy.example.test/v1",
          defaultModelId: "gpt-custom",
          enabled: true,
          id: "openai",
          models: [{ capability: "text", enabled: true, id: "gpt-custom", name: "GPT Custom" }],
          name: "OpenAI",
          type: "openai"
        },
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "writer-model",
          enabled: true,
          id: "custom-provider-1",
          models: [{ capability: "text", enabled: true, id: "writer-model", name: "Writer Model" }],
          name: "Custom Provider",
          type: "openai-compatible"
        }
      ]
    });

    const settings = await getStoredAiSettings();

    expect(settings.defaultModelId).toBe("gpt-custom");
    expect(settings.providers.find((provider) => provider.id === "openai")?.models.map((model) => model.id)).toEqual(["gpt-custom"]);
    expect(settings.providers.find((provider) => provider.id === "custom-provider-1")?.models.map((model) => model.id)).toEqual([
      "writer-model"
    ]);
  });

  it("persists AI provider settings in the app settings store", async () => {
    const settings = {
      defaultModelId: "gpt-4o",
      defaultProviderId: "openai",
      providers: [
        {
          apiKey: "test-key",
          baseUrl: "https://api.openai.com/v1",
          defaultModelId: "gpt-4o",
          enabled: true,
          id: "openai",
          models: [
            {
              capability: "text" as const,
              enabled: true,
              id: "gpt-4o",
              name: "GPT-4o"
            }
          ],
          name: "OpenAI",
          type: "openai" as const
        }
      ]
    };

    await saveStoredAiSettings(settings);

    expect(store.set).toHaveBeenCalledWith("aiProviders", settings);
    expect(store.save).toHaveBeenCalledTimes(1);
  });
});
