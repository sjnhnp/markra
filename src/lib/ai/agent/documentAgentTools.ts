import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { AiDiffResult, AiDocumentAnchor, AiHeadingAnchor, AiSelectionContext } from "./inlineAi";
import type { AgentWorkspaceFile } from "./agentTools";

type DocumentAgentToolContext = {
  documentContent: string;
  documentEndPosition: number;
  documentPath: string | null;
  headingAnchors?: AiHeadingAnchor[];
  onPreviewResult?: (result: AiDiffResult) => unknown;
  readWorkspaceFile?: (path: string) => Promise<string>;
  selection: AiSelectionContext | null;
  workspaceFiles: AgentWorkspaceFile[];
};

const workspaceFileReadMaxChars = 24_000;

type DocumentAnchorPlacement =
  | "after_anchor"
  | "after_selection"
  | "after_heading"
  | "before_anchor"
  | "before_selection"
  | "before_heading"
  | "cursor";

type RegionOperation = "delete" | "insert" | "replace";

export function createDocumentAgentTools(context: DocumentAgentToolContext): AgentTool[] {
  let hasPreparedWrite = false;

  return [
    {
      description: "Read the full current Markdown document.",
      execute: async () => ({
        content: [
          {
            text: [
              `Document path: ${context.documentPath ?? "Untitled.md"}`,
              "",
              context.documentContent || "(empty document)"
            ].join("\n"),
            type: "text"
          }
        ],
        details: {
          documentPath: context.documentPath,
          length: context.documentContent.length
        },
        terminate: false
      }),
      label: "Read document",
      name: "get_document",
      parameters: Type.Object({})
    },
    {
      description: "Read the active selection, or the current Markdown block when there is no explicit selection.",
      execute: async () => ({
        content: [
          {
            text: formatSelectionText(context.selection),
            type: "text"
          }
        ],
        details: context.selection,
        terminate: false
      }),
      label: "Read selection",
      name: "get_selection",
      parameters: Type.Object({})
    },
    {
      description: "List nearby Markdown files in the current workspace.",
      execute: async (_toolCallId, params) => ({
        content: [
          {
            text: formatWorkspaceFilesText(context.workspaceFiles, typedListWorkspaceFilesArgs(params).limit),
            type: "text"
          }
        ],
        details: {
          count: context.workspaceFiles.length,
          limit: typedListWorkspaceFilesArgs(params).limit
        },
        terminate: false
      }),
      label: "List workspace files",
      name: "list_workspace_files",
      parameters: Type.Object({
        limit: Type.Optional(Type.Number({ maximum: 200, minimum: 1 }))
      })
    },
    {
      description:
        [
          "Read a Markdown file from the current workspace.",
          "Call list_workspace_files first, then pass an exact relativePath or exact path from that list.",
          "This tool cannot read arbitrary paths outside the current Markdown workspace."
        ].join(" "),
      execute: async (_toolCallId, params) => {
        const file = resolveWorkspaceFile(context.workspaceFiles, typedReadWorkspaceFileArgs(params));
        if (!file) {
          return toolErrorResult(
            "Cannot read that file because it is not in the current Markdown workspace. Call list_workspace_files first and pass an exact relativePath or path."
          );
        }

        if (!context.readWorkspaceFile) {
          return toolErrorResult("Workspace file reading is unavailable in this session.");
        }

        try {
          const content = await context.readWorkspaceFile(file.path);
          const readableContent = truncateWorkspaceFileContent(content);

          return {
            content: [
              {
                text: formatWorkspaceFileContentText(file, readableContent.text),
                type: "text" as const
              }
            ],
            details: {
              length: content.length,
              path: file.path,
              relativePath: file.relativePath,
              truncated: readableContent.truncated
            },
            terminate: false
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown file read error.";

          return toolErrorResult(`Failed to read workspace file "${file.relativePath}": ${message}`);
        }
      },
      label: "Read workspace file",
      name: "read_workspace_file",
      parameters: Type.Object({
        path: Type.Optional(Type.String({ minLength: 1 })),
        relativePath: Type.Optional(Type.String({ minLength: 1 }))
      })
    },
    {
      description: "Read the current Markdown heading outline with editor positions.",
      execute: async () => ({
        content: [
          {
            text: formatHeadingOutlineText(context.headingAnchors ?? []),
            type: "text"
          }
        ],
        details: {
          count: (context.headingAnchors ?? []).length
        },
        terminate: false
      }),
      label: "Read document outline",
      name: "get_document_outline",
      parameters: Type.Object({})
    },
    {
      description: "Read section-level anchors derived from headings, each covering a full section until the next same-level heading or document end.",
      execute: async () => {
        const sectionAnchors = buildSectionAnchors(context);

        return {
          content: [
            {
              text: formatSectionAnchorsText(sectionAnchors),
              type: "text"
            }
          ],
          details: {
            count: sectionAnchors.length
          },
          terminate: false
        };
      },
      label: "Read document sections",
      name: "get_document_sections",
      parameters: Type.Object({})
    },
    {
      description: "Read the available document anchors the agent can use for insertion, replacement, or deletion.",
      execute: async () => {
        const anchors = buildDocumentAnchors(context);

        return {
          content: [
            {
              text: formatDocumentAnchorsText(anchors),
              type: "text"
            }
          ],
          details: {
            anchors: anchors.map((anchor) => ({
              description: anchor.description,
              id: anchor.id,
              kind: anchor.kind,
              title: anchor.title
            })),
            count: anchors.length
          },
          terminate: false
        };
      },
      label: "Read available anchors",
      name: "get_available_anchors",
      parameters: Type.Object({})
    },
    {
      description:
        [
          "Locate the most appropriate document anchor for an edit.",
          "Use this before writing when the insertion or replacement location is ambiguous.",
          "The tool will inspect the current block, headings, and document end, then recommend the best anchor."
        ].join(" "),
      execute: async (_toolCallId, params) => {
        const anchors = buildDocumentAnchors(context);
        const args = typedLocateMarkdownRegionArgs(params);
        const located = locateMarkdownRegion(anchors, args.goal, args.operation);

        return {
          content: [
            {
              text: formatLocatedRegionText(located),
              type: "text"
            }
          ],
          details: located,
          terminate: false
        };
      },
      label: "Locate document region",
      name: "locate_markdown_region",
      parameters: Type.Object({
        goal: Type.String({ minLength: 1 }),
        operation: Type.Optional(Type.String())
      })
    },
    {
      description:
        [
          "Locate the most appropriate document section for a section-level rewrite or deletion.",
          "Use this when the user asks to delete, rewrite, or regenerate an entire section rather than a single block."
        ].join(" "),
      execute: async (_toolCallId, params) => {
        const args = typedLocateSectionArgs(params);
        const sections = buildSectionAnchors(context);
        const located = locateSection(sections, args);

        return {
          content: [
            {
              text: formatLocatedSectionText(located),
              type: "text"
            }
          ],
          details: located,
          terminate: false
        };
      },
      label: "Locate section",
      name: "locate_section",
      parameters: Type.Object({
        goal: Type.Optional(Type.String()),
        headingTitle: Type.Optional(Type.String())
      })
    },
    {
      description:
        "Replace the active selection, current block, or a resolved anchor with new Markdown. Use this when the user asks you to rewrite or fix existing content.",
      execute: async (_toolCallId, params) => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "replace");
        if ("error" in writeCheck) return writeCheck.error;

        const args = typedReplaceRegionArgs(params);
        const region = resolveWriteRegion(context, args.anchorId, "replace");
        if ("error" in region) return region.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: region.region.from,
          original: region.region.original,
          replacement: args.replacement,
          to: region.region.to,
          type: "replace"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          "Prepared a replacement preview for the resolved region."
        );
      },
      label: "Replace region",
      name: "replace_region",
      parameters: Type.Object({
        anchorId: Type.Optional(Type.String()),
        replacement: Type.String({ minLength: 1 })
      })
    },
    {
      description:
        "Replace an entire Markdown section identified by a section anchor. Use this when the user asks to rewrite or remove a whole numbered section or heading group.",
      execute: async (_toolCallId, params) => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "replace");
        if ("error" in writeCheck) return writeCheck.error;

        const args = typedReplaceSectionArgs(params);
        const section = resolveSectionAnchor(context, args.anchorId);
        if ("error" in section) return section.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: section.anchor.from,
          original: section.anchor.text ?? "",
          replacement: args.replacement,
          to: section.anchor.to,
          type: "replace"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          `Prepared a section replacement preview for ${section.anchor.title ?? section.anchor.id}.`
        );
      },
      label: "Replace section",
      name: "replace_section",
      parameters: Type.Object({
        anchorId: Type.String({ minLength: 1 }),
        replacement: Type.String()
      })
    },
    {
      description:
        "Delete the active selection, current block, or a resolved anchor from the editor. Use this when the user wants to remove content.",
      execute: async (_toolCallId, params) => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "delete");
        if ("error" in writeCheck) return writeCheck.error;

        const args = typedDeleteRegionArgs(params);
        const region = resolveWriteRegion(context, args.anchorId, "delete");
        if ("error" in region) return region.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: region.region.from,
          original: region.region.original,
          replacement: "",
          to: region.region.to,
          type: "replace"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          "Prepared a deletion preview for the resolved region."
        );
      },
      label: "Delete region",
      name: "delete_region",
      parameters: Type.Object({
        anchorId: Type.Optional(Type.String())
      })
    },
    {
      description:
        "Delete an entire Markdown section identified by a section anchor. Use this when the user asks to remove a whole section.",
      execute: async (_toolCallId, params) => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "delete");
        if ("error" in writeCheck) return writeCheck.error;

        const args = typedDeleteSectionArgs(params);
        const section = resolveSectionAnchor(context, args.anchorId);
        if ("error" in section) return section.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: section.anchor.from,
          original: section.anchor.text ?? "",
          replacement: "",
          to: section.anchor.to,
          type: "replace"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          `Prepared a section deletion preview for ${section.anchor.title ?? section.anchor.id}.`
        );
      },
      label: "Delete section",
      name: "delete_section",
      parameters: Type.Object({
        anchorId: Type.String({ minLength: 1 })
      })
    },
    {
      description:
        [
          "Insert new Markdown using either the current editor context or a resolved anchor.",
          "Prefer anchorId after using locate_markdown_region when the location is not obvious.",
          "Use placement=cursor only when the insertion should follow the active caret.",
          "Use placement=after_anchor or placement=before_anchor with anchorId when you want to insert around a heading, current block, or document end anchor."
        ].join(" "),
      execute: async (_toolCallId, params) => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "insert");
        if ("error" in writeCheck) return writeCheck.error;

        const args = typedInsertMarkdownArgs(params);
        const position = resolveInsertionPosition(context, args);
        if ("error" in position) return position.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: position.position,
          original: "",
          replacement: args.content,
          to: position.position,
          type: "insert"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          `Prepared an insertion preview at ${args.anchorId ? `${args.placement} (${args.anchorId})` : args.placement}.`
        );
      },
      label: "Insert markdown",
      name: "insert_markdown",
      parameters: Type.Object({
        anchorId: Type.Optional(Type.String()),
        content: Type.String({ minLength: 1 }),
        placement: Type.Optional(Type.String())
      })
    },
    {
      description:
        "Replace the active selection or current block with new Markdown. Legacy compatibility tool; prefer replace_region for new agent behavior.",
      execute: async (_toolCallId, params) => {
        const args = typedReplaceSelectionArgs(params);
        const region = resolveWriteRegion(context, undefined, "replace");
        if ("error" in region) return region.error;

        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "replace");
        if ("error" in writeCheck) return writeCheck.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: region.region.from,
          original: region.region.original,
          replacement: args.replacement,
          to: region.region.to,
          type: "replace"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          "Prepared a replacement preview for the current selection."
        );
      },
      label: "Replace selection",
      name: "replace_selection",
      parameters: Type.Object({
        replacement: Type.String({ minLength: 1 })
      })
    },
    {
      description:
        "Delete the active selection or current block from the editor. Legacy compatibility tool; prefer delete_region for new agent behavior.",
      execute: async () => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "delete");
        if ("error" in writeCheck) return writeCheck.error;

        const region = resolveWriteRegion(context, undefined, "delete");
        if ("error" in region) return region.error;

        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: region.region.from,
          original: region.region.original,
          replacement: "",
          to: region.region.to,
          type: "replace"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          "Prepared a deletion preview for the current selection."
        );
      },
      label: "Delete selection",
      name: "delete_selection",
      parameters: Type.Object({})
    },
    {
      description:
        "Insert new Markdown immediately after the active selection or current block. Legacy compatibility tool; prefer insert_markdown for new agent behavior.",
      execute: async (_toolCallId, params) => {
        const writeCheck = beginPreparedWrite(context, hasPreparedWrite, "insert");
        if ("error" in writeCheck) return writeCheck.error;

        const region = resolveWriteRegion(context, undefined, "insert");
        if ("error" in region) return region.error;

        const args = typedInsertAfterSelectionArgs(params);
        hasPreparedWrite = true;
        const result: AiDiffResult = {
          from: region.region.to,
          original: "",
          replacement: args.content,
          to: region.region.to,
          type: "insert"
        };
        context.onPreviewResult?.(result);

        return previewPreparedResult(
          result,
          "Prepared an insertion preview after the current selection."
        );
      },
      label: "Insert after selection",
      name: "insert_after_selection",
      parameters: Type.Object({
        content: Type.String({ minLength: 1 })
      })
    }
  ];
}

function buildDocumentAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  const anchors: AiDocumentAnchor[] = [];

  if (context.selection?.text.trim()) {
    anchors.push({
      description:
        context.selection.source === "selection"
          ? "Current selected text"
          : "Current text block under the cursor",
      from: context.selection.from,
      id: "current-context",
      kind: "current_block",
      text: context.selection.text,
      title: summarizeAnchorTitle(context.selection.text),
      to: context.selection.to
    });
  }

  (context.headingAnchors ?? []).forEach((heading, index) => {
    anchors.push({
      description: `Heading level ${heading.level}: ${heading.title}`,
      from: heading.from,
      id: `heading:${index}`,
      kind: "heading",
      text: heading.title,
      title: heading.title,
      to: heading.to
    });
  });

  anchors.push({
    description: "End of the current document",
    from: context.documentEndPosition,
    id: "document-end",
    kind: "document_end",
    to: context.documentEndPosition
  });

  return anchors;
}

function buildSectionAnchors(context: DocumentAgentToolContext): AiDocumentAnchor[] {
  const headings = [...(context.headingAnchors ?? [])].sort((left, right) => left.from - right.from);
  const anchors: AiDocumentAnchor[] = [];

  headings.forEach((heading, index) => {
    let sectionEnd = context.documentEndPosition;

    for (let nextIndex = index + 1; nextIndex < headings.length; nextIndex += 1) {
      const nextHeading = headings[nextIndex]!;
      if (nextHeading.level <= heading.level) {
        sectionEnd = nextHeading.from;
        break;
      }
    }

    anchors.push({
      description: `Section ${heading.title}`,
      from: heading.from,
      id: `section:${index}`,
      kind: "section",
      text: sliceDocumentText(context.documentContent, heading.from, sectionEnd),
      title: heading.title,
      to: sectionEnd
    });
  });

  return anchors;
}

