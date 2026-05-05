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

export type AiSelectionContext = {
  from: number;
  text: string;
  to: number;
};
