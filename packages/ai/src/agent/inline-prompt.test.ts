import { buildInlineAiMessages, normalizeInlineAiReplacement } from "./inline-prompt";

describe("inline AI prompt builder", () => {
  it("uses action-specific instructions and forbids non-Markdown wrappers", () => {
    const messages = buildInlineAiMessages({
      documentContent: "# Title\n\nOriginal text",
      intent: "polish",
      prompt: "Polish",
      targetScope: "selection",
      targetText: "Original text",
      targetType: "replace"
    });

    expect(messages[0]).toMatchObject({
      content: expect.stringContaining("Return only the Markdown fragment"),
      role: "system"
    });
    expect(messages[0]?.content).toContain("Do not return JSON");
    expect(messages[0]?.content).toContain("Do not wrap the answer in code fences");
    expect(messages[1]).toMatchObject({
      content: expect.stringContaining("Task:\nPolish the target text"),
      role: "user"
    });
    expect(messages[1]?.content).toContain("Target scope:\nSelected text");
    expect(messages[1]?.content).toContain("Edit mode:\nReplace the target");
  });

  it("describes current block fallback separately from an explicit text selection", () => {
    const messages = buildInlineAiMessages({
      documentContent: "# Title\n\nFirst paragraph.\n\nSecond paragraph.",
      intent: "custom",
      prompt: "make it clearer",
      targetScope: "block",
      targetText: "First paragraph.",
      targetType: "replace"
    });

    expect(messages[1]?.content).toContain("Target scope:\nCurrent Markdown block");
    expect(messages[1]?.content).toContain("Target text:\nFirst paragraph.");
    expect(messages[1]?.content).toContain("Do not edit unrelated document content.");
  });

  it("frames continuation as inserted text without repeating the target", () => {
    const messages = buildInlineAiMessages({
      documentContent: "# Title\n\nOpening paragraph.",
      intent: "continue",
      prompt: "Continue writing",
      targetScope: "selection",
      targetText: "Opening paragraph.",
      targetType: "insert"
    });

    expect(messages[1]?.content).toContain("Task:\nContinue after the target text");
    expect(messages[1]?.content).toContain("Edit mode:\nInsert after the target");
    expect(messages[1]?.content).toContain("Do not repeat the target text.");
  });

  it("translates into the configured app language and defaults to English", () => {
    const messages = buildInlineAiMessages({
      documentContent: "# 标题\n\n你好",
      intent: "translate",
      prompt: "Translate",
      targetText: "你好",
      translationTargetLanguage: "Simplified Chinese"
    });
    const defaultMessages = buildInlineAiMessages({
      documentContent: "# 标题\n\n你好",
      intent: "translate",
      prompt: "Translate",
      targetText: "你好"
    });

    expect(messages[1]?.content).toContain("Task:\nTranslate the target text into Simplified Chinese.");
    expect(defaultMessages[1]?.content).toContain("Task:\nTranslate the target text into English.");
  });

  it("removes accidental Markdown code fences from final model output", () => {
    expect(normalizeInlineAiReplacement("```markdown\nImproved **text**.\n```")).toBe("Improved **text**.");
    expect(normalizeInlineAiReplacement("\nImproved text.\n")).toBe("Improved text.");
  });
});