function formatHeadingOutlineText(headingAnchors: AiHeadingAnchor[]) {
  if (!headingAnchors.length) return "No Markdown headings are available in the current document.";

  return headingAnchors
    .map((heading) => `${"#".repeat(Math.max(1, heading.level))} ${heading.title} (${heading.from}-${heading.to})`)
    .join("\n");
}

function formatSectionAnchorsText(sectionAnchors: AiDocumentAnchor[]) {
  if (!sectionAnchors.length) return "No Markdown sections are available in the current document.";

  return sectionAnchors
    .map((section) => `- ${section.id}: ${section.title ?? "(untitled)"} (${section.from}-${section.to})`)
    .join("\n");
}

function formatDocumentAnchorsText(anchors: AiDocumentAnchor[]) {
  return anchors
    .map((anchor) => `- ${anchor.id}: ${anchor.description} (${anchor.from}-${anchor.to})`)
    .join("\n");
}

function formatSelectionText(selection: AiSelectionContext | null) {
  if (!selection?.text.trim()) {
    return "No active selection or current block is available right now.";
  }

  return [
    `Range: ${selection.from}-${selection.to}`,
    `Cursor: ${selection.cursor ?? selection.to}`,
    `Source: ${selection.source ?? "selection"}`,
    "",
    selection.text
  ].join("\n");
}

