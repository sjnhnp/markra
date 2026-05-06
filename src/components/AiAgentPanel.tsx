import { useEffect, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowUp, Bot, BrainCircuit, FileText, Globe2, PencilLine, Sparkles, X } from "lucide-react";
import { AiModelPicker, getAiModelOptionValue, type AiModelPickerOption } from "./AiModelPicker";
import { t, type AppLanguage, type I18nKey } from "../lib/i18n";
import type { AiModelCapability, AiProviderApiStyle } from "../lib/settings/appSettings";

type AiAgentMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

type AiAgentModelOption = AiModelPickerOption & { capabilities: AiModelCapability[] };

type AiAgentPanelProps = {
  availableModels?: AiAgentModelOption[];
  language?: AppLanguage;
  modelName?: string | null;
  open: boolean;
  providerName?: string | null;
  selectedModelId?: string | null;
  selectedProviderId?: string | null;
  onClose: () => unknown;
  onSelectModel?: (providerId: string, modelId: string) => unknown;
};

const suggestionIconClassName = "shrink-0 text-(--text-secondary)";

export function AiAgentPanel({
  availableModels = [],
  language = "en",
  modelName = null,
  open,
  providerName = null,
  selectedModelId = null,
  selectedProviderId = null,
  onClose,
  onSelectModel
}: AiAgentPanelProps) {
  const [draft, setDraft] = useState("");
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [messages, setMessages] = useState<AiAgentMessage[]>([]);
  const label = (key: I18nKey) => t(language, key);
  const selectedModelValue =
    selectedProviderId && selectedModelId ? getAiModelOptionValue(selectedProviderId, selectedModelId) : "";
  const selectedModel =
    availableModels.find((model) => getAiModelOptionValue(model.providerId, model.id) === selectedModelValue) ??
    availableModels[0] ??
    null;
  const supportsThinking = selectedModel?.capabilities.includes("reasoning") ?? false;
  const supportsWebSearch = selectedModel?.capabilities.includes("web") ?? false;
  const providerModelLabel =
    selectedModel
      ? `${selectedModel.providerName} · ${selectedModel.name}`
      : providerName && modelName
        ? `${providerName} · ${modelName}`
        : (providerName ?? modelName ?? label("app.aiModelSelector"));
  const suggestions = [
    {
      icon: FileText,
      label: label("app.aiAgentSuggestionSummarize")
    },
    {
      icon: PencilLine,
      label: label("app.aiAgentSuggestionFindEdits")
    },
    {
      icon: Sparkles,
      label: label("app.aiAgentSuggestionCompareNotes")
    }
  ];
  const canSend = draft.trim().length > 0;

  useEffect(() => {
    if (!supportsThinking) setThinkingEnabled(false);
    if (!supportsWebSearch) setWebSearchEnabled(false);
  }, [supportsThinking, supportsWebSearch]);

  const sendMessage = (messageText: string) => {
    const text = messageText.trim();
    if (!text) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now(),
        role: "user",
        text
      },
      {
        id: Date.now() + 1,
        role: "assistant",
        text: label("app.aiAgentDraftResponse")
      }
    ]);
    setDraft("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(draft);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.ctrlKey) return;

    event.preventDefault();
    sendMessage(draft);
  };

  const handleSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <aside
      className={`ai-agent-panel relative z-20 flex h-full min-h-0 w-full flex-col border-l border-(--border-default) bg-(--bg-secondary) text-(--text-primary) transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        open ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
      }`}
      role="complementary"
      aria-label={label("app.aiAgent")}
      aria-hidden={open ? undefined : true}
    >
      <header className="relative z-20 min-h-12 shrink-0 border-b border-(--border-default) px-2 py-1.5">
        <span className="absolute top-1.5 left-2 inline-flex size-8 items-center justify-center text-(--text-secondary)">
          <Bot aria-hidden="true" size={15} />
        </span>
        <div className="flex min-h-9 min-w-0 flex-col items-center justify-center px-10 text-center">
          <h2 className="m-0 truncate text-[14px] leading-5 font-[560] tracking-normal text-(--text-heading)">
            {label("app.aiAgent")}
          </h2>
          {selectedModel ? (
            <div className="mt-0.5 flex min-w-0 items-center justify-center">
              <AiModelPicker
                ariaLabel={label("app.aiModelSelector")}
                models={availableModels}
                selectedModelId={selectedModelId}
                selectedProviderId={selectedProviderId}
                variant="subtitle"
                onSelect={onSelectModel}
                translate={(key) => label(key)}
              />
            </div>
          ) : (
            <p className="m-0 truncate text-[10px] leading-3 font-[520] text-(--text-secondary)">{providerModelLabel}</p>
          )}
        </div>
        <button
          className="absolute top-1.5 right-2 z-30 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
          type="button"
          aria-label={label("app.closeAiAgent")}
          onClick={onClose}
        >
          <X aria-hidden="true" size={15} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto overscroll-none px-3 py-3">
          {messages.length === 0 ? (
            <div className="grid gap-3">
              <div className="px-1 py-2">
                <p className="m-0 text-[13px] leading-5 font-[560] text-(--text-heading)">
                  {label("app.aiAgentEmptyTitle")}
                </p>
                <p className="m-0 mt-1 text-[12px] leading-5 font-[520] text-(--text-secondary)">
                  {label("app.aiAgentEmptyBody")}
                </p>
              </div>
              <div className="grid border-y border-(--border-default)">
                {suggestions.map((suggestion) => {
                  const Icon = suggestion.icon;

                  return (
                    <button
                      className="inline-flex h-9 w-full cursor-pointer items-center gap-2 border-0 border-b border-(--border-default) bg-transparent px-1 text-left text-[13px] leading-5 font-[540] text-(--text-primary) transition-[background-color,color] duration-150 ease-out last:border-b-0 hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-hover) focus-visible:text-(--text-heading) focus-visible:outline-none"
                      key={suggestion.label}
                      type="button"
                      onClick={() => handleSuggestion(suggestion.label)}
                    >
                      <Icon aria-hidden="true" className={suggestionIconClassName} size={15} />
                      <span className="min-w-0 truncate">{suggestion.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <ol className="m-0 grid list-none gap-3 p-0">
              {messages.map((message) => (
                <li
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[82%] rounded-lg bg-(--bg-active) px-3 py-2 text-[13px] leading-5 font-[560] text-(--text-heading)"
                      : "mr-auto max-w-[86%] rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 py-2 text-[13px] leading-5 font-[540] text-(--text-primary)"
                  }
                  key={message.id}
                >
                  {message.text}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form className="shrink-0 border-t border-(--border-default) p-3" onSubmit={handleSubmit}>
          <div className="relative rounded-lg border border-(--border-default) bg-(--bg-primary) px-3 pt-3 pb-2 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-(--accent) focus-within:shadow-(--ai-command-shadow)">
            <label className="sr-only" htmlFor="markra-ai-agent-input">
              {label("app.aiAgentMessage")}
            </label>
            <textarea
              id="markra-ai-agent-input"
              className="max-h-32 min-h-14 w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-5 text-(--text-primary) outline-none placeholder:text-(--text-secondary)"
              value={draft}
              placeholder={label("app.aiAgentPlaceholder")}
              rows={2}
              aria-label={label("app.aiAgentMessage")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-(--border-default) pt-2">
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
                <button
                  className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12px] leading-5 font-[620] transition-[background-color,border-color,color,opacity] duration-150 ease-out focus-visible:outline-none disabled:cursor-default disabled:opacity-45 ${
                    thinkingEnabled
                      ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                      : "border-(--border-default) bg-(--bg-secondary) text-(--text-secondary) hover:border-(--accent) hover:text-(--accent)"
                  }`}
                  type="button"
                  aria-label={label("app.aiDeepThinking")}
                  title={label("app.aiDeepThinking")}
                  aria-pressed={thinkingEnabled}
                  disabled={!supportsThinking}
                  onClick={() => setThinkingEnabled((enabled) => !enabled)}
                >
                  <BrainCircuit aria-hidden="true" size={14} />
                  <span>{label("app.aiDeepThinking")}</span>
                </button>
                <button
                  className={`inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[12px] leading-5 font-[620] transition-[background-color,border-color,color,opacity] duration-150 ease-out focus-visible:outline-none disabled:cursor-default disabled:opacity-45 ${
                    webSearchEnabled
                      ? "border-(--accent) bg-(--accent-soft) text-(--accent)"
                      : "border-(--border-default) bg-(--bg-secondary) text-(--text-secondary) hover:border-(--accent) hover:text-(--accent)"
                  }`}
                  type="button"
                  aria-label={label("app.aiWebSearch")}
                  title={label("app.aiWebSearch")}
                  aria-pressed={webSearchEnabled}
                  disabled={!supportsWebSearch}
                  onClick={() => setWebSearchEnabled((enabled) => !enabled)}
                >
                  <Globe2 aria-hidden="true" size={14} />
                  <span>{label("app.aiWebSearch")}</span>
                </button>
              </div>
              <button
                className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-(--bg-active) p-0 text-(--text-secondary) transition-colors duration-150 ease-out hover:bg-(--accent) hover:text-(--bg-primary) focus-visible:bg-(--accent) focus-visible:text-(--bg-primary) focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-(--bg-active) disabled:hover:text-(--text-secondary)"
                type="submit"
                disabled={!canSend}
                aria-label={label("app.aiAgentSend")}
              >
                <ArrowUp aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </aside>
  );
}
