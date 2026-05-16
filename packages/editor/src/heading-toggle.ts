import { headingSchema } from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode, NodeType } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

export type HeadingToggleLabels = {
  collapseSection: string;
  expandSection: string;
};

type CollapsedHeadingState = {
  collapsed: readonly number[];
};

type HeadingToggleMeta = {
  from: number;
  type: "toggle";
};

type TopLevelBlock = {
  from: number;
  node: ProseNode;
  to: number;
};

type HeadingSection = {
  contentFrom: number;
  from: number;
  level: number;
  node: ProseNode;
  to: number;
};

const defaultHeadingToggleLabels: HeadingToggleLabels = {
  collapseSection: "Collapse section",
  expandSection: "Expand section"
};

const emptyCollapsedHeadingState: CollapsedHeadingState = {
  collapsed: []
};

const headingToggleKey = new PluginKey<CollapsedHeadingState>("markra-heading-toggle");

function normalizeHeadingToggleLabels(labels: Partial<HeadingToggleLabels> | undefined): HeadingToggleLabels {
  return {
    ...defaultHeadingToggleLabels,
    ...labels
  };
}

function headingLevel(node: ProseNode) {
  const level = Number(node.attrs.level ?? 1);
  if (!Number.isFinite(level)) return 1;

  return Math.max(1, Math.min(6, Math.trunc(level)));
}

function collectTopLevelBlocks(doc: ProseNode) {
  const blocks: TopLevelBlock[] = [];

  doc.forEach((node, offset) => {
    blocks.push({
      from: offset,
      node,
      to: offset + node.nodeSize
    });
  });

  return blocks;
}

function collectHeadingSections(doc: ProseNode, heading: NodeType) {
  const blocks = collectTopLevelBlocks(doc);
  const sections: HeadingSection[] = [];

  for (const [index, block] of blocks.entries()) {
    if (block.node.type !== heading) continue;

    const level = headingLevel(block.node);
    let sectionEnd = doc.content.size;

    for (const nextBlock of blocks.slice(index + 1)) {
      if (nextBlock.node.type !== heading) continue;
      if (headingLevel(nextBlock.node) > level) continue;

      sectionEnd = nextBlock.from;
      break;
    }

    sections.push({
      contentFrom: block.to,
      from: block.from,
      level,
      node: block.node,
      to: sectionEnd
    });
  }

  return sections;
}

function findHeadingStartAtPosition(state: EditorState, heading: NodeType, position: number) {
  const safePosition = Math.max(0, Math.min(position, state.doc.content.size));
  const nodeAtPosition = state.doc.nodeAt(safePosition);
  if (nodeAtPosition?.type === heading) return safePosition;

  const $position = state.doc.resolve(safePosition);
  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type === heading) return $position.before(depth);
  }

  return null;
}

function normalizeCollapsedPositions(state: EditorState, heading: NodeType, positions: readonly number[]) {
  const collapsed = new Set<number>();

  for (const position of positions) {
    const headingStart = findHeadingStartAtPosition(state, heading, position);
    if (headingStart !== null) collapsed.add(headingStart);
  }

  return Array.from(collapsed).sort((left, right) => left - right);
}

function mapCollapsedPositions(
  transaction: Transaction,
  state: EditorState,
  heading: NodeType,
  positions: readonly number[]
) {
  return normalizeCollapsedPositions(
    state,
    heading,
    positions.map((position) => transaction.mapping.map(position, 1))
  );
}

function toggleCollapsedPosition(positions: readonly number[], position: number) {
  return positions.includes(position)
    ? positions.filter((collapsedPosition) => collapsedPosition !== position)
    : [...positions, position].sort((left, right) => left - right);
}

function createHeadingToggleButton(
  view: EditorView,
  getHeadingFrom: () => number,
  collapsed: boolean,
  labels: HeadingToggleLabels
) {
  const button = view.dom.ownerDocument.createElement("button");
  const label = collapsed ? labels.expandSection : labels.collapseSection;

  button.type = "button";
  button.className = "markra-heading-toggle-button";
  button.contentEditable = "false";
  button.draggable = false;
  button.dataset.collapsed = String(collapsed);
  button.ariaExpanded = String(!collapsed);
  button.ariaLabel = label;
  button.title = label;

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    view.dispatch(
      view.state.tr.setMeta(headingToggleKey, {
        from: getHeadingFrom(),
        type: "toggle"
      } satisfies HeadingToggleMeta)
    );
    view.focus();
  });

  return button;
}

function buildHeadingToggleDecorations(
  doc: ProseNode,
  collapsedPositions: readonly number[],
  heading: NodeType,
  labels: HeadingToggleLabels
) {
  const sections = collectHeadingSections(doc, heading);
  const sectionByHeading = new Map(sections.map((section) => [section.from, section]));
  const collapsed = new Set(collapsedPositions.filter((position) => sectionByHeading.has(position)));
  const decorations: Decoration[] = [];

  for (const section of sections) {
    if (section.contentFrom >= section.to) continue;

    const sectionIsCollapsed = collapsed.has(section.from);
    decorations.push(
      Decoration.node(section.from, section.from + section.node.nodeSize, {
        class: "markra-heading-toggle-heading",
        "data-heading-collapsed": String(sectionIsCollapsed)
      }),
      Decoration.widget(
        section.from + 1,
        (view, getPos) =>
          createHeadingToggleButton(
            view,
            () => {
              const position = getPos();
              return typeof position === "number" ? Math.max(0, position - 1) : section.from;
            },
            sectionIsCollapsed,
            labels
          ),
        {
          ignoreSelection: true,
          key: `markra-heading-toggle-${section.from}-${sectionIsCollapsed ? "collapsed" : "expanded"}`,
          side: -1
        }
      )
    );
  }

  if (collapsed.size === 0) return DecorationSet.create(doc, decorations);

  for (const block of collectTopLevelBlocks(doc)) {
    const hiddenByCollapsedHeading = sections.some(
      (section) => collapsed.has(section.from) && block.from >= section.contentFrom && block.to <= section.to
    );
    if (!hiddenByCollapsedHeading) continue;

    decorations.push(
      Decoration.node(block.from, block.to, {
        class: "markra-heading-collapsed-content"
      })
    );
  }

  return DecorationSet.create(doc, decorations);
}

export function markraHeadingTogglePlugin(labels?: Partial<HeadingToggleLabels>) {
  const resolvedLabels = normalizeHeadingToggleLabels(labels);

  return $prose((ctx) => {
    const heading = headingSchema.type(ctx);

    return new Plugin<CollapsedHeadingState>({
      key: headingToggleKey,
      state: {
        init: () => emptyCollapsedHeadingState,
        apply(transaction, value, _oldState, newState) {
          const meta = transaction.getMeta(headingToggleKey) as HeadingToggleMeta | undefined;
          const mappedCollapsed = transaction.docChanged
            ? mapCollapsedPositions(transaction, newState, heading, value.collapsed)
            : value.collapsed;

          if (meta?.type !== "toggle") {
            return mappedCollapsed === value.collapsed ? value : { collapsed: mappedCollapsed };
          }

          const headingFrom = findHeadingStartAtPosition(newState, heading, meta.from);
          if (headingFrom === null) return { collapsed: mappedCollapsed };

          return {
            collapsed: toggleCollapsedPosition(mappedCollapsed, headingFrom)
          };
        }
      },
      props: {
        decorations: (state) => {
          const pluginState = headingToggleKey.getState(state) ?? emptyCollapsedHeadingState;
          return buildHeadingToggleDecorations(state.doc, pluginState.collapsed, heading, resolvedLabels);
        }
      }
    });
  });
}
