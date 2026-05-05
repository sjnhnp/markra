import { invoke } from "@tauri-apps/api/core";

export type NativeAiHttpRequest = {
  headers: Record<string, string>;
  method: "GET";
  url: string;
};

export type NativeAiHttpResponse = {
  body: unknown;
  status: number;
};

export function requestNativeAiJson(request: NativeAiHttpRequest): Promise<NativeAiHttpResponse> {
  return invoke<NativeAiHttpResponse>("request_ai_provider_json", { request });
}
