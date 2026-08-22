import type { NodeColorResolver } from "./colors";
import { attachRowSortable, setupRowReorder } from "./row-reorder";
import type { Node, State } from "./state";

export interface NodeEditorActions {
	addNode(): void;
	deleteNode(id: string): void;
	renameNode(id: string, name: string): void;
	moveNode(from: number, to: number): void;
}

// Recreated on every renderNodeEditor call (the .node-rows container it's
// attached to is torn down and rebuilt each time) — tracked here so the
// previous instance can be destroy()ed rather than leaked.
let rowSortable: Sortable | null = null;

/** Rebuilds #node-editor from state — same full-rebuild approach as the diagram. */
export function renderNodeEditor(
	state: State,
	nodeColor: NodeColorResolver,
	moveNode: (from: number, to: number) => void,
): void {
	const root = d3.select("#node-editor");
	root.html("");
	root.append("h2").attr("id", "node-editor-heading").text("Nodes");

	const rowsContainer = root.append("div").attr("class", "node-rows");

	const row = rowsContainer
		.selectAll<HTMLDivElement, Node>(".node-row")
		.data(state.nodes, (d) => d.id)
		.join("div")
		.attr("class", "node-row");

	row
		.append("button")
		.attr("type", "button")
		.attr("class", "drag-handle")
		.attr("data-index", (_d, i) => i)
		.attr("data-id", (d) => d.id)
		.attr("aria-label", (d) => `Reorder ${d.name}`)
		.text("⠿");

	row
		.append("span")
		.attr("class", "node-swatch")
		.style("background-color", (d) => nodeColor(d));

	row
		.append("input")
		.attr("type", "text")
		.attr("class", "node-name")
		.attr("data-action", "rename-node")
		.attr("data-id", (d) => d.id)
		.attr("aria-label", (d) => `Name for ${d.name}`)
		// As an attribute so Sortable's cloneNode drag ghost inherits it —
		// clones don't copy the live value property.
		.attr("value", (d) => d.name);

	row
		.append("button")
		.attr("type", "button")
		.attr("class", "node-delete")
		.attr("data-action", "delete-node")
		.attr("data-id", (d) => d.id)
		.attr("aria-label", (d) => `Delete ${d.name}`)
		.text("Delete");

	root
		.append("button")
		.attr("type", "button")
		.attr("class", "add-node")
		.attr("data-action", "add-node")
		.text("Add node");

	const container = rowsContainer.node();
	if (container) {
		rowSortable = attachRowSortable(
			container,
			{ rowClass: "node-row", move: moveNode },
			rowSortable,
		);
	}
}

/**
 * Delegated listeners on the editor root — one handler per event type
 * rather than per-row handlers, since rows get rebuilt wholesale.
 */
export function setupNodeEditor(actions: NodeEditorActions): void {
	const root = document.getElementById("node-editor");
	if (!root) return;

	setupRowReorder({
		rootId: "node-editor",
		rowClass: "node-row",
		move: actions.moveNode,
		// Refocus the same node's handle by its stable id after the rebuild.
		refocusSelector: (handle) => `.drag-handle[data-id="${handle.dataset.id}"]`,
	});

	root.addEventListener("click", (event) => {
		if (!(event.target instanceof HTMLElement)) return;
		const { action, id } = event.target.dataset;
		if (action === "add-node") {
			actions.addNode();
		} else if (action === "delete-node" && id !== undefined) {
			actions.deleteNode(id);
		}
	});

	root.addEventListener("input", (event) => {
		if (!(event.target instanceof HTMLInputElement)) return;
		const { action, id } = event.target.dataset;
		if (action === "rename-node" && id !== undefined) {
			actions.renameNode(id, event.target.value);
			// Keep the row's name-derived aria-labels in sync without touching
			// the input itself, since a full rebuild here would steal focus/caret.
			// The value attribute too: Sortable's cloneNode ghost reads only that.
			event.target.setAttribute("value", event.target.value);
			event.target.setAttribute("aria-label", `Name for ${event.target.value}`);
			const row = event.target.closest(".node-row");
			const deleteButton = row?.querySelector(".node-delete");
			deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
			const handle = row?.querySelector(".drag-handle");
			handle?.setAttribute("aria-label", `Reorder ${event.target.value}`);
		}
	});
}
