import type { AgentTool } from "@mariozechner/pi-agent-core";
import { BuiltinWebSearchToolFactory } from "./builtin-web-search";
import { DeleteRegionToolFactory } from "./delete-region";
import { DeleteSectionToolFactory } from "./delete-section";
import { GetAvailableAnchorsToolFactory } from "./get-available-anchors";
import { GetDocumentToolFactory } from "./get-document";
import { GetDocumentOutlineToolFactory } from "./get-document-outline";
import { GetDocumentSectionsToolFactory } from "./get-document-sections";
import { GetSelectionToolFactory } from "./get-selection";
import { InsertMarkdownToolFactory } from "./insert-markdown";
import { ListDocumentImagesToolFactory } from "./list-document-images";
import { ListWorkspaceFilesToolFactory } from "./list-workspace-files";
import { LocateMarkdownRegionToolFactory } from "./locate-markdown-region";
import { LocateSectionToolFactory } from "./locate-section";
import { ReadWorkspaceFileToolFactory } from "./read-workspace-file";
import { ReplaceBlockByTextToolFactory } from "./replace-block-by-text";
import { ReplaceBlockToolFactory } from "./replace-block";
import { ReplaceDocumentToolFactory } from "./replace-document";
import { ReplaceRegionToolFactory } from "./replace-region";
import { ReplaceSectionToolFactory } from "./replace-section";
import { ReplaceTableByHeadingToolFactory } from "./replace-table-by-heading";
import { ReplaceTableToolFactory } from "./replace-table";
import type { DocumentAgentToolContext, DocumentAgentToolState } from "./context";
import { ViewDocumentImageToolFactory } from "./view-document-image";

export function createDocumentAgentTools(context: DocumentAgentToolContext): AgentTool[] {
  const state: DocumentAgentToolState = {
    preparedInsertions: [],
    preparedWriteCount: 0
  };
  const tools = [
    ...(context.webSearch ? [new BuiltinWebSearchToolFactory(context, state)] : []),
    ...(context.readDocumentImage
      ? [
          new ListDocumentImagesToolFactory(context, state),
          new ViewDocumentImageToolFactory(context, state)
        ]
      : []),
    new GetDocumentToolFactory(context, state),
    new GetSelectionToolFactory(context, state),
    new ListWorkspaceFilesToolFactory(context, state),
    new ReadWorkspaceFileToolFactory(context, state),
    new GetDocumentOutlineToolFactory(context, state),
    new GetDocumentSectionsToolFactory(context, state),
    new GetAvailableAnchorsToolFactory(context, state),
    new LocateMarkdownRegionToolFactory(context, state),
    new LocateSectionToolFactory(context, state),
    new ReplaceDocumentToolFactory(context, state),
    new ReplaceBlockToolFactory(context, state),
    new ReplaceRegionToolFactory(context, state),
    new ReplaceTableToolFactory(context, state),
    new ReplaceTableByHeadingToolFactory(context, state),
    new ReplaceBlockByTextToolFactory(context, state),
    new ReplaceSectionToolFactory(context, state),
    new DeleteRegionToolFactory(context, state),
    new DeleteSectionToolFactory(context, state),
    new InsertMarkdownToolFactory(context, state)
  ];

  return tools.map((tool) => tool.create());
}
