import { Plus, Search } from "lucide-react";
import { AiProviderBadge } from "./AiProviderBadge";
import type { AiProviderConfig } from "@markra/ai";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

export function AiProviderList({
  providerSearch,
  selectedProviderId,
  translate,
  visibleProviders,
  onAddProvider,
  onSearchChange,
  onSelectProvider
}: {
  providerSearch: string;
  selectedProviderId?: string;
  translate: Translate;
  visibleProviders: AiProviderConfig[];
  onAddProvider: () => unknown;
  onSearchChange: (value: string) => unknown;
  onSelectProvider: (providerId: string) => unknown;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col border-r border-(--border-default) bg-(--bg-primary) max-[860px]:border-r-0 max-[860px]:border-b">
      <div className="border-b border-(--border-default) p-3">
        <label className="relative block">
          <span className="sr-only">{translate("settings.ai.searchProviders")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--text-secondary)"
            size={14}
          />
          <input
            className="h-9 w-full rounded-md border border-(--border-default) bg-(--bg-secondary) pr-3 pl-8 text-[13px] leading-5 font-[520] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-(--text-secondary) focus:border-(--accent) focus:ring-2 focus:ring-(--accent)/20"
            aria-label={translate("settings.ai.searchProviders")}
            value={providerSearch}
            placeholder={translate("settings.ai.searchProviders")}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
          />
        </label>
      </div>

      <div className="ai-provider-list-scroll grid min-h-0 flex-1 content-start gap-1 overflow-auto overscroll-contain p-3">
        {visibleProviders.map((provider) => (
          <button
            className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border-0 bg-transparent px-2.5 py-2 text-left transition-colors duration-150 ease-out hover:bg-(--bg-hover) aria-current:bg-(--bg-active) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
            type="button"
            key={provider.id}
            aria-current={provider.id === selectedProviderId ? "page" : undefined}
            aria-label={provider.name}
            onClick={() => onSelectProvider(provider.id)}
          >
            <AiProviderBadge provider={provider} translate={translate} />
            <span className="min-w-0 truncate text-[13px] leading-5 font-[620] text-(--text-heading)">
              {provider.name}
            </span>
            <span className={`size-2 rounded-full ${provider.enabled ? "bg-(--accent)" : "bg-(--border-strong)"}`} />
          </button>
        ))}
      </div>

      <div className="border-t border-(--border-default) p-3">
        <button
          className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-(--border-default) bg-(--bg-primary) px-3 text-[13px] leading-5 font-[650] text-(--text-heading) transition-colors duration-150 ease-out hover:bg-(--bg-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
          type="button"
          aria-label={translate("settings.ai.addProvider")}
          onClick={onAddProvider}
        >
          <Plus aria-hidden="true" size={15} />
          {translate("settings.ai.addProvider")}
        </button>
      </div>
    </section>
  );
}
