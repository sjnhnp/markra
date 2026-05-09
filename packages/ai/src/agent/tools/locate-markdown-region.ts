import { Type } from "@mariozechner/pi-ai";
import { buildDocumentAnchors } from "./anchors";
import { DocumentAgentToolFactory } from "./base";
import { formatLocatedRegionText } from "./format";
import { locateMarkdownRegion } from "./locate";
import { typedLocateMarkdownRegionArgs } from "./params";

export class LocateMarkdownRegionToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedLocateMarkdownRegionArgs>> {
  protected readonly description = [
    "Locate the most appropriate document anchor for an edit.",
    "Use this before writing when the insertion or replacement location is ambiguous.",
    "The tool will inspect the current block, Markdown tables, headings, and document end, then recommend the best anchor."
  ].join(" ");
  protected readonly label = "Locate document region";
  protected readonly name = "locate_markdown_region";
  protected readonly parameters = Type.Object({
    goal: Type.String({ minLength: 1 }),
    operation: Type.Optional(Type.Union([
      Type.Literal("delete"),
      Type.Literal("insert"),
      Type.Literal("replace")
    ]))
  });

  protected parseParams(params: unknown) {
    return typedLocateMarkdownRegionArgs(params);
  }

  protected executeTool(_toolCallId: string, params: ReturnType<typeof typedLocateMarkdownRegionArgs>) {
    const anchors = buildDocumentAnchors(this.context);
    const located = locateMarkdownRegion(anchors, params.goal, params.operation);

    return {
      content: [
        {
          text: formatLocatedRegionText(located),
          type: "text" as const
        }
      ],
      details: located,
      terminate: false
    };
  }
}
