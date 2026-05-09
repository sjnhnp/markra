import type { AiProviderConfig } from "../providers/providers";
import { chatCompletion, type ChatCompletionTransport } from "./chat-completion";
import { normalizeAiAgentSessionTitle, type AiAgentSessionMessage } from "./session-state";

type GenerateAiAgentSessionTitleInput = {
  messages: Pick<AiAgentSessionMessage, "role" | "text">[];
  model: string;
  provider: AiProviderConfig;
  transport?: ChatCompletionTransport;
};

export async function generateAiAgentSessionTitle({
  messages,
  model,
  provider,
  transport
}: GenerateAiAgentSessionTitleInput) {
  const transcript = messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text.trim()}`)
    .filter((line) => line.length > 0)
    .slice(-8)
    .join("\n");

  if (!transcript) return null;

  const response = await chatCompletion(provider, model, [
    {
      content: [
        "You write concise conversation titles for an AI agent session.",
        "Return only one short title in the same language as the conversation.",
        "Prefer 4 to 10 words.",
        "Do not use quotes, markdown, numbering, or trailing punctuation."
      ].join("\n"),
      role: "system"
    },
    {
      content: `Conversation transcript:\n${transcript}\n\nTitle:`,
      role: "user"
    }
  ], transport);

  return normalizeAiAgentSessionTitle(response.content);
}
