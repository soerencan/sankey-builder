// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import type { NodeView } from "../../app/view";
import type { NodeEditorActions } from "./node-editor";
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
	it("renders the heading plus one row per node with the expected structure and data attributes", () => {
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
			const handle = row.querySelector<HTMLButtonElement>(".drag-handle");
			expect(handle?.dataset.index).toBe(String(i));
			expect(handle?.dataset.id).toBe(node.id);
			expect(handle?.getAttribute("aria-label")).toBe(`Reorder ${node.name}`);

			const swatch = row.querySelector<HTMLElement>(".node-swatch");
			expect(swatch?.style.backgroundColor).toBe(node.swatchColor);

			const nameInput = row.querySelector<HTMLInputElement>(".node-name");
			expect(nameInput?.value).toBe(node.name);
			// Mirrored as an attribute too — Sortable's cloneNode drag ghost
			// copies attributes only, not the live `value` property.
			expect(nameInput?.getAttribute("value")).toBe(node.name);
			expect(nameInput?.dataset.id).toBe(node.id);
			expect(nameInput?.getAttribute("aria-label")).toBe(`Name for ${node.name}`);

			const deleteButton = row.querySelector<HTMLButtonElement>(".node-delete");
			expect(deleteButton?.dataset.id).toBe(node.id);
			expect(deleteButton?.getAttribute("aria-label")).toBe(`Delete ${node.name}`);
		});

		expect(container.querySelector('[data-action="add-node"]')?.textContent).toBe("Add node");
	});

	it("wires add/rename/delete interactions to the given actions", () => {
		const nodes: NodeView[] = [{ id: "n1", name: "Coal", swatchColor: "#111111" }];
		const actions = noopActions();
		const container = mount(nodes, actions);

		container.querySelector<HTMLButtonElement>('[data-action="add-node"]')?.click();
		expect(actions.addNode).toHaveBeenCalledTimes(1);

		const nameInput = container.querySelector<HTMLInputElement>(".node-name");
		if (!nameInput) throw new Error("unreachable");
		nameInput.value = "Lignite";
		nameInput.dispatchEvent(new Event("input", { bubbles: true }));
		expect(actions.renameNode).toHaveBeenCalledWith("n1", "Lignite");

		container.querySelector<HTMLButtonElement>('[data-action="delete-node"]')?.click();
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
