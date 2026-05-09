import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { DocumentAgentToolFactory } from "./base";
import {
  beginPreparedWrite,
  previewPreparedResult,
  resolveSectionAnchor,
  typedReplaceSectionArgs
} from "./shared";

export class ReplaceSectionToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceSectionArgs>> {
  protected readonly description = "Replace an entire Markdown section identified by a section anchor. Use this when the user asks to rewrite or remove a whole numbered section or heading group.";
  protected readonly label = "Replace section";
  protected readonly name = "replace_section";
  protected readonly parameters = Type.Object({
    anchorId: Type.String({ minLength: 1 }),
    replacement: Type.String()
  });

  protected parseParams(params: unknown) {
    return typedReplaceSectionArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedReplaceSectionArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "replace");
    if ("error" in writeCheck) return writeCheck.error;

    const section = resolveSectionAnchor(this.context, params.anchorId);
    if ("error" in section) return section.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: section.anchor.from,
      original: section.anchor.text ?? "",
      replacement: params.replacement,
      to: section.anchor.to,
      type: "replace"
    };
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(
      result,
      `Prepared a section replacement preview for ${section.anchor.title ?? section.anchor.id}.`
    );
  }
}
