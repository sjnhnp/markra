import type { Tool } from "@mariozechner/pi-ai";
import type { AiProviderConfig } from "../../providers/aiProviders";
import { getNativeWebSearchKind } from "../nativeWebSearch";

export function buildAnthropicTools(
  config: AiProviderConfig,
  model: string,
  webSearchEnabled: boolean | undefined,
  tools: Tool[] | undefined
) {
  return [
    ...(webSearchEnabled === true && getNativeWebSearchKind(config, model) === "anthropic-server-tool"
      ? [{ max_uses: 5, name: "web_search", type: "web_search_20250305" as const }]
      : []),
    ...(tools ?? []).map((tool) => ({
      description: tool.description,
      input_schema: tool.parameters,
      name: tool.name
    }))
  ];
}
