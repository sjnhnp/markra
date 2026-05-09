import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import {
  formatWorkspaceFileContentText,
  resolveWorkspaceFile,
  toolErrorResult,
  truncateWorkspaceFileContent,
  typedReadWorkspaceFileArgs
} from "./shared";

export class ReadWorkspaceFileToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedReadWorkspaceFileArgs>> {
  protected readonly description = [
    "Read a Markdown file from the current workspace.",
    "Call list_workspace_files first, then pass an exact relativePath or exact path from that list.",
    "This tool cannot read arbitrary paths outside the current Markdown workspace."
  ].join(" ");
  protected readonly label = "Read workspace file";
  protected readonly name = "read_workspace_file";
  protected readonly parameters = Type.Object({
    path: Type.Optional(Type.String({ minLength: 1 })),
    relativePath: Type.Optional(Type.String({ minLength: 1 }))
  });

  protected parseParams(params: unknown) {
    return typedReadWorkspaceFileArgs(params);
  }

  protected async executeTool(_toolCallId: string, params: ReturnType<typeof typedReadWorkspaceFileArgs>) {
    const file = resolveWorkspaceFile(this.context.workspaceFiles, params);
    if (!file) {
      return toolErrorResult(
        "Cannot read that file because it is not in the current Markdown workspace. Call list_workspace_files first and pass an exact relativePath or path."
      );
    }

    if (!this.context.readWorkspaceFile) {
      return toolErrorResult("Workspace file reading is unavailable in this session.");
    }

    try {
      const content = await this.context.readWorkspaceFile(file.path);
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
  }
}
