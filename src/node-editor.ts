import type { NodeColorResolver } from "./colors";
import { attachRowSortable, setupRowReorder } from "./row-reorder";
import type { Node, State } from "./state";

export interface NodeEditorActions {
	addNode(): void;
	deleteNode(id: string): void;
	renameNode(id: string, name: string): void;
	moveNode(from: number, to: number): void;
}

/**
 * Rebuilds #node-editor from state — same full-rebuild approach as the
 * diagram. The `.node-rows` container is torn down and rebuilt on every
 * call, so its Sortable instance is recreated each time too — the caller
 * (src/app.ts) owns `previousSortable`/the returned replacement rather than
 * this module holding a module-level singleton, so a second app instance on
 * the same document never shares Sortable state with the first.
 */
export function renderNodeEditor(
	doc: Document,
	state: State,
	nodeColor: NodeColorResolver,
	moveNode: (from: number, to: number) => void,
	previousSortable: Sortable | null,
): Sortable | null {
	const root = d3.select(doc.getElementById("node-editor"));
	root.html("");
	root.append("h3").attr("id", "node-editor-heading").text("Nodes");

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
	if (!container) return previousSortable;
	return attachRowSortable(container, { rowClass: "node-row", move: moveNode }, previousSortable);
}

/**
 * Delegated listeners on the editor root — one handler per event type
 * rather than per-row handlers, since rows get rebuilt wholesale. `signal`
 * is the owning app instance's AbortSignal — AppHandle.destroy() aborting it
 * tears these listeners down.
 */
export function setupNodeEditor(
	doc: Document,
	actions: NodeEditorActions,
	signal: AbortSignal,
): void {
	const root = doc.getElementById("node-editor");
	if (!root) return;

	setupRowReorder(
		doc,
		{
			rootId: "node-editor",
			rowClass: "node-row",
			move: actions.moveNode,
			// Refocus the same node's handle by its stable id after the rebuild.
			refocusSelector: (handle) => `.drag-handle[data-id="${handle.dataset.id}"]`,
		},
		signal,
	);

	root.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof HTMLElement)) return;
			const { action, id } = event.target.dataset;
			if (action === "add-node") {
				actions.addNode();
			} else if (action === "delete-node" && id !== undefined) {
				actions.deleteNode(id);
			}
		},
		{ signal },
	);

	root.addEventListener(
		"input",
		(event) => {
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
		},
		{ signal },
	);
}
