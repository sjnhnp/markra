import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inlineAi";
import { DocumentAgentToolFactory } from "./base";
import {
  beginPreparedWrite,
  diffTargetFromAnchor,
  ensureCompleteTableReplacement,
  previewPreparedResult,
  resolveTableByHeading,
  sliceDocumentText,
  typedReplaceTableByHeadingArgs
} from "./shared";

export class ReplaceTableByHeadingToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceTableByHeadingArgs>> {
  protected readonly description = [
    "Replace the first Markdown table under a matching heading title with new Markdown.",
    "Use this when the user refers to a table by its visible section heading instead of an anchor id.",
    "This tool resolves the table location programmatically, reducing accidental heading-only replacement."
  ].join(" ");
  protected readonly label = "Replace table by heading";
  protected readonly name = "replace_table_by_heading";
  protected readonly parameters = Type.Object({
    headingTitle: Type.String({ minLength: 1 }),
    replacement: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedReplaceTableByHeadingArgs(params);
  }

  protected executeTool(_toolCallId: string, params: ReturnType<typeof typedReplaceTableByHeadingArgs>) {
    const writeCheck = beginPreparedWrite(this.context, this.state.hasPreparedWrite, "replace");
    if ("error" in writeCheck) return writeCheck.error;

    const table = resolveTableByHeading(this.context, params.headingTitle);
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
