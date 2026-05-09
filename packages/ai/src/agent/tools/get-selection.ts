import { Type } from "@mariozechner/pi-ai";
import { DocumentAgentToolFactory } from "./base";
import { formatSelectionText } from "./format";

export class GetSelectionToolFactory extends DocumentAgentToolFactory {
  protected readonly description = "Read the active selection, or the current Markdown block when there is no explicit selection.";
  protected readonly label = "Read selection";
  protected readonly name = "get_selection";
  protected readonly parameters = Type.Object({});

  protected executeTool() {
    return {
      content: [
        {
          text: formatSelectionText(this.context.selection),
          type: "text" as const
        }
      ],
      details: this.context.selection,
      terminate: false
    };
  }
}
