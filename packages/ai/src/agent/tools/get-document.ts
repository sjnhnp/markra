import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";

export class GetDocumentToolFactory extends DocumentAgentToolFactory {
  protected readonly description = "Read the full current Markdown document.";
  protected readonly label = "Read document";
  protected readonly name = "get_document";
  protected readonly parameters = Type.Object({});

  protected executeTool() {
    return {
      content: [
        {
          text: [
            `Document path: ${this.context.documentPath ?? "Untitled.md"}`,
            "",
            this.context.documentContent || "(empty document)"
          ].join("\n"),
          type: "text" as const
        }
      ],
      details: {
        documentPath: this.context.documentPath,
        length: this.context.documentContent.length
      },
      terminate: false
    };
  }
}
