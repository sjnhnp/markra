import type { Tool } from "@mariozechner/pi-ai";
import { buildOpenAiCompatibleFunctionTools } from "../toolBuilders/openaiCompatible";
import { mergeRequestBody } from "./shared";

type ChatCompletionsRequestBodyParams = {
  extraBody?: Record<string, unknown>;
  messages: unknown[];
  model?: string;
  stream?: boolean;
  tools?: Tool[];
};

export function buildChatCompletionsRequestBody({
  extraBody = {},
  messages,
  model,
  stream,
  tools
}: ChatCompletionsRequestBodyParams) {
  return mergeRequestBody(
    {
      messages,
      ...(model ? { model } : {}),
      ...(stream ? { stream: true } : {}),
      ...(tools?.length
        ? {
            parallel_tool_calls: false,
            tool_choice: "auto",
            tools: buildOpenAiCompatibleFunctionTools(tools)
          }
        : {}),
      temperature: 0.7
    },
    extraBody
  );
}
