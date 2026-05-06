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
  from: number;
  source?: "block" | "selection";
  text: string;
  to: number;
};
