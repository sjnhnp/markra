import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inlineAi";
import { DocumentAgentToolFactory } from "./base";
import { beginPreparedWrite, previewPreparedResult, typedReplaceDocumentArgs } from "./shared";

export class ReplaceDocumentToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceDocumentArgs>> {
  protected readonly description = [
    "Replace the entire current Markdown document with new Markdown.",
    "Use this when the user asks to rewrite the whole document, compress the document, clean up duplicates, or keep only selected content.",
    "This replaces everything from the start of the document to the end and still prepares a user-confirmed editor preview."
  ].join(" ");
  protected readonly label = "Replace document";
  protected readonly name = "replace_document";
  protected readonly parameters = Type.Object({
    replacement: Type.String()
  });

  protected parseParams(params: unknown) {
    return typedReplaceDocumentArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedReplaceDocumentArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "replace", {
      requireEditableContext: false
    });
    if ("error" in writeCheck) return writeCheck.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: 0,
      original: this.context.documentContent,
      replacement: params.replacement,
      to: this.context.documentEndPosition,
      type: "replace"
    };
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(result, "Prepared a full-document replacement preview.");
  }
}
