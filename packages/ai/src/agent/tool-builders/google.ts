import type { AiProviderConfig } from "../../providers/providers";
import { getNativeWebSearchKind } from "../native-web-search";

export function buildGoogleTools(config: AiProviderConfig, model: string, webSearchEnabled: boolean | undefined) {
  return webSearchEnabled === true && getNativeWebSearchKind(config, model) === "google-search-grounding"
    ? [{ google_search: {} }]
    : [];
}
