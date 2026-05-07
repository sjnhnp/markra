export type AiDiffResult =
  | {
      from?: number;
      original: string;
      replacement: string;
      to?: number;
      type: "insert" | "replace";
    }
  | {
      message: string;
      type: "error";
    };

export type AiEditIntent = "custom" | "polish" | "rewrite" | "continue" | "summarize" | "translate";

export type AiTargetScope = "block" | "selection" | "suggestion";

export type AiSelectionContext = {
  cursor?: number;
  from: number;
  source?: "block" | "selection";
  text: string;
  to: number;
};

export type AiHeadingAnchor = {
  from: number;
  level: number;
  title: string;
  to: number;
};

export type AiDocumentAnchor = {
  description: string;
  from: number;
  id: string;
  kind: "current_block" | "document" | "document_end" | "heading" | "section";
  text?: string;
  to: number;
  title?: string;
};
