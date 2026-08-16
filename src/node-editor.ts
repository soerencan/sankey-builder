import type { NodeColorResolver } from "./colors";
import type { Node, State } from "./state";

export interface NodeEditorActions {
	addNode(): void;
	deleteNode(id: string): void;
	renameNode(id: string, name: string): void;
	updateNodeColor(id: string, color: string): void;
}

/** Rebuilds #node-editor from state — same full-rebuild approach as the diagram. */
export function renderNodeEditor(state: State, nodeColor: NodeColorResolver): void {
	const root = d3.select("#node-editor");
	root.html("");
	root.append("h2").attr("id", "node-editor-heading").text("Nodes");

	const manual = state.settings.colorMode === "manual";

	const row = root
		.append("div")
		.attr("class", "node-rows")
		.selectAll<HTMLDivElement, Node>(".node-row")
		.data(state.nodes, (d) => d.id)
		.join("div")
		.attr("class", `node-row${manual ? " manual" : ""}`);

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
		.property("value", (d) => d.name);

	if (manual) {
		row
			.append("input")
			.attr("type", "color")
			.attr("class", "node-color")
			.attr("data-action", "update-node-color")
			.attr("data-id", (d) => d.id)
			.attr("aria-label", (d) => `Color for ${d.name}`)
			.property("value", (d) => d.color ?? nodeColor(d));
	}

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
}

/**
 * Delegated listeners on the editor root — one handler per event type
 * rather than per-row handlers, since rows get rebuilt wholesale.
 */
export function setupNodeEditor(actions: NodeEditorActions): void {
	const root = document.getElementById("node-editor");
	if (!root) return;

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
			event.target.setAttribute("aria-label", `Name for ${event.target.value}`);
			const row = event.target.closest(".node-row");
			const deleteButton = row?.querySelector(".node-delete");
			deleteButton?.setAttribute("aria-label", `Delete ${event.target.value}`);
			const colorInput = row?.querySelector(".node-color");
			colorInput?.setAttribute("aria-label", `Color for ${event.target.value}`);
		} else if (action === "update-node-color" && id !== undefined) {
			actions.updateNodeColor(id, event.target.value);
			// Update this row's swatch directly rather than rebuilding: a color
			// picker fires many 'input' events while dragging, and a rebuild
			// mid-drag would tear down the input the user is actively using.
			const swatch = event.target.closest(".node-row")?.querySelector<HTMLElement>(".node-swatch");
			if (swatch) swatch.style.backgroundColor = event.target.value;
		}
	});
}
