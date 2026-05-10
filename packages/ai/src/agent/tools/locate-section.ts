import { Type } from "@mariozechner/pi-ai";
import { buildSectionAnchors } from "./anchors";
import { DocumentAgentToolFactory } from "./base";
import { formatLocatedSectionText } from "./format";
import { locateSection } from "./locate";
import { typedLocateSectionArgs } from "./params";

export class LocateSectionToolFactory extends DocumentAgentToolFactory<ReturnType<typeof typedLocateSectionArgs>> {
  protected readonly description = [
    "Locate the most appropriate document section for a section-level rewrite or deletion.",
    "Use this when the user asks to delete, rewrite, or regenerate an entire section rather than a single block."
  ].join(" ");
  protected readonly label = "Locate section";
  protected readonly name = "locate_section";
  protected readonly parameters = Type.Object({
    goal: Type.Optional(Type.String()),
    headingTitle: Type.Optional(Type.String())
  });

  protected parseParams(params: unknown) {
    return typedLocateSectionArgs(params);
  }

  protected executeTool(_toolCallId: string, params: ReturnType<typeof typedLocateSectionArgs>) {
    const sections = buildSectionAnchors(this.context);
    const located = locateSection(sections, params);

    return {
      content: [
        {
          text: formatLocatedSectionText(located),
          type: "text" as const
        }
      ],
      details: located,
      terminate: false
    };
  }
}
