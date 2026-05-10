import { isRecord } from "@markra/shared";

import type { AiProviderConfig } from "./types";

export function readAiProviderCustomHeaders(provider: Pick<AiProviderConfig, "customHeaders">): Record<string, string> {
  const customHeaders = provider.customHeaders?.trim();
  if (!customHeaders) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(customHeaders) as unknown;
  } catch {
    throw new Error("Custom headers must be a JSON object.");
  }

  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error("Custom headers must be a JSON object.");
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(parsed)) {
    const normalizedName = name.trim();
    if (!normalizedName) continue;
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      throw new Error("Custom header values must be strings, numbers, or booleans.");
    }

    headers[normalizedName] = String(value);
  }

  return headers;
}
