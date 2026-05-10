import type { AiProviderConfig } from "@markra/providers";
import type { ChatImageAttachment, ChatMessage } from "../chat/types";
import type { InlineAiAgentComplete } from "../runtime";
import { extractMarkdownImageReferences, type MarkdownImageReference } from "../tools/images";
import type { DocumentAiImage } from "./types";
import { modelSupportsVision } from "./models";

export async function readPromptedDocumentImages({
  complete,
  documentContent,
  model,
  prompt,
  provider,
  readDocumentImage
}: {
  complete: InlineAiAgentComplete;
  documentContent: string;
  model: string;
  prompt: string;
  provider: AiProviderConfig;
  readDocumentImage?: (src: string) => Promise<DocumentAiImage | null>;
}) {
  if (!readDocumentImage || !modelSupportsVision(provider, model)) {
    return [];
  }

  const references = extractMarkdownImageReferences(documentContent).slice(0, 4);
  if (!references.length) return [];

  const shouldAttachImages = await classifyDocumentImageIntent({
    complete,
    model,
    prompt,
    provider,
    references
  });
  if (!shouldAttachImages) return [];

  const images: ChatImageAttachment[] = [];

  for (const reference of references) {
    try {
      const image = await readDocumentImage(reference.src);
      if (image) {
        images.push({
          dataUrl: image.dataUrl,
          mimeType: image.mimeType
        });
      }
    } catch {
      // Missing local images should not block the text-only AI turn.
    }
  }

  return images;
}

async function classifyDocumentImageIntent({
  complete,
  model,
  prompt,
  provider,
  references
}: {
  complete: InlineAiAgentComplete;
  model: string;
  prompt: string;
  provider: AiProviderConfig;
  references: MarkdownImageReference[];
}) {
  try {
    const response = await complete(provider, model, buildDocumentImageIntentMessages({ prompt, references }), {
      thinkingEnabled: false
    });

    return imageIntentResponseIsPositive(response.content);
  } catch {
    return false;
  }
}

function buildDocumentImageIntentMessages({
  prompt,
  references
}: {
  prompt: string;
  references: MarkdownImageReference[];
}): ChatMessage[] {
  return [
    {
      content: [
        "Decide whether the user's latest request requires visual understanding of image pixels from the current Markdown document.",
        "Understand the request in any language.",
        "Return exactly YES or NO.",
        "Return YES only when the visual content of one or more listed Markdown images is needed.",
        "Return NO for text-only editing, rewriting, translation, or summarization that does not ask about image contents."
      ].join("\n"),
      role: "system"
    },
    {
      content: [
        "User request:",
        prompt.trim(),
        "",
        "Markdown image references:",
        ...references.map((reference, index) => `${index + 1}. alt=${reference.alt || "(empty)"} src=${reference.src}`)
      ].join("\n"),
      role: "user"
    }
  ];
}

function imageIntentResponseIsPositive(content: string) {
  return /^\s*yes\b/iu.test(content);
}
