import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inlineAi";
import { DocumentAgentToolFactory } from "./base";
import {
  beginPreparedWrite,
  previewPreparedResult,
  resolveSectionAnchor,
  typedDeleteSectionArgs
} from "./shared";

export class DeleteSectionToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedDeleteSectionArgs>> {
  protected readonly description = "Delete an entire Markdown section identified by a section anchor. Use this when the user asks to remove a whole section.";
  protected readonly label = "Delete section";
  protected readonly name = "delete_section";
  protected readonly parameters = Type.Object({
    anchorId: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedDeleteSectionArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedDeleteSectionArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "delete");
    if ("error" in writeCheck) return writeCheck.error;

    const section = resolveSectionAnchor(this.context, params.anchorId);
    if ("error" in section) return section.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: section.anchor.from,
      original: section.anchor.text ?? "",
      replacement: "",
      to: section.anchor.to,
      type: "replace"
    };
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(
      result,
      `Prepared a section deletion preview for ${section.anchor.title ?? section.anchor.id}.`
    );
  }
}
