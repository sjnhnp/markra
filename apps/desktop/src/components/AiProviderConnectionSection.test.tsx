import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { AiProviderConnectionSection } from "./AiProviderConnectionSection";
import type { AiProviderConfig } from "@markra/ai";
import type { I18nKey } from "@markra/shared";

function translate(key: I18nKey) {
  const labels: Partial<Record<string, string>> = {
    "settings.ai.apiAddress": "API URL",
    "settings.ai.apiKey": "API key",
    "settings.ai.apiStyle": "API style",
    "settings.ai.cancelEditModel": "Cancel",
    "settings.ai.customHeaders": "Custom headers",
    "settings.ai.customHeadersDescription": "Added to model list and chat requests.",
    "settings.ai.customHeadersEdit": "Edit custom headers",
    "settings.ai.customHeadersJson": "Custom headers JSON",
    "settings.ai.customHeadersInvalidJson": "Enter a valid JSON object.",
    "settings.ai.customHeadersSave": "Save custom headers",
    "settings.ai.localStorageNotice": "API keys are stored locally.",
    "settings.ai.providerName": "Provider name",
    "settings.ai.testApi": "Test API",
    "settings.ai.testingApi": "Testing...",
    "settings.sections.aiProviders": "Providers"
  };

  return labels[key] ?? key;
}

function provider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    apiKey: "",
    baseUrl: "https://proxy.example.test/v1",
    defaultModelId: "default",
    enabled: true,
    id: "custom-provider-1",
    models: [],
    name: "Custom Provider",
    type: "openai-compatible",
    ...overrides
  };
}

function getCodeMirrorView(container: HTMLElement) {
  const view = EditorView.findFromDOM(container);

  if (!view) {
    throw new Error("Expected the custom headers JSON editor to use CodeMirror.");
  }

  return view;
}

function replaceCodeMirrorDoc(view: EditorView, value: string) {
  act(() => {
    view.dispatch({
      changes: {
        from: 0,
        insert: value,
        to: view.state.doc.length
      }
    });
  });
}

describe("AiProviderConnectionSection", () => {
  it("lets custom providers configure request headers without exposing thinking request body settings", async () => {
    const updateSelectedProvider = vi.fn();

    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={true}
        provider={provider({
          customHeaders: '{"HTTP-Referer":"https://markra.app"}'
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={updateSelectedProvider}
      />
    );

    expect(screen.queryByLabelText("Custom headers JSON")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit custom headers" }));

    const dialog = screen.getByRole("dialog", { name: "Custom headers" });
    const editorShell = await within(dialog).findByTestId("json-code-editor");
    const jsonEditor = await within(dialog).findByRole("textbox", { name: "Custom headers JSON" });
    const editorView = getCodeMirrorView(editorShell);
    expect(editorShell).toHaveAttribute("data-language", "json");
    expect(jsonEditor.tagName).not.toBe("TEXTAREA");
    expect(editorView.state.doc.toString()).toBe('{"HTTP-Referer":"https://markra.app"}');
    expect(screen.queryByLabelText("Deep thinking request body")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("settings.ai.thinkingRequestMode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Custom request body JSON")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("settings.ai.thinkingRequestBody")).not.toBeInTheDocument();

    replaceCodeMirrorDoc(editorView, "{bad");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save custom headers" }));
    expect(within(dialog).getByText("Enter a valid JSON object.")).toBeInTheDocument();
    expect(updateSelectedProvider).not.toHaveBeenCalled();

    replaceCodeMirrorDoc(editorView, '{"X-Title":"Markra"}');
    fireEvent.click(within(dialog).getByRole("button", { name: "Save custom headers" }));
    expect(updateSelectedProvider).toHaveBeenCalledWith(expect.any(Function));
    const headerUpdater = updateSelectedProvider.mock.calls.at(-1)?.[0] as (current: AiProviderConfig) => AiProviderConfig;

    expect(headerUpdater(provider())).toMatchObject({
      customHeaders: '{"X-Title":"Markra"}'
    });
    expect(screen.queryByRole("dialog", { name: "Custom headers" })).not.toBeInTheDocument();
  });
});