function formatWorkspaceFilesText(workspaceFiles: AgentWorkspaceFile[], limit: number | undefined) {
  if (!workspaceFiles.length) return "No nearby Markdown files are available.";

  return workspaceFiles
    .slice(0, limit ?? 40)
    .map((file) => `- ${file.relativePath}`)
    .join("\n");
}

function formatWorkspaceFileContentText(file: AgentWorkspaceFile, content: string) {
  return [
    `Workspace file: ${file.relativePath}`,
    "",
    content.trim().length > 0 ? content : "(empty file)"
  ].join("\n");
}

function truncateWorkspaceFileContent(content: string) {
  if (content.length <= workspaceFileReadMaxChars) {
    return {
      text: content,
      truncated: false
    };
  }

  return {
    text: [
      content.slice(0, workspaceFileReadMaxChars),
      "",
      `[Truncated after ${workspaceFileReadMaxChars} characters.]`
    ].join("\n"),
    truncated: true
  };
}

function resolveWorkspaceFile(
  workspaceFiles: AgentWorkspaceFile[],
  args: ReturnType<typeof typedReadWorkspaceFileArgs>
) {
  const requestedRelativePath = args.relativePath?.trim();
  const requestedPath = args.path?.trim();

  if (!requestedRelativePath && !requestedPath) return null;

  return workspaceFiles.find((file) => {
    if (requestedRelativePath) return file.relativePath === requestedRelativePath;

    return file.path === requestedPath || file.relativePath === requestedPath;
  }) ?? null;
}

