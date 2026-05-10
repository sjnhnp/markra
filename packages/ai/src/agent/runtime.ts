import { Agent } from "@mariozechner/pi-agent-core";

import { chatCompletionStream } from "./chat-completion";
import type { InlineAiAgentInput } from "./runtime/types";
import { assistantTextContent } from "./runtime/messages";
import { createPiAgentModel } from "./runtime/model";
import { createNativeChatStreamFn } from "./runtime/stream";
import { buildInlineAiMessages, normalizeInlineAiReplacement } from "./inline-prompt";
import { runReadOnlyAgentTools } from "./read-only-tools";

export { assistantTextContent } from "./runtime/messages";
export { createPiAgentModel } from "./runtime/model";
export { createNativeChatStreamFn } from "./runtime/stream";
export type { InlineAiAgentComplete, InlineAiAgentInput, InlineAiAgentTarget } from "./runtime/types";

export async function runInlineAiAgent({
  complete = chatCompletionStream,
  documentContent,
  documentPath,
  intent = "custom",
  model,
  onEvent,
  prompt,
  provider,
  target,
  thinkingEnabled,
  translationTargetLanguage,
  workspaceFiles = []
}: InlineAiAgentInput) {
  const toolResults = await runReadOnlyAgentTools({
    documentContent,
    documentPath,
    workspaceFiles
  });
  const messages = buildInlineAiMessages({
    documentContent,
    intent,
    prompt,
    suggestionContext: target.suggestionContext,
    targetScope: target.scope,
    targetText: target.promptText,
    targetType: target.type,
    translationTargetLanguage
  });
  const systemPrompt = messages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = [
    ...messages.filter((message) => message.role !== "system").map((message) => message.content),
    formatReadOnlyToolContext(toolResults)
  ].join("\n\n");
  const agent = new Agent({
    initialState: {
      model: createPiAgentModel(provider, model),
      systemPrompt
    },
    streamFn: createNativeChatStreamFn(provider, complete, thinkingEnabled)
  });
  let finalContent = "";
  let finishReason: string | undefined;

  agent.subscribe((event) => {
    onEvent?.(event);
    if (event.type !== "message_end" || event.message.role !== "assistant") return;

    finalContent = assistantTextContent(event.message);
    finishReason = event.message.stopReason;
  });

  await agent.prompt(userPrompt);

  return {
    content: normalizeInlineAiReplacement(finalContent, {
      preserveLeadingWhitespace: target.type === "insert"
    }),
    finishReason
  };
}

function formatReadOnlyToolContext(toolResults: Awaited<ReturnType<typeof runReadOnlyAgentTools>>) {
  return [
    "Read-only agent tool context:",
    ...toolResults.map((result) => [`Tool: ${result.name}`, result.content].join("\n"))
  ].join("\n\n");
}
