import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import { formatWorkspaceFilesText, typedListWorkspaceFilesArgs } from "./shared";

export class ListWorkspaceFilesToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedListWorkspaceFilesArgs>> {
  protected readonly description = "List nearby Markdown files in the current workspace.";
  protected readonly label = "List workspace files";
  protected readonly name = "list_workspace_files";
  protected readonly parameters = Type.Object({
    limit: Type.Optional(Type.Number({ maximum: 200, minimum: 1 }))
  });

  protected parseParams(params: unknown) {
    return typedListWorkspaceFilesArgs(params);
  }

  protected executeTool(_toolCallId: string, params: ReturnType<typeof typedListWorkspaceFilesArgs>) {
    return {
      content: [
        {
          text: formatWorkspaceFilesText(this.context.workspaceFiles, params.limit),
          type: "text" as const
        }
      ],
      details: {
        count: this.context.workspaceFiles.length,
        limit: params.limit
      },
      terminate: false
    };
  }
}
