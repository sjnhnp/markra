import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inlineAi";
import { DocumentAgentToolFactory } from "./base";
import {
  beginPreparedWrite,
  diffTargetFromAnchor,
  ensureCompleteTableReplacement,
  previewPreparedResult,
  resolveTableAnchor,
  sliceDocumentText,
  typedReplaceTableArgs
} from "./shared";

export class ReplaceTableToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceTableArgs>> {
  protected readonly description = [
    "Replace an entire Markdown table identified by a table anchor.",
    "Use this for table edits instead of replace_region.",
    "Call locate_markdown_region or get_available_anchors first and pass a table anchor like table:0."
  ].join(" ");
  protected readonly label = "Replace table";
  protected readonly name = "replace_table";
  protected readonly parameters = Type.Object({
    anchorId: Type.String({ minLength: 1 }),
    replacement: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedReplaceTableArgs(params);
  }

  protected executeTool(_toolCallId: string, params: ReturnType<typeof typedReplaceTableArgs>) {
    const writeCheck = beginPreparedWrite(this.context, this.state.hasPreparedWrite, "replace");
    if ("error" in writeCheck) return writeCheck.error;

    const table = resolveTableAnchor(this.context, params.anchorId);
    if ("error" in table) return table.error;
    const tableCheck = ensureCompleteTableReplacement(params.replacement);
    if ("error" in tableCheck) return tableCheck.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: table.anchor.from,
      original: table.anchor.text ?? sliceDocumentText(this.context.documentContent, table.anchor.from, table.anchor.to),
      replacement: params.replacement,
      target: diffTargetFromAnchor(table.anchor),
      to: table.anchor.to,
      type: "replace"
    };
    this.context.onPreviewResult?.(result);

    return previewPreparedResult(
      result,
      `Prepared a table replacement preview for ${table.anchor.title ?? table.anchor.id}.`
    );
  }
}
