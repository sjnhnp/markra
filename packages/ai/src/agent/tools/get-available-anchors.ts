import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import { buildDocumentAnchors, formatDocumentAnchorsText } from "./shared";

export class GetAvailableAnchorsToolFactory extends DocumentAgentToolFactory {
  protected readonly description = "Read the available document anchors the agent can use for insertion, replacement, or deletion.";
  protected readonly label = "Read available anchors";
  protected readonly name = "get_available_anchors";
  protected readonly parameters = Type.Object({});

  protected executeTool() {
    const anchors = buildDocumentAnchors(this.context);

    return {
      content: [
        {
          text: formatDocumentAnchorsText(anchors),
          type: "text" as const
        }
      ],
      details: {
        anchors: anchors.map((anchor) => ({
          description: anchor.description,
          id: anchor.id,
          kind: anchor.kind,
          title: anchor.title
        })),
        count: anchors.length
      },
      terminate: false
    };
  }
}
