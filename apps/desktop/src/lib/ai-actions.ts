import type { AiEditIntent } from "@markra/ai";
import type { I18nKey } from "@markra/shared";

export type AiQuickActionId = Exclude<AiEditIntent, "custom">;
export type AiQuickActionPrompts = Record<AiQuickActionId, string>;

export const aiQuickActionIds = [
  "polish",
  "rewrite",
  "continue",
  "summarize",
  "translate"
] as const satisfies readonly AiQuickActionId[];

export const aiQuickActionLabelKeys: Record<AiQuickActionId, I18nKey> = {
  continue: "app.aiContinueWriting",
  polish: "app.aiPolish",
  rewrite: "app.aiRewrite",
  summarize: "app.aiSummarize",
  translate: "app.aiTranslate"
};

export const defaultAiQuickActionPrompts: AiQuickActionPrompts = {
  continue: "Continue after the target text. Return only the new Markdown to insert after it. Do not repeat the target text.",
  polish: "Polish the target text for clarity, flow, grammar, and word choice without adding new facts.",
  rewrite: "Rewrite the target text according to the user instruction while preserving the intended meaning unless asked otherwise.",
  summarize: "Summarize the target text concisely while preserving the important facts and Markdown readability.",
  translate: "Automatically detect the target text's current language before translating it. If the target text is mostly English, translate it into Simplified Chinese. If the target text is mostly Chinese, translate it into English. For other languages, translate it into English unless the user instruction names another target language. If the user instruction explicitly names a different target language, use that explicit language instead. Preserve Markdown formatting."
};

export function normalizeAiQuickActionPrompts(value: unknown): AiQuickActionPrompts {
  if (typeof value !== "object" || value === null) return { ...defaultAiQuickActionPrompts };

  const storedPrompts = value as Partial<Record<AiQuickActionId, unknown>>;

  return aiQuickActionIds.reduce<AiQuickActionPrompts>((prompts, actionId) => {
    const prompt = storedPrompts[actionId];

    return {
      ...prompts,
      [actionId]: typeof prompt === "string" ? prompt : defaultAiQuickActionPrompts[actionId]
    };
  }, { ...defaultAiQuickActionPrompts });
}

export function resolveAiQuickActionPrompt(prompts: AiQuickActionPrompts, actionId: AiQuickActionId, fallback: string) {
  const customPrompt = prompts[actionId]?.trim();

  return customPrompt ? customPrompt : fallback;
}
