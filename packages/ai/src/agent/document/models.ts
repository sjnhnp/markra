import type { AiProviderConfig } from "../../providers/providers";

export function modelSupportsVision(provider: AiProviderConfig, model: string) {
  return provider.models.some((item) => item.id === model && item.enabled && item.capabilities.includes("vision"));
}

export function modelSupportsTools(provider: AiProviderConfig, model: string) {
  return provider.models.some((item) => item.id === model && item.enabled && item.capabilities.includes("tools"));
}
