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

  it("frames custom questions as answers grounded in the selected text context", () => {
    const messages = buildInlineAiMessages({
      documentContent: "- 2042年3月4日，项目团队发布了“示例口号”。",
      intent: "custom",
      prompt: "这是什么时候提出来的",
      targetContext: "- 2042年3月4日，项目团队发布了“示例口号”。",
      targetScope: "selection",
      targetText: "示例口号",
      targetType: "replace"
    });

    expect(messages[0]?.content).toContain("If the user asks a question, answer it directly");
    expect(messages[1]?.content).toContain("Nearby target context:");
    expect(messages[1]?.content).toContain("2042年3月4日");
    expect(messages[1]?.content).toContain("User instruction:\n这是什么时候提出来的");
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

  it("auto-detects the current text language before choosing a translation target", () => {
    const messages = buildInlineAiMessages({
      documentContent: "# 标题\n\n你好",
      intent: "translate",
      prompt: "Translate",
      targetText: "你好"
    });
    const defaultMessages = buildInlineAiMessages({
      documentContent: "# 标题\n\n你好",
      intent: "translate",
      prompt: "Translate",
      targetText: "你好"
    });

    expect(messages[1]?.content).toContain("Task:\nAutomatically detect the target text's current language");
    expect(messages[1]?.content).toContain("If the target text is mostly English, translate it into Simplified Chinese.");
    expect(messages[1]?.content).toContain("If the target text is mostly Chinese, translate it into English.");
    expect(defaultMessages[1]?.content).toContain(
      "For other languages, translate it into English unless the user instruction names another target language."
    );
  });

  it("removes accidental Markdown code fences from final model output", () => {
    expect(normalizeInlineAiReplacement("```markdown\nImproved **text**.\n```")).toBe("Improved **text**.");
    expect(normalizeInlineAiReplacement("\nImproved text.\n")).toBe("Improved text.");
  });
});
