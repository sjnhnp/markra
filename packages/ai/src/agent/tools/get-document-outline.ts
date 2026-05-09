import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import { formatHeadingOutlineText } from "./format";

export class GetDocumentOutlineToolFactory extends DocumentAgentToolFactory {
  protected readonly description = "Read the current Markdown heading outline with editor positions.";
  protected readonly label = "Read document outline";
  protected readonly name = "get_document_outline";
  protected readonly parameters = Type.Object({});

  protected executeTool() {
    return {
      content: [
        {
          text: formatHeadingOutlineText(this.context.headingAnchors ?? []),
          type: "text" as const
        }
      ],
      details: {
        count: (this.context.headingAnchors ?? []).length
      },
      terminate: false
    };
  }
}
