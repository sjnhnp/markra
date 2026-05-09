import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import {
  extractMarkdownImageReferences,
  resolveMarkdownImageReference,
  toolErrorResult,
  typedViewDocumentImageArgs
} from "./shared";

export class ViewDocumentImageToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedViewDocumentImageArgs>> {
  protected readonly description = [
    "Read one local image referenced by the current Markdown document and return it for visual understanding.",
    "Call list_document_images first, then pass an exact src from that list.",
    "Use this only when the user's request requires understanding the image pixels."
  ].join(" ");
  protected readonly label = "View document image";
  protected readonly name = "view_document_image";
  protected readonly parameters = Type.Object({
    src: Type.String({ minLength: 1 })
  });

  protected parseParams(params: unknown) {
    return typedViewDocumentImageArgs(params);
  }

  protected async executeTool(_toolCallId: string, params: ReturnType<typeof typedViewDocumentImageArgs>) {
    const references = extractMarkdownImageReferences(this.context.documentContent);
    const reference = resolveMarkdownImageReference(references, params.src);
    if (!reference) {
      return toolErrorResult("Cannot read that image because it is not referenced by the current Markdown document. Call list_document_images and pass an exact src.");
    }

    if (!this.context.readDocumentImage) {
      return toolErrorResult("Document image reading is unavailable in this session.");
    }

    try {
      const image = await this.context.readDocumentImage(reference.src);
      if (!image) {
        return toolErrorResult(`Failed to read Markdown image "${reference.src}".`);
      }

      return {
        content: [
          {
            text: [
              `Image src: ${reference.src}`,
              `Alt text: ${reference.alt || "(empty)"}`,
              `Resolved path: ${image.path ?? "(unavailable)"}`
            ].join("\n"),
            type: "text" as const
          },
          {
            data: image.dataUrl,
            mimeType: image.mimeType,
            type: "image" as const
          }
        ],
        details: {
          alt: reference.alt,
          mimeType: image.mimeType,
          path: image.path ?? null,
          src: reference.src
        },
        terminate: false
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown image read error.";

      return toolErrorResult(`Failed to read Markdown image "${reference.src}": ${message}`);
    }
  }
}
