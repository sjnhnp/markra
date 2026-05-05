import type { AiModelCapability, AiProviderApiStyle, AiProviderConfig, AiProviderModel } from "./aiProviders";
import { requestNativeAiJson, type NativeAiHttpRequest, type NativeAiHttpResponse } from "./nativeAi";

export type AiProviderHttpRequest = NativeAiHttpRequest;
export type AiProviderHttpResponse = NativeAiHttpResponse;
export type AiProviderTransport = (request: AiProviderHttpRequest) => Promise<AiProviderHttpResponse>;

type ProviderEndpoint = {
  auth: "anthropic" | "azure" | "bearer" | "google" | "none";
  baseUrl: string;
  path: string;
};

const anthropicVersion = "2023-06-01";

const endpointByApiStyle: Record<AiProviderApiStyle, ProviderEndpoint> = {
  anthropic: {
    auth: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    path: "/models"
  },
  "azure-openai": {
    auth: "azure",
    baseUrl: "",
    path: "/openai/models?api-version=2024-10-21"
  },
  deepseek: {
    auth: "bearer",
    baseUrl: "https://api.deepseek.com",
    path: "/models"
  },
  google: {
    auth: "google",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    path: "/models"
  },
  groq: {
    auth: "bearer",
    baseUrl: "https://api.groq.com/openai/v1",
    path: "/models"
  },
  mistral: {
    auth: "bearer",
    baseUrl: "https://api.mistral.ai/v1",
    path: "/models"
  },
  ollama: {
    auth: "none",
    baseUrl: "http://localhost:11434/v1",
    path: "/models"
  },
  openai: {
    auth: "bearer",
    baseUrl: "https://api.openai.com/v1",
    path: "/models"
  },
  "openai-compatible": {
    auth: "bearer",
    baseUrl: "",
    path: "/models"
  },
  openrouter: {
    auth: "bearer",
    baseUrl: "https://openrouter.ai/api/v1",
    path: "/models"
  },
  together: {
    auth: "bearer",
    baseUrl: "https://api.together.xyz/v1",
    path: "/models"
  },
  xai: {
    auth: "bearer",
    baseUrl: "https://api.x.ai/v1",
    path: "/models"
  }
};

export function buildAiProviderModelsRequest(provider: AiProviderConfig): AiProviderHttpRequest {
  const endpoint = endpointByApiStyle[provider.type];
  const baseUrl = provider.baseUrl?.trim() || endpoint.baseUrl;
  if (!baseUrl) throw new Error("API URL is required.");

  return {
    headers: buildAuthHeaders(endpoint.auth, provider.apiKey?.trim() ?? ""),
    method: "GET",
    url: joinApiUrl(baseUrl, endpoint.path)
  };
}

export async function testAiProviderConnection(
  provider: AiProviderConfig,
  transport: AiProviderTransport = requestNativeAiJson
) {
  const response = await transport(buildAiProviderModelsRequest(provider));
  if (!isSuccessfulStatus(response.status)) throw new Error(readResponseError(response));

  return {
    message: "Connected",
    ok: true
  };
}

export async function fetchAiProviderModels(
  provider: AiProviderConfig,
  transport: AiProviderTransport = requestNativeAiJson
): Promise<AiProviderModel[]> {
  const response = await transport(buildAiProviderModelsRequest(provider));
  if (!isSuccessfulStatus(response.status)) throw new Error(readResponseError(response));

  const models = parseAiProviderModels(provider, response.body);
  if (models.length === 0) throw new Error("No models returned.");

  return models;
}

export function parseAiProviderModels(provider: AiProviderConfig, body: unknown): AiProviderModel[] {
  const records = readModelRecords(provider.type, body);
  const seenIds = new Set<string>();
  const models: AiProviderModel[] = [];

  for (const record of records) {
    const id = readModelId(provider.type, record);
    if (!id || seenIds.has(id)) continue;

    seenIds.add(id);
    models.push({
      capability: inferModelCapability(provider.type, record, id),
      enabled: true,
      id,
      name: readModelName(provider.type, record, id)
    });
  }

  return models;
}

function buildAuthHeaders(auth: ProviderEndpoint["auth"], apiKey: string): Record<string, string> {
  if (auth === "none" || !apiKey) return {};
  if (auth === "anthropic") return { "anthropic-version": anthropicVersion, "x-api-key": apiKey };
  if (auth === "azure") return { "api-key": apiKey };
  if (auth === "google") return { "x-goog-api-key": apiKey };

  return { Authorization: `Bearer ${apiKey}` };
}

