import type { Tool } from "@mariozechner/pi-ai";

export function buildOpenAiCompatibleFunctionTools(tools: Tool[] | undefined) {
  return (tools ?? []).map((tool) => ({
    function: {
      description: tool.description,
      name: tool.name,
      parameters: tool.parameters
    },
    type: "function" as const
  }));
}

export function buildResponsesStyleTools(
  nativeWebSearchToolType: "openrouter:web_search" | "web_search",
  tools: Tool[] | undefined
) {
  return [
    { type: nativeWebSearchToolType },
    ...(tools ?? []).map((tool) => ({
      description: tool.description,
      name: tool.name,
      parameters: tool.parameters,
      type: "function" as const
    }))
  ];
}
