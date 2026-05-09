import type { AiProviderConfig } from "../../providers/aiProviders";
import { getNativeWebSearchKind } from "../nativeWebSearch";

export function buildGoogleTools(config: AiProviderConfig, model: string, webSearchEnabled: boolean | undefined) {
  return webSearchEnabled === true && getNativeWebSearchKind(config, model) === "google-search-grounding"
    ? [{ google_search: {} }]
    : [];
}