function joinApiUrl(baseUrl: string, path: string) {
  if (/^https?:\/\/[^/]+\/?$/.test(baseUrl) && path.startsWith("?")) return `${baseUrl.replace(/\/$/, "")}${path}`;
  if (baseUrl.includes("?")) return baseUrl;

  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function readModelRecords(apiStyle: AiProviderApiStyle, body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return [];

  if (Array.isArray(body.data)) return body.data.filter(isRecord);
  if (Array.isArray(body.models)) return body.models.filter(isRecord);
  if (apiStyle === "xai" && Array.isArray(body.language_models)) return body.language_models.filter(isRecord);

  return [];
}

function readModelId(apiStyle: AiProviderApiStyle, record: Record<string, unknown>) {
  const id = typeof record.id === "string" ? record.id : undefined;
  const name = typeof record.name === "string" ? record.name : undefined;

  if (apiStyle === "google" && name?.startsWith("models/")) return name.slice("models/".length);

  return id ?? name;
}

function readModelName(apiStyle: AiProviderApiStyle, record: Record<string, unknown>, id: string) {
  if (typeof record.displayName === "string") return record.displayName;
  if (typeof record.display_name === "string") return record.display_name;
  if (typeof record.name === "string" && !(apiStyle === "google" && record.name.startsWith("models/"))) return record.name;

  return id;
}

function inferModelCapability(apiStyle: AiProviderApiStyle, record: Record<string, unknown>, id: string): AiModelCapability {
  if (apiStyle === "google") return inferGoogleCapability(record);
  if (apiStyle === "openrouter") return inferOpenRouterCapability(record, id);

  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  if (type.includes("image")) return "image";
  if (type.includes("embedding")) return "embedding";
  if (type.includes("moderation")) return "moderation";
  if (type.includes("rerank")) return "rerank";
  if (type.includes("audio")) return "audio";
  if (type.includes("video")) return "video";

  return inferCapabilityFromId(id);
}

function inferGoogleCapability(record: Record<string, unknown>): AiModelCapability {
  const methods = Array.isArray(record.supportedGenerationMethods)
    ? record.supportedGenerationMethods.filter((method): method is string => typeof method === "string")
    : [];

  if (methods.some((method) => method.toLowerCase().includes("embed"))) return "embedding";

  return "text";
}

function inferOpenRouterCapability(record: Record<string, unknown>, id: string): AiModelCapability {
  const architecture = isRecord(record.architecture) ? record.architecture : undefined;
  const modality = typeof architecture?.modality === "string" ? architecture.modality.toLowerCase() : "";
  const outputModalities = Array.isArray(architecture?.output_modalities)
    ? architecture.output_modalities.filter((modality): modality is string => typeof modality === "string")
    : [];

  if (outputModalities.some((modality) => modality.toLowerCase() === "image") || modality.includes("image")) return "image";
  if (outputModalities.some((modality) => modality.toLowerCase() === "audio") || modality.includes("audio")) return "audio";

  return inferCapabilityFromId(id);
}

function inferCapabilityFromId(id: string): AiModelCapability {
  const normalizedId = id.toLowerCase();
  if (normalizedId.includes("embed")) return "embedding";
  if (normalizedId.includes("image") || normalizedId.includes("dall")) return "image";
  if (normalizedId.includes("audio") || normalizedId.includes("tts") || normalizedId.includes("whisper")) return "audio";
  if (normalizedId.includes("moderation")) return "moderation";
  if (normalizedId.includes("rerank")) return "rerank";
  if (normalizedId.includes("video") || normalizedId.includes("sora")) return "video";

  return "text";
}

function isSuccessfulStatus(status: number) {
  return status >= 200 && status < 300;
}

function readResponseError(response: AiProviderHttpResponse) {
  if (isRecord(response.body)) {
    const message = readNestedMessage(response.body);
    if (message) return message;
  }

  return `Request failed with HTTP ${response.status}.`;
}

function readNestedMessage(body: Record<string, unknown>): string | undefined {
  if (typeof body.message === "string") return body.message;
  if (isRecord(body.error) && typeof body.error.message === "string") return body.error.message;
  if (typeof body.error === "string") return body.error;

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
