import type { AiDiffResult } from "../inline";
import type { DocumentAgentToolState, PreparedInsertionPreview } from "./context";

export function previewPreparedResult(result: AiDiffResult, message: string) {
  return {
    content: [
      {
        text: [message, "The user still needs to confirm the change in the editor."].join(" "),
        type: "text" as const
      }
    ],
    details: result,
    terminate: true
  };
}

export function duplicatePreparedInsertionResult(preparedInsertion: PreparedInsertionPreview) {
  return {
    content: [
      {
        text: [
          `An identical insertion preview was already prepared earlier in this turn at position ${preparedInsertion.position}.`,
          "Reuse that pending change instead of inserting the same Markdown again.",
          "The user still needs to confirm the change in the editor."
        ].join(" "),
        type: "text" as const
      }
    ],
    details: {
      duplicateOfPreviewId: preparedInsertion.previewId,
      position: preparedInsertion.position
    },
    terminate: true
  };
}

export function findDuplicatePreparedInsertion(
  state: DocumentAgentToolState,
  content: string
) {
  const normalizedContent = normalizePreparedInsertionContent(content);
  return state.preparedInsertions.find((preparedInsertion) => preparedInsertion.normalizedContent === normalizedContent) ?? null;
}

export function rememberPreparedInsertion(
  state: DocumentAgentToolState,
  preparedInsertion: PreparedInsertionPreview
) {
  state.preparedInsertions.push(preparedInsertion);
}

export function normalizePreparedInsertionContent(content: string) {
  return content
    .replace(/\r\n/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function toolErrorResult(message: string): never {
  throw new Error(message);
}
