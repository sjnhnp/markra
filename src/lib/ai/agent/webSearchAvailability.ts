import type { AiProviderConfig, AiProviderModel } from "../providers/aiProviders";
import { webSearchSettingsAreUsable, type WebSearchSettings } from "../../web/webSearch";
import { providerSupportsNativeWebSearch } from "./nativeWebSearch";
import { getProviderCapabilities } from "./providerCapabilities";

type WebSearchModel = Pick<AiProviderModel, "capabilities" | "id">;

export function aiAgentWebSearchAvailable({
  model,
  provider,
  settings,
  settingsLoading
}: {
  model: WebSearchModel | null | undefined;
  provider: AiProviderConfig | null | undefined;
  settings: WebSearchSettings | null | undefined;
  settingsLoading: boolean;
}) {
  if (!provider || !model) return false;
  if (providerSupportsNativeWebSearch(provider, model)) return true;

  const providerCapabilities = getProviderCapabilities(provider.id, provider.type);
  const customToolAvailable = providerCapabilities.toolCalling && model.capabilities.includes("tools");

  return customToolAvailable && (settingsLoading || webSearchSettingsAreUsable(settings));
}
