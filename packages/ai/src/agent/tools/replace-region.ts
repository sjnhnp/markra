import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { DocumentAgentToolFactory } from "./base";
import { typedReplaceRegionArgs } from "./params";
import { previewPreparedResult } from "./results";
import {
  beginPreparedWrite,
  ensureReplacementFitsRegion,
  resolveSelectedBlockRegion,
  resolveWriteRegion
} from "./regions";
import { looksLikeBlockMarkdown } from "./text";

export class ReplaceRegionToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceRegionArgs>> {
  protected readonly description = [
    "Replace the active selection, current block, or a resolved anchor with new Markdown.",
    "Use this when the user asks you to rewrite or fix existing content.",
    "Do not use this for complete table replacement; use replace_table with a table anchor instead.",
    "When replacing only an inline selection, pass plain inline text only; do not pass tables, lists, headings, or multi-line Markdown unless you resolved a block, section, or document anchor."
  ].join(" ");
  protected readonly label = "Replace region";
  protected readonly name = "replace_region";
  protected readonly parameters = Type.Object({
    anchorId: Type.Optional(Type.String()),
    replacement: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedReplaceRegionArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedReplaceRegionArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "replace");
    if ("error" in writeCheck) return writeCheck.error;

    const region = resolveWriteRegion(this.context, params.anchorId, "replace");
    if ("error" in region) return region.error;

    const selectedBlock =
      !params.anchorId && looksLikeBlockMarkdown(params.replacement)
        ? resolveSelectedBlockRegion(this.context)
        : null;
    const replacementAnchorId = selectedBlock?.anchorId ?? params.anchorId;
    const replacementRegion = selectedBlock?.region ?? region.region;
    const fitCheck = ensureReplacementFitsRegion(this.context, replacementAnchorId, params.replacement, replacementRegion);
    if ("error" in fitCheck) return fitCheck.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: replacementRegion.from,
      original: replacementRegion.original,
      replacement: params.replacement,
      ...(replacementRegion.target ? { target: replacementRegion.target } : {}),
      to: replacementRegion.to,
      type: "replace"
    };
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(result, "Prepared a replacement preview for the resolved region.");
  }
}