function previewPreparedResult(result: AiDiffResult, message: string) {
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

function beginPreparedWrite(
  context: DocumentAgentToolContext,
  hasPreparedWrite: boolean,
  mode: RegionOperation
): { error: AgentToolResult<{ message: string }> } | { ok: true } {
  if (hasPreparedWrite) {
    return {
      error: toolErrorResult(
        "A pending editor change was already prepared in this turn. Explain that preview to the user instead of creating another one."
      )
    };
  }

  if (mode !== "insert" && !context.selection?.text.trim() && !(context.headingAnchors ?? []).length) {
    return {
      error: toolErrorResult(
        `Cannot ${mode} because there is no active selection, current block, or structural anchor available. Inspect the document first and then resolve a region anchor.`
      )
    };
  }

  return { ok: true };
}

function resolveWriteRegion(
  context: DocumentAgentToolContext,
  anchorId: string | undefined,
  mode: RegionOperation
): { error: AgentToolResult<{ message: string }> } | { region: { from: number; original: string; to: number } } {
  if (!anchorId) {
    if (!context.selection?.text.trim()) {
      return {
        error: toolErrorResult(
          `Cannot ${mode} because there is no active selection or current block. Resolve a document anchor first.`
        )
      };
    }

    return {
      region: {
        from: context.selection.from,
        original: context.selection.text,
        to: context.selection.to
      }
    };
  }

  const anchor = buildDocumentAnchors(context).find((candidate) => candidate.id === anchorId);
  if (!anchor) {
    return {
      error: toolErrorResult(`Cannot ${mode} because the anchor "${anchorId}" was not found.`)
    };
  }

  if (anchor.kind === "document_end") {
    return {
      error: toolErrorResult(`Cannot ${mode} the document-end anchor. Resolve a concrete block or heading instead.`)
    };
  }

  return {
      region: {
        from: anchor.from,
        original: anchor.text ?? sliceDocumentText(context.documentContent, anchor.from, anchor.to),
        to: anchor.to
      }
    };
}

function resolveSectionAnchor(
  context: DocumentAgentToolContext,
  anchorId: string
): { error: AgentToolResult<{ message: string }> } | { anchor: AiDocumentAnchor } {
  const sectionAnchor = buildSectionAnchors(context).find((candidate) => candidate.id === anchorId);
  if (!sectionAnchor) {
    return {
      error: toolErrorResult(`Cannot resolve section anchor "${anchorId}". Read document sections first and use a valid section anchor.`)
    };
  }

  return { anchor: sectionAnchor };
}

function resolveInsertionPosition(
  context: DocumentAgentToolContext,
  args: ReturnType<typeof typedInsertMarkdownArgs>
): { error: AgentToolResult<{ message: string }> } | { position: number } {
  if (args.anchorId) {
    const anchor = buildDocumentAnchors(context).find((candidate) => candidate.id === args.anchorId);
    if (!anchor) {
      return {
        error: toolErrorResult(`Cannot insert because the anchor "${args.anchorId}" was not found.`)
      };
    }

    return {
      position: insertionPositionForAnchor(anchor, args.placement)
    };
  }

  if (context.selection) {
    return {
      position: insertionPositionForSelection(context.selection, args.placement)
    };
  }

  return {
    error: toolErrorResult(
      "Cannot insert because there is no active editor context. Call locate_markdown_region or get_available_anchors first and then insert via anchorId."
    )
  };
}

function locateMarkdownRegion(anchors: AiDocumentAnchor[], goal: string, operation: RegionOperation) {
  const normalizedGoal = normalizeText(goal);
  const scoredAnchors = anchors
    .map((anchor) => ({
      anchor,
      reason: anchorReason(anchor, normalizedGoal, operation),
      score: scoreAnchor(anchor, normalizedGoal, operation)
    }))
    .sort((left, right) => right.score - left.score);

  const best = scoredAnchors[0] ?? {
    anchor: {
      description: "End of the current document",
      from: 0,
      id: "document-end",
      kind: "document_end" as const,
      to: 0
    },
    reason: "Fallback to the end of the current document.",
    score: 0
  };

  return {
    anchorId: best.anchor.id,
    candidates: scoredAnchors.slice(0, 3).map((item) => ({
      anchorId: item.anchor.id,
      description: item.anchor.description,
      reason: item.reason,
      score: item.score
    })),
    operation,
    reason: best.reason
  };
}

function locateSection(sectionAnchors: AiDocumentAnchor[], args: ReturnType<typeof typedLocateSectionArgs>) {
  const normalizedHeadingTitle = normalizeText(args.headingTitle ?? "");
  const normalizedGoal = normalizeText(args.goal ?? args.headingTitle ?? "");
  const scoredSections = sectionAnchors
    .map((anchor) => {
      const normalizedTitle = normalizeText(anchor.title ?? "");
      let score = overlapScore(normalizedGoal, normalizedTitle);

      if (normalizedHeadingTitle && normalizedTitle === normalizedHeadingTitle) score += 20;
      if (normalizedHeadingTitle && normalizedTitle.includes(normalizedHeadingTitle)) score += 8;
      if (containsAny(normalizedGoal, ["section", "heading", "chapter", "小节", "章节", "标题"])) score += 2;

      return {
        anchor,
        reason:
          normalizedHeadingTitle && normalizedTitle === normalizedHeadingTitle
            ? `Exact heading match for "${anchor.title ?? ""}".`
            : `Best semantic section match for "${args.goal ?? args.headingTitle ?? ""}".`,
        score
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = scoredSections[0];
  if (!best) {
    return {
      anchorId: null,
      candidates: [],
      reason: "No section anchor is available in the current document."
    };
  }

  return {
    anchorId: best.anchor.id,
    candidates: scoredSections.slice(0, 3).map((candidate) => ({
      anchorId: candidate.anchor.id,
      description: candidate.anchor.description,
      reason: candidate.reason,
      score: candidate.score
    })),
    reason: best.reason
  };
}

function formatLocatedSectionText(located: ReturnType<typeof locateSection>) {
  return [
    `Recommended section: ${located.anchorId ?? "none"}`,
    `Reason: ${located.reason}`,
    "",
    "Top candidates:",
    ...located.candidates.map((candidate) => `- ${candidate.anchorId}: ${candidate.description} (${candidate.reason})`)
  ].join("\n");
}

function formatLocatedRegionText(located: ReturnType<typeof locateMarkdownRegion>) {
  return [
    `Recommended anchor: ${located.anchorId}`,
    `Reason: ${located.reason}`,
    "",
    "Top candidates:",
    ...located.candidates.map((candidate) => `- ${candidate.anchorId}: ${candidate.description} (${candidate.reason})`)
  ].join("\n");
}

function typedListWorkspaceFilesArgs(params: unknown) {
  return params as { limit?: number };
}

function typedReadWorkspaceFileArgs(params: unknown) {
  const args = params as { path?: string; relativePath?: string };

  return {
    path: args.path?.trim() || undefined,
    relativePath: args.relativePath?.trim() || undefined
  };
}

function typedReplaceSelectionArgs(params: unknown) {
  return params as { replacement: string };
}

function typedReplaceRegionArgs(params: unknown) {
  return params as { anchorId?: string; replacement: string };
}

function typedDeleteRegionArgs(params: unknown) {
  return params as { anchorId?: string };
}

function typedInsertAfterSelectionArgs(params: unknown) {
  return params as { content: string };
}

function typedLocateMarkdownRegionArgs(params: unknown) {
  const args = params as { goal: string; operation?: string };
  const operation = ["delete", "insert", "replace"].includes(args.operation ?? "")
    ? (args.operation as RegionOperation)
    : "insert";

  return {
    goal: args.goal,
    operation
  };
}

function typedLocateSectionArgs(params: unknown) {
  const args = params as { goal?: string; headingTitle?: string };

  return {
    goal: args.goal?.trim() || undefined,
    headingTitle: args.headingTitle?.trim() || undefined
  };
}

function typedReplaceSectionArgs(params: unknown) {
  return params as { anchorId: string; replacement: string };
}

function typedDeleteSectionArgs(params: unknown) {
  return params as { anchorId: string };
}

function typedInsertMarkdownArgs(params: unknown) {
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

function insertionPositionForSelection(
  selection: AiSelectionContext,
  placement: DocumentAnchorPlacement
) {
  if (placement === "before_selection" || placement === "before_anchor" || placement === "before_heading") {
    return selection.from;
  }

  if (placement === "after_selection" || placement === "after_anchor" || placement === "after_heading") {
    return selection.to;
  }

  return selection.cursor ?? selection.to;
}

function insertionPositionForAnchor(anchor: AiDocumentAnchor, placement: DocumentAnchorPlacement) {
  if (anchor.kind === "document_end") return anchor.to;
  if (placement === "before_anchor" || placement === "before_heading" || placement === "before_selection") return anchor.from;
  if (placement === "cursor") return anchor.to;

  return anchor.to;
}

function scoreAnchor(anchor: AiDocumentAnchor, normalizedGoal: string, operation: RegionOperation) {
  let score = 0;

  if (anchor.kind === "current_block") {
    if (containsAny(normalizedGoal, ["current", "current block", "current section", "here", "selected", "this block", "this section", "这里", "当前", "此处", "本段", "选中"])) score += 10;
    if (operation !== "insert") score += 2;
  }

  if (anchor.kind === "document_end") {
    if (containsAny(normalizedGoal, ["append", "at the end", "document end", "end of document", "final section", "末尾", "文末", "最后", "结尾", "追加"])) score += 12;
    else score += 1;
  }

  if (anchor.kind === "heading") {
    const normalizedTitle = normalizeText(anchor.title ?? "");
    if (normalizedGoal.includes(normalizedTitle) && normalizedTitle) score += 14;
    if (normalizedTitle.includes(normalizedGoal) && normalizedGoal) score += 8;
    score += overlapScore(normalizedGoal, normalizedTitle);
    if (containsAny(normalizedGoal, ["section", "heading", "chapter", "标题", "章节", "小节"])) score += 2;
  }

  return score;
}

function anchorReason(anchor: AiDocumentAnchor, normalizedGoal: string, operation: RegionOperation) {
  if (anchor.kind === "current_block" && scoreAnchor(anchor, normalizedGoal, operation) >= 10) {
    return "The request points to the current editing context.";
  }
  if (anchor.kind === "heading" && scoreAnchor(anchor, normalizedGoal, operation) >= 10) {
    return `The request best matches the heading "${anchor.title ?? ""}".`;
  }
  if (anchor.kind === "document_end") {
    return "The request looks like an append-at-the-end operation.";
  }

  return `This anchor is available as a fallback ${anchor.kind.replace("_", " ")} location.`;
}

function containsAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function overlapScore(left: string, right: string) {
  if (!left || !right) return 0;

  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  let score = 0;

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) score += 2;
  });

  return score;
}

function tokenize(value: string) {
  return new Set(
    value
      .split(/[\s/._-]+/u)
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[`"'“”‘’#*()[\]{}:,.!?]/gu, " ").replace(/\s+/gu, " ").trim();
}

function summarizeAnchorTitle(text: string) {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

function sliceDocumentText(content: string, from: number, to: number) {
  if (from >= to) return "";

  return content.slice(Math.max(0, from), Math.max(0, to));
}

function toolErrorResult(message: string) {
  return {
    content: [{ text: message, type: "text" as const }],
    details: { message },
    terminate: false
  } satisfies AgentToolResult<{ message: string }>;
}
