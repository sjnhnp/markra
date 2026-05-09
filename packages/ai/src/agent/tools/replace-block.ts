import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { DocumentAgentToolFactory } from "./base";
import {
  beginPreparedWrite,
  ensureReplacementFitsRegion,
  previewPreparedResult,
  resolveBlockRegion,
  typedReplaceBlockArgs
} from "./shared";

export class ReplaceBlockToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceBlockArgs>> {
  protected readonly description = [
    "Replace one concrete Markdown block with new Markdown.",
    "Use this for the current paragraph, list item, heading block, or other non-table block when the user targets a single block.",
    "Do not use this for tables, full sections, or the whole document; use replace_table, replace_section, or replace_document instead."
  ].join(" ");
  protected readonly label = "Replace block";
  protected readonly name = "replace_block";
  protected readonly parameters = Type.Object({
    anchorId: Type.Optional(Type.String()),
    replacement: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedReplaceBlockArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedReplaceBlockArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "replace");
    if ("error" in writeCheck) return writeCheck.error;

    const block = resolveBlockRegion(this.context, params.anchorId);
    if ("error" in block) return block.error;
    const fitCheck = ensureReplacementFitsRegion(this.context, block.anchorId, params.replacement, block.region);
    if ("error" in fitCheck) return fitCheck.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: block.region.from,
      original: block.region.original,
      replacement: params.replacement,
      target: block.region.target,
      to: block.region.to,
      type: "replace"
    };
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(result, "Prepared a block replacement preview for the resolved block.");
  }
}
