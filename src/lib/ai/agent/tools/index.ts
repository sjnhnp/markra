import type { AgentTool } from "@mariozechner/pi-agent-core";
import { BuiltinWebSearchToolFactory } from "./builtinWebSearch";
import { DeleteRegionToolFactory } from "./deleteRegion";
import { DeleteSectionToolFactory } from "./deleteSection";
import { GetAvailableAnchorsToolFactory } from "./getAvailableAnchors";
import { GetDocumentToolFactory } from "./getDocument";
import { GetDocumentOutlineToolFactory } from "./getDocumentOutline";
import { GetDocumentSectionsToolFactory } from "./getDocumentSections";
import { GetSelectionToolFactory } from "./getSelection";
import { InsertMarkdownToolFactory } from "./insertMarkdown";
import { ListDocumentImagesToolFactory } from "./listDocumentImages";
import { ListWorkspaceFilesToolFactory } from "./listWorkspaceFiles";
import { LocateMarkdownRegionToolFactory } from "./locateMarkdownRegion";
import { LocateSectionToolFactory } from "./locateSection";
import { ReadWorkspaceFileToolFactory } from "./readWorkspaceFile";
import { ReplaceBlockByTextToolFactory } from "./replaceBlockByText";
import { ReplaceBlockToolFactory } from "./replaceBlock";
import { ReplaceDocumentToolFactory } from "./replaceDocument";
import { ReplaceRegionToolFactory } from "./replaceRegion";
import { ReplaceSectionToolFactory } from "./replaceSection";
import { ReplaceTableByHeadingToolFactory } from "./replaceTableByHeading";
import { ReplaceTableToolFactory } from "./replaceTable";
import type { DocumentAgentToolContext, DocumentAgentToolState } from "./shared";
import { ViewDocumentImageToolFactory } from "./viewDocumentImage";

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
