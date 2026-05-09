import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult } from "../inline";
import { debug } from "@markra/shared";
import { DocumentAgentToolFactory } from "./base";
import { typedInsertMarkdownArgs } from "./params";
import {
  duplicatePreparedInsertionResult,
  findDuplicatePreparedInsertion,
  normalizePreparedInsertionContent,
  rememberPreparedInsertion,
  previewPreparedResult
} from "./results";
import { beginPreparedWrite, resolveInsertionPosition } from "./regions";

export class InsertMarkdownToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedInsertMarkdownArgs>> {
  protected readonly description = [
    "Insert new Markdown using either the current editor context or a resolved anchor.",
    "Prefer anchorId after using locate_markdown_region when the location is not obvious.",
    "Use placement=cursor only when the insertion should follow the active caret.",
    "Use placement=after_anchor or placement=before_anchor with anchorId when you want to insert around a heading, current block, or document end anchor."
  ].join(" ");
  protected readonly label = "Insert markdown";
  protected readonly name = "insert_markdown";
  protected readonly parameters = Type.Object({
    anchorId: Type.Optional(Type.String()),
    content: Type.String({ minLength: 1 }),
    placement: Type.Optional(Type.Union([
      Type.Literal("after_anchor"),
      Type.Literal("after_selection"),
      Type.Literal("after_heading"),
      Type.Literal("before_anchor"),
      Type.Literal("before_selection"),
      Type.Literal("before_heading"),
      Type.Literal("cursor")
    ]))
  });

  protected parseParams(params: unknown) {
    return typedInsertMarkdownArgs(params);
  }

  protected executeTool(toolCallId: string, params: ReturnType<typeof typedInsertMarkdownArgs>) {
    const duplicatePreparedInsertion = findDuplicatePreparedInsertion(this.state, params.content);
    if (duplicatePreparedInsertion) {
      debug(() => ["[markra-ai-preview] duplicate insert preview suppressed", {
        duplicateOfPreviewId: duplicatePreparedInsertion.previewId,
        duplicatePosition: duplicatePreparedInsertion.position,
        previewId: toolCallId,
        replacementLength: params.content.length
      }]);
      return duplicatePreparedInsertionResult(duplicatePreparedInsertion);
    }

    const writeCheck = beginPreparedWrite(this.context, "insert");
    if ("error" in writeCheck) return writeCheck.error;

    const position = resolveInsertionPosition(this.context, params);
    if ("error" in position) return position.error;

    this.markPreparedWrite();
    const result: AiDiffResult = {
      from: position.position,
      original: "",
      replacement: params.content,
      to: position.position,
      type: "insert"
    };
    this.context.onPreviewResult?.(result, toolCallId);
    rememberPreparedInsertion(this.state, {
      content: params.content,
      normalizedContent: normalizePreparedInsertionContent(params.content),
      position: position.position,
      previewId: toolCallId
    });

    return previewPreparedResult(
      result,
      `Prepared an insertion preview at ${params.anchorId ? `${params.placement} (${params.anchorId})` : params.placement}.`
    );
  }
}
