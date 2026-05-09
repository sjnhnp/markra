import type { AiProviderConfig } from "@markra/providers";
import { getNativeWebSearchKind } from "@markra/providers";

export function buildGoogleTools(config: AiProviderConfig, model: string, webSearchEnabled: boolean | undefined) {
  return webSearchEnabled === true && getNativeWebSearchKind(config, model) === "google-search-grounding"
    ? [{ google_search: {} }]
    : [];
}
