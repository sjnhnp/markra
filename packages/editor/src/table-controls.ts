import { $prose } from "@milkdown/kit/utils";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import type { EditorView, ViewMutationRecord } from "@milkdown/kit/prose/view";
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, TableMap } from "prosemirror-tables";

type TableControlLabels = {
  addColumnRight: string;
  addRowBelow: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  deleteColumn: string;
  deleteRow: string;
};

type TableAlignment = "left" | "center" | "right";

const defaultTableControlLabels: TableControlLabels = {
  addColumnRight: "Add column to the right",
  addRowBelow: "Add row below",
  alignLeft: "Align table left",
  alignCenter: "Align table center",
  alignRight: "Align table right",
  deleteColumn: "Delete column",
  deleteRow: "Delete row"
};

const tableAlignments: TableAlignment[] = ["left", "center", "right"];

function controlTargetFromEvent(event: Event) {
  return event.target instanceof Node ? event.target : null;
}

function elementFromEventTarget(target: EventTarget | null) {
  return target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
}

function tableCellFromEventTarget(target: EventTarget | null) {
  return elementFromEventTarget(target)?.closest<HTMLTableCellElement>("th, td") ?? null;
}

function createTableControlButton(
  ownerDocument: Document,
  className: string,
  label: string,
  text: string,
  onMouseDown: (event: MouseEvent) => unknown
) {
  const button = ownerDocument.createElement("button");
  button.type = "button";
  button.className = `markra-table-control ${className}`;
  button.textContent = text;
  button.title = label;
  button.ariaLabel = label;
  button.contentEditable = "false";
  button.draggable = false;
  button.addEventListener("mousedown", onMouseDown);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  return button;
}

function createTableAlignIcon(ownerDocument: Document, alignment: TableAlignment) {
  const icon = ownerDocument.createElement("span");
  icon.className = `markra-table-align-icon markra-table-align-icon-${alignment}`;
  icon.ariaHidden = "true";

  for (let index = 0; index < 3; index += 1) {
    const line = ownerDocument.createElement("span");
    line.className = "markra-table-align-icon-line";
    icon.append(line);
  }

  return icon;
}

class MarkraTableNodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;

  private node: ProseNode;
  private readonly table: HTMLTableElement;
  private readonly alignControls: HTMLElement;
  private readonly alignButtons: HTMLButtonElement[];
  private readonly addColumnButton: HTMLButtonElement;
  private readonly addRowButton: HTMLButtonElement;
  private readonly deleteColumnButton: HTMLButtonElement;
  private readonly deleteRowButton: HTMLButtonElement;
  private hoveredCell: { column: number; row: number } | null = null;

  constructor(
    node: ProseNode,
    private readonly view: EditorView,
    private readonly getPos: (() => number | undefined) | boolean,
    labels: TableControlLabels
  ) {
    this.node = node;
    this.dom = view.dom.ownerDocument.createElement("div");
    this.table = view.dom.ownerDocument.createElement("table");
    this.alignControls = view.dom.ownerDocument.createElement("div");
    this.contentDOM = view.dom.ownerDocument.createElement("tbody");
    this.alignButtons = tableAlignments.map((alignment) => {
      const label =
        alignment === "left" ? labels.alignLeft : alignment === "center" ? labels.alignCenter : labels.alignRight;
      const button = createTableControlButton(
        view.dom.ownerDocument,
        `markra-table-align-button markra-table-align-${alignment}`,
        label,
        "",
        this.handleAlignMouseDown
      );
      button.dataset.alignment = alignment;
      button.append(createTableAlignIcon(view.dom.ownerDocument, alignment));
      return button;
    });
    this.addColumnButton = createTableControlButton(
      view.dom.ownerDocument,
      "markra-table-add-column",
      labels.addColumnRight,
      "+",
      this.handleAddColumnMouseDown
    );
    this.addRowButton = createTableControlButton(
      view.dom.ownerDocument,
      "markra-table-add-row",
      labels.addRowBelow,
      "+",
      this.handleAddRowMouseDown
    );
    this.deleteColumnButton = createTableControlButton(
      view.dom.ownerDocument,
      "markra-table-delete-control markra-table-delete-column",
      labels.deleteColumn,
      "-",
      this.handleDeleteColumnMouseDown
    );
    this.deleteRowButton = createTableControlButton(
      view.dom.ownerDocument,
      "markra-table-delete-control markra-table-delete-row",
      labels.deleteRow,
      "-",
      this.handleDeleteRowMouseDown
    );

    this.dom.className = "tableWrapper markra-table-controls-wrapper";
    this.alignControls.className = "markra-table-align-controls";
    this.deleteColumnButton.hidden = true;
    this.deleteRowButton.hidden = true;
    this.dom.addEventListener("mousemove", this.handleMouseMove);
    this.dom.addEventListener("mouseleave", this.hideDeleteControls);
    this.table.append(this.contentDOM);
    this.alignControls.append(...this.alignButtons);
    this.dom.append(
      this.alignControls,
      this.table,
      this.addColumnButton,
      this.addRowButton,
      this.deleteColumnButton,
      this.deleteRowButton
    );
    this.updateAlignmentButtons();
  }

  update(nextNode: ProseNode) {
    if (nextNode.type !== this.node.type) return false;

    this.node = nextNode;
    this.updateAlignmentButtons();
    return true;
  }

  stopEvent(event: Event) {
    const target = controlTargetFromEvent(event);
    return Boolean(
      target &&
        (this.addColumnButton.contains(target) ||
          this.alignControls.contains(target) ||
          this.addRowButton.contains(target) ||
          this.deleteColumnButton.contains(target) ||
          this.deleteRowButton.contains(target))
    );
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    const target = mutation.target;
    return (
      target instanceof Node &&
      (this.addColumnButton.contains(target) ||
        this.alignControls.contains(target) ||
        this.addRowButton.contains(target) ||
        this.deleteColumnButton.contains(target) ||
        this.deleteRowButton.contains(target))
    );
  }

  destroy() {
    this.dom.removeEventListener("mousemove", this.handleMouseMove);
    this.dom.removeEventListener("mouseleave", this.hideDeleteControls);
    for (const button of this.alignButtons) {
      button.removeEventListener("mousedown", this.handleAlignMouseDown);
    }
    this.addColumnButton.removeEventListener("mousedown", this.handleAddColumnMouseDown);
    this.addRowButton.removeEventListener("mousedown", this.handleAddRowMouseDown);
    this.deleteColumnButton.removeEventListener("mousedown", this.handleDeleteColumnMouseDown);
    this.deleteRowButton.removeEventListener("mousedown", this.handleDeleteRowMouseDown);
  }

  private readonly handleAddColumnMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.insertColumnAfterTable();
  };

  private readonly handleAlignMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
    const alignment = button?.dataset.alignment;
    if (alignment !== "left" && alignment !== "center" && alignment !== "right") return;

    this.alignTable(alignment);
  };

  private readonly handleAddRowMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.insertRowAfterTable();
  };

  private readonly handleDeleteColumnMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.deleteHoveredColumn();
  };

  private readonly handleDeleteRowMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.deleteHoveredRow();
  };

  private readonly handleMouseMove = (event: MouseEvent) => {
    const cell = tableCellFromEventTarget(event.target);
    if (!cell) return;

    this.showDeleteControlsForCell(cell);
  };

  private readonly hideDeleteControls = () => {
    this.hoveredCell = null;
    this.deleteColumnButton.hidden = true;
    this.deleteRowButton.hidden = true;
  };

  private showDeleteControlsForCell(cell: HTMLTableCellElement) {
    const row = cell.parentElement;
    if (!(row instanceof HTMLTableRowElement)) return;

    const canDeleteColumn = row.rowIndex === 0;
    const canDeleteRow = row.rowIndex > 0;
    if (!canDeleteColumn && !canDeleteRow) {
      this.hideDeleteControls();
      return;
    }

    this.hoveredCell = {
      column: cell.cellIndex,
      row: row.rowIndex
    };

    const wrapperRect = this.dom.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    this.deleteColumnButton.hidden = !canDeleteColumn;
    this.deleteRowButton.hidden = !canDeleteRow;
    this.deleteColumnButton.style.left = `${cellRect.left - wrapperRect.left + cellRect.width / 2}px`;
    this.deleteColumnButton.style.top = `${cellRect.top - wrapperRect.top}px`;
    this.deleteRowButton.style.left = `${rowRect.right - wrapperRect.left}px`;
    this.deleteRowButton.style.top = `${rowRect.top - wrapperRect.top + rowRect.height / 2}px`;
  }

  private tablePosition() {
    if (typeof this.getPos !== "function") return false;

    const tablePosition = this.getPos();
    if (typeof tablePosition !== "number") return false;

    return tablePosition;
  }

  private placeCursorInCell(tablePosition: number, row: number, column: number) {
    const map = TableMap.get(this.node);
    if (!map.width || !map.height) return false;

    const cellPosition = tablePosition + 1 + map.positionAt(row, column, this.node);
    const selection = TextSelection.near(this.view.state.doc.resolve(cellPosition + 1), 1);
    this.view.dispatch(this.view.state.tr.setSelection(selection));
    return true;
  }

  private moveTransactionCursorToCell(tr: Transaction, tablePosition: number, row: number, column: number) {
    const table = tr.doc.nodeAt(tablePosition);
    if (!table || table.type !== this.node.type) return tr;

    const map = TableMap.get(table);
    if (row < 0 || row >= map.height || column < 0 || column >= map.width) return tr;

    const cellPosition = tablePosition + 1 + map.positionAt(row, column, table);
    return tr.setSelection(TextSelection.near(tr.doc.resolve(cellPosition + 1), 1));
  }

  private tableAlignment() {
    const map = TableMap.get(this.node);
    const alignments = new Set<TableAlignment>();

    for (let column = 0; column < map.width; column += 1) {
      const cell = this.node.nodeAt(map.positionAt(0, column, this.node));
      const alignment = cell?.attrs.alignment;
      if (alignment === "center" || alignment === "right") {
        alignments.add(alignment);
      } else {
        alignments.add("left");
      }
    }

    return alignments.size === 1 ? [...alignments][0] : null;
  }

  private updateAlignmentButtons() {
    const activeAlignment = this.tableAlignment();

    for (const button of this.alignButtons) {
      button.ariaPressed = String(button.dataset.alignment === activeAlignment);
    }
  }

  private alignTable(alignment: TableAlignment) {
    const tablePosition = this.tablePosition();
    if (tablePosition === false) return;

    const map = TableMap.get(this.node);
    const cellPositions = new Set<number>();

    for (let row = 0; row < map.height; row += 1) {
      for (let column = 0; column < map.width; column += 1) {
        cellPositions.add(tablePosition + 1 + map.positionAt(row, column, this.node));
      }
    }

    const tr = this.view.state.tr;
    for (const cellPosition of cellPositions) {
      const cell = tr.doc.nodeAt(cellPosition);
      if (!cell) continue;

      tr.setNodeMarkup(cellPosition, undefined, {
        ...cell.attrs,
        alignment
      });
    }

    this.view.dispatch(tr.scrollIntoView());
    this.updateAlignmentButtons();
    this.view.focus();
  }

  private insertColumnAfterTable() {
    const tablePosition = this.tablePosition();
    if (tablePosition === false) return;

    const map = TableMap.get(this.node);
    if (!this.placeCursorInCell(tablePosition, 0, map.width - 1)) return;

    addColumnAfter(this.view.state, (tr) =>
      this.view.dispatch(this.moveTransactionCursorToCell(tr.scrollIntoView(), tablePosition, 0, map.width))
    );
    this.view.focus();
  }

  private insertRowAfterTable() {
    const tablePosition = this.tablePosition();
    if (tablePosition === false) return;

    const map = TableMap.get(this.node);
    if (!this.placeCursorInCell(tablePosition, map.height - 1, 0)) return;

    addRowAfter(this.view.state, (tr) =>
      this.view.dispatch(this.moveTransactionCursorToCell(tr.scrollIntoView(), tablePosition, map.height, 0))
    );
    this.view.focus();
  }

  private deleteHoveredColumn() {
    const tablePosition = this.tablePosition();
    if (tablePosition === false || !this.hoveredCell) return;

    const map = TableMap.get(this.node);
    if (map.width <= 1) return;

    const targetRow = Math.min(this.hoveredCell.row, map.height - 1);
    const targetColumn = Math.min(this.hoveredCell.column, map.width - 1);
    if (!this.placeCursorInCell(tablePosition, targetRow, targetColumn)) return;

    deleteColumn(this.view.state, (tr) => {
      const nextColumn = Math.min(targetColumn, map.width - 2);
      this.view.dispatch(this.moveTransactionCursorToCell(tr.scrollIntoView(), tablePosition, targetRow, nextColumn));
    });
    this.hideDeleteControls();
    this.view.focus();
  }

  private deleteHoveredRow() {
    const tablePosition = this.tablePosition();
    if (tablePosition === false || !this.hoveredCell) return;

    const map = TableMap.get(this.node);
    if (map.height <= 1) return;

    const targetRow = Math.min(this.hoveredCell.row, map.height - 1);
    const targetColumn = Math.min(this.hoveredCell.column, map.width - 1);
    if (!this.placeCursorInCell(tablePosition, targetRow, targetColumn)) return;

    deleteRow(this.view.state, (tr) => {
      const nextRow = Math.min(targetRow, map.height - 2);
      this.view.dispatch(this.moveTransactionCursorToCell(tr.scrollIntoView(), tablePosition, nextRow, targetColumn));
    });
    this.hideDeleteControls();
    this.view.focus();
  }
}

export function markraTableControlsPlugin(labels: Partial<TableControlLabels> = {}) {
  const resolvedLabels = {
    ...defaultTableControlLabels,
    ...labels
  };

  return $prose(() => {
    return new Plugin({
      props: {
        nodeViews: {
          table: (node, view, getPos) => new MarkraTableNodeView(node, view, getPos, resolvedLabels)
        }
      }
    });
  });
}
