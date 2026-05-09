import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { diffTargetFromAnchor } from "./anchors";
import { DocumentAgentToolFactory } from "./base";
import { typedReplaceTableArgs } from "./params";
import { previewPreparedResult } from "./results";
import {
  beginPreparedWrite,
  ensureCompleteTableReplacement,
  resolveTableAnchor
} from "./regions";
import { sliceDocumentText } from "./text";

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

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedReplaceTableArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "replace");
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
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(
      result,
      `Prepared a table replacement preview for ${table.anchor.title ?? table.anchor.id}.`
    );
  }
}
