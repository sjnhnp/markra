import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import { buildSectionAnchors, formatSectionAnchorsText } from "./shared";

export class GetDocumentSectionsToolFactory extends DocumentAgentToolFactory {
  protected readonly description = "Read section-level anchors derived from headings, each covering a full section until the next same-level heading or document end.";
  protected readonly label = "Read document sections";
  protected readonly name = "get_document_sections";
  protected readonly parameters = Type.Object({});

  protected executeTool() {
    const sectionAnchors = buildSectionAnchors(this.context);

    return {
      content: [
        {
          text: formatSectionAnchorsText(sectionAnchors),
          type: "text" as const
        }
      ],
      details: {
        count: sectionAnchors.length
      },
      terminate: false
    };
  }
}
