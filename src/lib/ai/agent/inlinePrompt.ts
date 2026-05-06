import type { AiEditIntent, AiTargetScope } from "./inlineAi";
import type { ChatMessage } from "./chatAdapters";

type InlineAiSuggestionContext = {
  original: string;
  replacement: string;
};

type BuildInlineAiMessagesInput = {
  documentContent: string;
  intent?: AiEditIntent;
  prompt: string;
  suggestionContext?: InlineAiSuggestionContext;
  targetScope?: AiTargetScope;
  targetText: string;
  targetType?: "insert" | "replace";
  translationTargetLanguage?: string;
};

type NormalizeInlineAiReplacementOptions = {
  preserveLeadingWhitespace?: boolean;
};

const intentInstruction: Record<AiEditIntent, string> = {
  custom: "Follow the user instruction exactly while keeping the edit scoped to the target.",
  polish: "Polish the target text for clarity, flow, grammar, and word choice without adding new facts.",
  rewrite: "Rewrite the target text according to the user instruction while preserving the intended meaning unless asked otherwise.",
  continue: "Continue after the target text. Return only the new Markdown to insert after it. Do not repeat the target text.",
  summarize: "Summarize the target text concisely while preserving the important facts and Markdown readability.",
  translate: "Translate the target text into English."
};

const targetScopeLabel: Record<AiTargetScope, string> = {
  block: "Current Markdown block",
  selection: "Selected text",
  suggestion: "Current AI suggestion"
};

export function buildInlineAiMessages({
  documentContent,
  intent = "custom",
  prompt,
  suggestionContext,
  targetScope = "selection",
  targetText,
  targetType = "replace",
  translationTargetLanguage = "English"
}: BuildInlineAiMessagesInput): ChatMessage[] {
  const currentSuggestion = suggestionContext
    ? [
        "Current AI suggestion awaiting confirmation:",
        `Original text:\n${suggestionContext.original}`,
        `Suggested replacement:\n${suggestionContext.replacement}`
      ].join("\n\n")
    : null;

  return [
    {
      content: [
        "You are Markra's inline Markdown editor.",
        "Return only the Markdown fragment that should be inserted or used as the replacement.",
        "Do not return JSON, metadata, explanations, or alternatives.",
        "Do not wrap the answer in code fences.",
        "Preserve the target's language, tone, and Markdown structure unless the user explicitly asks to change them.",
        "Do not edit unrelated document content."
      ].join(" "),
      role: "system"
    },
    {
      content: [
        `Task:\n${instructionForIntent(intent, translationTargetLanguage)}`,
        `User instruction:\n${prompt.trim()}`,
        `Target scope:\n${targetScopeLabel[targetScope]}`,
        `Edit mode:\n${targetType === "insert" ? "Insert after the target" : "Replace the target"}`,
        `Target text:\n${targetText}`,
        currentSuggestion,
        `Current document context (read-only):\n${documentContent}`,
        "Do not edit unrelated document content."
      ]
        .filter(Boolean)
        .join("\n\n"),
      role: "user"
    }
  ];
}

function instructionForIntent(intent: AiEditIntent, translationTargetLanguage: string) {
  if (intent !== "translate") return intentInstruction[intent];

  return [
    `Translate the target text into ${translationTargetLanguage || "English"}.`,
    "If the user instruction explicitly names a different target language, use that explicit language instead.",
    "Preserve Markdown formatting."
  ].join(" ");
}

export function normalizeInlineAiReplacement(
  value: string,
  { preserveLeadingWhitespace = false }: NormalizeInlineAiReplacementOptions = {}
) {
  const withoutFence = stripSingleMarkdownFence(value);

  return preserveLeadingWhitespace ? withoutFence.replace(/\s+$/u, "") : withoutFence.trim();
}

function stripSingleMarkdownFence(value: string) {
  const trimmed = value.trim();
  const fenceMatch = trimmed.match(/^```(?:markdown|md|text)?\s*\n([\s\S]*?)\n```$/iu);

  return fenceMatch?.[1] ?? value;
}
