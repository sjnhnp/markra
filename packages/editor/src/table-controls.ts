import { $prose } from "@milkdown/kit/utils";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { Plugin, TextSelection, type Transaction } from "@milkdown/kit/prose/state";
import type { EditorView, ViewMutationRecord } from "@milkdown/kit/prose/view";
import { addColumnAfter, addRowAfter, deleteColumn, deleteRow, TableMap } from "prosemirror-tables";

type TableControlLabels = {
  addColumnRight: string;
  addRowBelow: string;
  deleteColumn: string;
  deleteRow: string;
};

const defaultTableControlLabels: TableControlLabels = {
  addColumnRight: "Add column to the right",
  addRowBelow: "Add row below",
  deleteColumn: "Delete column",
  deleteRow: "Delete row"
};

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

class MarkraTableNodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;

  private node: ProseNode;
  private readonly table: HTMLTableElement;
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
    this.contentDOM = view.dom.ownerDocument.createElement("tbody");
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
    this.deleteColumnButton.hidden = true;
    this.deleteRowButton.hidden = true;
    this.dom.addEventListener("mousemove", this.handleMouseMove);
    this.dom.addEventListener("mouseleave", this.hideDeleteControls);
    this.table.append(this.contentDOM);
    this.dom.append(this.table, this.addColumnButton, this.addRowButton, this.deleteColumnButton, this.deleteRowButton);
  }

  update(nextNode: ProseNode) {
    if (nextNode.type !== this.node.type) return false;

    this.node = nextNode;
    return true;
  }

  stopEvent(event: Event) {
    const target = controlTargetFromEvent(event);
    return Boolean(
      target &&
        (this.addColumnButton.contains(target) ||
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
        this.addRowButton.contains(target) ||
        this.deleteColumnButton.contains(target) ||
        this.deleteRowButton.contains(target))
    );
  }

  destroy() {
    this.dom.removeEventListener("mousemove", this.handleMouseMove);
    this.dom.removeEventListener("mouseleave", this.hideDeleteControls);
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
