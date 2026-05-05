import { load } from "@tauri-apps/plugin-store";
import {
  consumeWelcomeDocumentState,
  getStoredAiSettings,
  getStoredEditorPreferences,
  getStoredLanguage,
  getStoredTheme,
  getStoredWorkspaceState,
  resetWelcomeDocumentState,
  saveStoredAiSettings,
  saveStoredEditorPreferences,
  saveStoredLanguage,
  saveStoredTheme,
  saveStoredWorkspaceState
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

  it("loads enabled AI-on-selection as the default editor preference", async () => {
    store.get.mockResolvedValue(undefined);

    await expect(getStoredEditorPreferences()).resolves.toEqual({
      autoOpenAiOnSelection: true
    });

    expect(store.get).toHaveBeenCalledWith("editorPreferences");
  });

  it("persists editor preferences", async () => {
    await saveStoredEditorPreferences({ autoOpenAiOnSelection: false });

    expect(store.set).toHaveBeenCalledWith("editorPreferences", { autoOpenAiOnSelection: false });
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("resets the welcome document state for the next launch", async () => {
    await resetWelcomeDocumentState();

    expect(store.delete).toHaveBeenCalledWith("welcomeDocumentSeen");
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it("loads the last workspace state from settings", async () => {
    store.get.mockResolvedValue({
      filePath: "/mock-files/vault/README.md",
      fileTreeOpen: true,
      folderName: "vault",
      folderPath: "/mock-files/vault"
    });

    await expect(getStoredWorkspaceState()).resolves.toEqual({
      filePath: "/mock-files/vault/README.md",
      fileTreeOpen: true,
      folderName: "vault",
      folderPath: "/mock-files/vault"
    });

    expect(store.get).toHaveBeenCalledWith("workspace");
  });

  it("merges and persists partial workspace state updates", async () => {
    store.get.mockResolvedValue({
      filePath: null,
      fileTreeOpen: true,
      folderName: "vault",
      folderPath: "/mock-files/vault"
    });

    await saveStoredWorkspaceState({
      filePath: "/mock-files/vault/README.md"
    });

    expect(store.set).toHaveBeenCalledWith("workspace", {
      filePath: "/mock-files/vault/README.md",
      fileTreeOpen: true,
      folderName: "vault",
      folderPath: "/mock-files/vault"
    });
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
    expect(settings.providers.find((provider) => provider.id === "aliyun-bailian")).toMatchObject({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      type: "openai-compatible"
    });
    expect(settings.providers.find((provider) => provider.id === "xiaomi-mimo")).toMatchObject({
      baseUrl: "https://api.xiaomimimo.com/v1",
      type: "openai-compatible"
    });
    expect(settings.providers.find((provider) => provider.id === "volcengine")).toMatchObject({
      baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
      type: "openai-compatible"
    });
    expect(settings.providers[0]?.models[0]?.capabilities).toEqual(["text", "vision", "reasoning", "tools", "web"]);
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
          defaultModelId: "qwen3.6-plus",
          enabled: false,
          id: "aliyun-bailian",
          models: [{ capability: "text", enabled: true, id: "qwen3.6-plus", name: "Qwen3.6 Plus" }],
          name: "Qwen",
          type: "openai-compatible"
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
    expect(settings.providers.find((provider) => provider.id === "aliyun-bailian")?.baseUrl).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1"
    );
    expect(settings.providers.find((provider) => provider.id === "custom-provider-1")?.baseUrl).toBe("");
  });

  it("removes the legacy OpenAI Compatible built-in provider while preserving custom compatible providers", async () => {
    store.get.mockResolvedValue({
      defaultModelId: "default",
      defaultProviderId: "openai-compatible",
      providers: [
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "default",
          enabled: false,
          id: "openai-compatible",
          models: [{ capability: "text", enabled: true, id: "default", name: "Default model" }],
          name: "OpenAI Compatible",
          type: "openai-compatible"
        },
        {
          apiKey: "",
          baseUrl: "https://proxy.example.test/v1",
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

    expect(settings.defaultProviderId).toBe("custom-provider-1");
    expect(settings.providers.map((provider) => provider.id)).toEqual(["custom-provider-1"]);
    expect(settings.providers[0]?.type).toBe("openai-compatible");
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

    expect(settings.defaultModelId).toBe("gpt-5.5");
    expect(openai?.defaultModelId).toBe("gpt-5.5");
    expect(openai?.models.map((model) => model.id)).toEqual(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano", "gpt-image-2"]);
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

  it("enriches stored built-in AI models with current built-in capabilities", async () => {
    store.get.mockResolvedValue({
      defaultModelId: "gemini-3.1-pro-preview",
      defaultProviderId: "google",
      providers: [
        {
          apiKey: "",
          baseUrl: "",
          defaultModelId: "gemini-3.1-pro-preview",
          enabled: true,
          id: "google",
          models: [
            { capabilities: ["text"], enabled: true, id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
            { capability: "text", enabled: true, id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
            { capabilities: ["text"], enabled: true, id: "custom-gemini", name: "Custom Gemini" }
          ],
          name: "Google",
          type: "google"
        }
      ]
    });

    const settings = await getStoredAiSettings();
    const google = settings.providers.find((provider) => provider.id === "google");

    expect(google?.models.find((model) => model.id === "gemini-3.1-pro-preview")?.capabilities).toEqual([
      "text",
      "vision",
      "reasoning",
      "tools",
      "web"
    ]);
    expect(google?.models.find((model) => model.id === "gemini-3-flash-preview")?.capabilities).toEqual([
      "text",
      "vision",
      "reasoning",
      "tools",
      "web"
    ]);
    expect(google?.models.find((model) => model.id === "custom-gemini")?.capabilities).toEqual(["text"]);
  });

  it("normalizes legacy single-capability AI models into multi-capability models", async () => {
    store.get.mockResolvedValue({
      defaultModelId: "legacy-vision",
      defaultProviderId: "custom-provider-1",
      providers: [
        {
          apiKey: "",
          baseUrl: "https://proxy.example.test/v1",
          defaultModelId: "legacy-vision",
          enabled: true,
          id: "custom-provider-1",
          models: [{ capability: "vision", enabled: true, id: "legacy-vision", name: "Legacy Vision" }],
          name: "Custom Provider",
          type: "openai-compatible"
        }
      ]
    });

    const settings = await getStoredAiSettings();

    expect(settings.providers[0]?.models[0]).toMatchObject({
      capabilities: ["text", "vision"],
      id: "legacy-vision"
    });
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
              capabilities: ["text", "reasoning", "tools"] as const,
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
