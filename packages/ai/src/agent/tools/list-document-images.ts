import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import { extractMarkdownImageReferences, formatDocumentImageReferencesText } from "./shared";

export class ListDocumentImagesToolFactory extends DocumentAgentToolFactory {
  protected readonly description = [
    "List local Markdown image references in the current document.",
    "Use this before view_document_image when the user asks about screenshots, figures, diagrams, photos, or other visual content in the document.",
    "The src values returned by this tool are the only values view_document_image can read."
  ].join(" ");
  protected readonly label = "List document images";
  protected readonly name = "list_document_images";
  protected readonly parameters = Type.Object({});

  protected executeTool() {
    const references = extractMarkdownImageReferences(this.context.documentContent);

    return {
      content: [
        {
          text: formatDocumentImageReferencesText(references),
          type: "text" as const
        }
      ],
      details: {
        count: references.length,
        images: references
      },
      terminate: false
    };
  }
}
