import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { DocumentAgentToolFactory } from "./base";
import { typedReplaceBlockByTextArgs } from "./params";
import { previewPreparedResult } from "./results";
import {
  beginPreparedWrite,
  resolveBlockByText
} from "./regions";

export class ReplaceBlockByTextToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReplaceBlockByTextArgs>> {
  protected readonly description = [
    "Replace one exact existing Markdown text block with new Markdown.",
    "Use this when the user quotes the text to change and there is no reliable editor selection.",
    "The tool rejects missing or duplicate text matches so the agent does not guess a character range."
  ].join(" ");
  protected readonly label = "Replace block by text";
  protected readonly name = "replace_block_by_text";
  protected readonly parameters = Type.Object({
    originalText: Type.String({ minLength: 1 }),
    replacement: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedReplaceBlockByTextArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedReplaceBlockByTextArgs>) {
    const writeCheck = beginPreparedWrite(this.context, "replace", {
      requireEditableContext: false
    });
    if ("error" in writeCheck) return writeCheck.error;

    const block = resolveBlockByText(this.context, params.originalText);
    if ("error" in block) return block.error;

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

    return previewPreparedResult(result, "Prepared a block replacement preview for matched text.");
  }
}
