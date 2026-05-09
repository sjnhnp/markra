import type { DocumentAnchorPlacement, RegionOperation } from "./context";

export type ListWorkspaceFilesArgs = {
  limit?: number;
};

export type ReadWorkspaceFileArgs = {
  path?: string;
  relativePath?: string;
};

export type ViewDocumentImageArgs = {
  src: string;
};

export type WebSearchArgs = {
  query: string;
};

export type ReplaceDocumentArgs = {
  replacement: string;
};

export type ReplaceRegionArgs = {
  anchorId?: string;
  replacement: string;
};

export type ReplaceBlockArgs = {
  anchorId?: string;
  replacement: string;
};

export type ReplaceTableArgs = {
  anchorId: string;
  replacement: string;
};

export type ReplaceTableByHeadingArgs = {
  headingTitle: string;
  replacement: string;
};

export type ReplaceBlockByTextArgs = {
  originalText: string;
  replacement: string;
};

export type DeleteRegionArgs = {
  anchorId?: string;
};

export type LocateMarkdownRegionArgs = {
  goal: string;
  operation: RegionOperation;
};

export type LocateSectionArgs = {
  goal?: string;
  headingTitle?: string;
};

export type ReplaceSectionArgs = {
  anchorId: string;
  replacement: string;
};

export type DeleteSectionArgs = {
  anchorId: string;
};

export type InsertMarkdownArgs = {
  anchorId?: string;
  content: string;
  placement: DocumentAnchorPlacement;
};

export function typedListWorkspaceFilesArgs(params: unknown): ListWorkspaceFilesArgs {
  return params as ListWorkspaceFilesArgs;
}

export function typedReadWorkspaceFileArgs(params: unknown): ReadWorkspaceFileArgs {
  const args = params as ReadWorkspaceFileArgs;

  return {
    path: args.path?.trim() || undefined,
    relativePath: args.relativePath?.trim() || undefined
  };
}

export function typedViewDocumentImageArgs(params: unknown): ViewDocumentImageArgs {
  const args = params as ViewDocumentImageArgs;

  return {
    src: args.src.trim()
  };
}

export function typedWebSearchArgs(params: unknown): WebSearchArgs {
  const args = params as WebSearchArgs;

  return {
    query: args.query.trim()
  };
}

export function typedReplaceDocumentArgs(params: unknown): ReplaceDocumentArgs {
  return params as ReplaceDocumentArgs;
}

export function typedReplaceRegionArgs(params: unknown): ReplaceRegionArgs {
  return params as ReplaceRegionArgs;
}

export function typedReplaceBlockArgs(params: unknown): ReplaceBlockArgs {
  const args = params as ReplaceBlockArgs;

  return {
    anchorId: args.anchorId?.trim() || undefined,
    replacement: args.replacement
  };
}

export function typedReplaceTableArgs(params: unknown): ReplaceTableArgs {
  return params as ReplaceTableArgs;
}

export function typedReplaceTableByHeadingArgs(params: unknown): ReplaceTableByHeadingArgs {
  const args = params as ReplaceTableByHeadingArgs;

  return {
    headingTitle: args.headingTitle.trim(),
    replacement: args.replacement
  };
}

export function typedReplaceBlockByTextArgs(params: unknown): ReplaceBlockByTextArgs {
  const args = params as ReplaceBlockByTextArgs;

  return {
    originalText: args.originalText.trim(),
    replacement: args.replacement
  };
}

export function typedDeleteRegionArgs(params: unknown): DeleteRegionArgs {
  return params as DeleteRegionArgs;
}

export function typedLocateMarkdownRegionArgs(params: unknown): LocateMarkdownRegionArgs {
  const args = params as { goal: string; operation?: string };
  const operation = ["delete", "insert", "replace"].includes(args.operation ?? "")
    ? (args.operation as RegionOperation)
    : "insert";

  return {
    goal: args.goal,
    operation
  };
}

export function typedLocateSectionArgs(params: unknown): LocateSectionArgs {
  const args = params as LocateSectionArgs;

  return {
    goal: args.goal?.trim() || undefined,
    headingTitle: args.headingTitle?.trim() || undefined
  };
}

export function typedReplaceSectionArgs(params: unknown): ReplaceSectionArgs {
  return params as ReplaceSectionArgs;
}

export function typedDeleteSectionArgs(params: unknown): DeleteSectionArgs {
  return params as DeleteSectionArgs;
}

export function typedInsertMarkdownArgs(params: unknown): InsertMarkdownArgs {
  const args = params as { anchorId?: string; content: string; placement?: string };
  const placement = [
    "after_anchor",
    "after_selection",
    "after_heading",
    "before_anchor",
    "before_selection",
    "before_heading",
    "cursor"
  ].includes(args.placement ?? "")
    ? (args.placement as DocumentAnchorPlacement)
    : "cursor";

  return {
    anchorId: args.anchorId?.trim() || undefined,
    content: args.content,
    placement
  };
}
