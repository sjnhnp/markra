import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { DocumentAgentToolFactory } from "./base";
import { typedDeleteRegionArgs } from "./params";
import { previewPreparedResult } from "./results";
import {
  beginPreparedWrite,
  resolveWriteRegion
} from "./regions";

export class DeleteRegionToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedDeleteRegionArgs>> {
  protected readonly description = "Delete the active selection, current block, or a resolved anchor from the editor. Use this when the user wants to remove content.";
  protected readonly label = "Delete region";
  protected readonly name = "delete_region";
  protected readonly parameters = Type.Object({
    anchorId: Type.Optional(Type.String())
  });

  protected parseParams(params: unknown) {
    return typedDeleteRegionArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedDeleteRegionArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "delete");
    if ("error" in writeCheck) return writeCheck.error;

    const region = resolveWriteRegion(this.context, params.anchorId, "delete");
    if ("error" in region) return region.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: region.region.from,
      original: region.region.original,
      replacement: "",
      to: region.region.to,
      type: "replace"
    };
    this.context.onPreviewResult?.(result, toolCallId);

    return previewPreparedResult(result, "Prepared a deletion preview for the resolved region.");
  }
}
