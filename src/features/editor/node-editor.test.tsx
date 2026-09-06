// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { byRole } from "../../../tests/helpers/dom-queries";
import type { NodeEditorActions, NodeView } from "./node-editor";
import { NodeEditor } from "./node-editor";

function mount(nodes: NodeView[], actions: NodeEditorActions) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	render(<NodeEditor nodes={nodes} actions={actions} />, container);
	return container;
}

function noopActions(): NodeEditorActions {
	return { addNode: vi.fn(), deleteNode: vi.fn(), renameNode: vi.fn(), moveNode: vi.fn() };
}

describe("NodeEditor", () => {
	it("renders the heading plus one row per node with the expected structure and accessible names", () => {
		const nodes: NodeView[] = [
			{ id: "n1", name: "Coal", swatchColor: "#111111" },
			{ id: "n2", name: "Gas", swatchColor: "#222222" },
		];
		const container = mount(nodes, noopActions());

		expect(container.querySelector("#node-editor-heading")?.textContent).toBe("Nodes");
		expect(container.querySelector(".node-rows")).not.toBeNull();

		const rows = Array.from(container.querySelectorAll(".node-row"));
		expect(rows).toHaveLength(2);

		rows.forEach((row, i) => {
			const node = nodes[i];
			byRole(row, "button", `Reorder ${node.name}`);

			const swatch = row.querySelector<HTMLElement>(".node-swatch");
			expect(swatch?.style.backgroundColor).toBe(node.swatchColor);

			const nameInput = byRole<HTMLInputElement>(row, "textbox", `Name for ${node.name}`);
			expect(nameInput.value).toBe(node.name);
			// The attribute mirror feeds Sortable's cloneNode drag ghost.
			expect(nameInput.getAttribute("value")).toBe(node.name);

			byRole(row, "button", `Delete ${node.name}`);
		});

		expect(byRole(container, "button", "Add node").textContent).toBe("Add node");
	});

	it("wires add/rename/delete interactions to the given actions", () => {
		const nodes: NodeView[] = [{ id: "n1", name: "Coal", swatchColor: "#111111" }];
		const actions = noopActions();
		const container = mount(nodes, actions);

		byRole<HTMLButtonElement>(container, "button", "Add node").click();
		expect(actions.addNode).toHaveBeenCalledTimes(1);

		const nameInput = byRole<HTMLInputElement>(container, "textbox", "Name for Coal");
		nameInput.value = "Lignite";
		nameInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(actions.renameNode).toHaveBeenCalledWith("n1", "Lignite");

		byRole<HTMLButtonElement>(container, "button", "Delete Coal").click();
		expect(actions.deleteNode).toHaveBeenCalledWith("n1");
	});

	it("re-renders in place on a prop change, keeping the same row/container DOM nodes (keyed by node id)", () => {
		const nodes: NodeView[] = [{ id: "n1", name: "Coal", swatchColor: "#111111" }];
		const container = mount(nodes, noopActions());

		const rowsBefore = container.querySelector(".node-rows");
		const rowBefore = container.querySelector(".node-row");

		render(
			<NodeEditor
				nodes={[{ id: "n1", name: "Lignite", swatchColor: "#333333" }]}
				actions={noopActions()}
			/>,
			container,
		);

		expect(container.querySelector(".node-rows")).toBe(rowsBefore);
		expect(container.querySelector(".node-row")).toBe(rowBefore);
		expect(container.querySelector<HTMLInputElement>(".node-name")?.value).toBe("Lignite");
	});
});
