// @vitest-environment happy-dom

import Sortable from "sortablejs";
import { describe, expect, it, vi } from "vitest";
import {
	allByRole,
	byRole,
	click,
	fireChange,
	fireInput,
	getStoredState,
	mountApp,
	requireElement,
	tick,
} from "../helpers/mount-app";

describe("row reordering", () => {
	it("keyboard-reorders a node row: order, dropdowns, storage, and focus all follow", () => {
		mountApp();

		const nodeNames = () =>
			allByRole<HTMLInputElement>(
				document.getElementById("node-editor") as HTMLElement,
				"textbox",
			).map((i) => i.value);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder Coal");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		expect(nodeNames()).toEqual(["Gas", "Coal", "Electricity", "Homes"]);

		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n1", "n3", "n4"]);

		// Dropdown option order follows node order.
		const firstSource = byRole<HTMLSelectElement>(document, "combobox", "Source for link 1");
		const options = Array.from(firstSource.querySelectorAll("option.node-option")).map(
			(o) => o.textContent,
		);
		expect(options).toEqual(["Gas", "Coal", "Electricity", "Homes"]);

		const moved = byRole<HTMLButtonElement>(document, "button", "Reorder Coal");
		expect(document.activeElement).toBe(moved);
	});

	it("keyboard-reorders a link row: order, storage, and focus all follow", () => {
		mountApp();

		const linkValues = () =>
			allByRole<HTMLInputElement>(
				document.getElementById("link-editor") as HTMLElement,
				"textbox",
			).map((i) => i.value);
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder link 1");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		expect(linkValues()).toEqual(["6", "10", "14"]);

		const stored = getStoredState();
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);

		const moved = byRole<HTMLButtonElement>(document, "button", "Reorder link 2");
		expect(document.activeElement).toBe(moved);
	});

	// happy-dom can construct SortableJS but can't drive a real drag gesture
	// (no layout, no native pointer pipeline; VERIFICATION.md covers that in
	// a browser), so these tests invoke the registered onEnd directly.
	// Tests that only exercise the oldIndex/newIndex guards omit `item`.
	const fakeSortableEvent = (
		event: Partial<Pick<Sortable.SortableEvent, "oldIndex" | "newIndex">>,
	): Sortable.SortableEvent => event as unknown as Sortable.SortableEvent;

	it("wires a SortableJS instance onto each rows container with the shared drag options", () => {
		mountApp();

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");

		const nodeSortable = Sortable.get(nodeRows);
		const linkSortable = Sortable.get(linkRows);
		if (!nodeSortable || !linkSortable) throw new Error("unreachable");

		for (const instance of [nodeSortable, linkSortable]) {
			expect(instance.options.handle).toBe(".drag-handle");
			expect(instance.options.animation).toBe(150);
			expect(instance.options.forceFallback).toBe(true);
			expect(instance.options.delay).toBe(150);
			expect(instance.options.delayOnTouchOnly).toBe(true);
			expect(instance.options.touchStartThreshold).toBe(4);
			expect(instance.options.ghostClass).toBe("row-ghost");
			expect(instance.options.chosenClass).toBe("row-chosen");
			expect(instance.options.fallbackClass).toBe("row-fallback");
		}

		// Distinct groups mean a drag can never be dropped from one box into
		// the other. Sortable normalizes the string `group` option into a
		// `{name, ...}` object at runtime; @types/sortablejs still types the
		// string input, hence the cast.
		const groupName = (instance: Sortable) =>
			(instance.options.group as unknown as { name: string }).name;
		expect(groupName(nodeSortable)).toBe("node-row");
		expect(groupName(linkSortable)).toBe("link-row");
		expect(groupName(nodeSortable)).not.toBe(groupName(linkSortable));
	});

	it("committing a node row's Sortable onEnd reorders it: order, dropdowns, and storage all follow", () => {
		mountApp();

		const nodeNames = () =>
			allByRole<HTMLInputElement>(
				document.getElementById("node-editor") as HTMLElement,
				"textbox",
			).map((i) => i.value);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const nodeSortable = Sortable.get(nodeRows);
		const onEnd = nodeSortable?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// The handler acts on the indices; `item` is left in place here and the
		// DOM-restore step is driven by the next test.
		const item = byRole<HTMLButtonElement>(nodeRows, "button", "Reorder Coal").closest(
			".node-row",
		) as HTMLElement;
		onEnd({ item, oldIndex: 0, newIndex: 2 } as unknown as Sortable.SortableEvent);

		expect(nodeNames()).toEqual(["Gas", "Electricity", "Coal", "Homes"]);
		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n3", "n1", "n4"]);
	});

	it("onEnd restores the DOM to pre-drag order before dispatching the move, then ends in model order after Preact's re-render, with focus kept on the dragged row's handle", () => {
		mountApp();

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const instance = Sortable.get(nodeRows);
		const onEnd = instance?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		const rowNames = () => allByRole<HTMLInputElement>(nodeRows, "textbox").map((i) => i.value);
		expect(rowNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const coalHandle = byRole<HTMLButtonElement>(nodeRows, "button", "Reorder Coal");
		const draggedRow = coalHandle.closest(".node-row") as HTMLElement;

		// The DOM as Sortable leaves it by the time onEnd fires: Coal dragged
		// down to just before Homes.
		for (const name of ["Gas", "Electricity", "Coal", "Homes"]) {
			const row = byRole<HTMLButtonElement>(nodeRows, "button", `Reorder ${name}`).closest(
				".node-row",
			);
			if (row) nodeRows.appendChild(row);
		}
		expect(rowNames()).toEqual(["Gas", "Electricity", "Coal", "Homes"]);

		// Focus as of the moment onEnd fires (e.g. from the mousedown that
		// started the drag) is what onEnd must carry through.
		coalHandle.focus();

		onEnd({ item: draggedRow, oldIndex: 0, newIndex: 2 } as unknown as Sortable.SortableEvent);

		// By DOM identity: same row elements throughout, none duplicated or lost.
		const rowsAfter = Array.from(nodeRows.querySelectorAll(".node-row"));
		expect(rowsAfter).toHaveLength(4);
		expect(new Set(rowsAfter).size).toBe(rowsAfter.length);
		expect(rowNames()).toEqual(["Gas", "Electricity", "Coal", "Homes"]);
		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n3", "n1", "n4"]);

		expect(document.activeElement).toBe(
			byRole<HTMLButtonElement>(nodeRows, "button", "Reorder Coal"),
		);
	});

	it("committing a link row's Sortable onEnd reorders it: order and storage follow", () => {
		mountApp();

		const linkValues = () =>
			allByRole<HTMLInputElement>(
				document.getElementById("link-editor") as HTMLElement,
				"textbox",
			).map((i) => i.value);
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const linkSortable = Sortable.get(linkRows);
		const onEnd = linkSortable?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// As in the node-row equivalent above: `item` is left in place.
		const item = byRole<HTMLButtonElement>(linkRows, "button", "Reorder link 1").closest(
			".link-row",
		) as HTMLElement;
		onEnd({ item, oldIndex: 0, newIndex: 1 } as unknown as Sortable.SortableEvent);

		expect(linkValues()).toEqual(["6", "10", "14"]);
		const stored = getStoredState();
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);
	});

	it("an invalid link-value draft follows its link through a keyboard reorder, not its array position", async () => {
		mountApp();

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder link 1");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		// Same element, now at row 1: the draft follows the link, not the index.
		const movedValueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 2");
		expect(movedValueInput).toBe(valueInput);
		expect(movedValueInput.value).toBe("abc");
		expect(movedValueInput.getAttribute("aria-invalid")).toBe("true");

		// The link now at row 0 (the one that was displaced) is unaffected.
		const otherValueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		expect(otherValueInput.value).toBe("6");
		expect(otherValueInput.hasAttribute("aria-invalid")).toBe(false);
	});

	it("an invalid link-value draft follows its link through a pointer (Sortable onEnd) reorder", async () => {
		mountApp();

		const valueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 1");
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const onEnd = Sortable.get(linkRows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");
		const item = byRole<HTMLButtonElement>(linkRows, "button", "Reorder link 1").closest(
			".link-row",
		) as HTMLElement;

		onEnd({ item, oldIndex: 0, newIndex: 1 } as unknown as Sortable.SortableEvent);

		const movedValueInput = byRole<HTMLInputElement>(document, "textbox", "Value for link 2");
		expect(movedValueInput).toBe(valueInput);
		expect(movedValueInput.value).toBe("abc");
		expect(movedValueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("a cloned row keeps its select/input values (Sortable's drag ghost is a cloneNode)", () => {
		mountApp();

		// cloneNode copies attributes, not live properties, so selection and
		// value state must be mirrored into attributes or the ghost degrades
		// to placeholders. The row wrappers carry no role, hence class queries.
		const linkRow = requireElement<HTMLElement>("#link-editor .link-row");
		const nodeRow = requireElement<HTMLElement>("#node-editor .node-row");
		const source = byRole<HTMLSelectElement>(linkRow, "combobox", "Source for link 1");
		const target = byRole<HTMLSelectElement>(linkRow, "combobox", "Target for link 1");
		const value = byRole<HTMLInputElement>(linkRow, "textbox", "Value for link 1");
		expect(source.value).not.toBe("");

		const linkClone = linkRow.cloneNode(true) as HTMLElement;
		expect(byRole<HTMLSelectElement>(linkClone, "combobox", "Source for link 1").value).toBe(
			source.value,
		);
		expect(byRole<HTMLSelectElement>(linkClone, "combobox", "Target for link 1").value).toBe(
			target.value,
		);
		expect(byRole<HTMLInputElement>(linkClone, "textbox", "Value for link 1").value).toBe(
			value.value,
		);

		const nodeClone = nodeRow.cloneNode(true) as HTMLElement;
		expect(byRole<HTMLInputElement>(nodeClone, "textbox", "Name for Coal").value).toBe(
			byRole<HTMLInputElement>(nodeRow, "textbox", "Name for Coal").value,
		);

		// A valid edit commits and renders synchronously, so the attribute
		// mirror is already updated when the clone is read.
		value.value = "42";
		fireInput(value);
		const cloneAfterEdit = linkRow.cloneNode(true) as HTMLElement;
		expect(byRole<HTMLInputElement>(cloneAfterEdit, "textbox", "Value for link 1").value).toBe(
			"42",
		);
	});

	it("the onEnd no-op guard: a same-index or indexless event moves nothing", () => {
		mountApp();

		const nodeNames = () =>
			allByRole<HTMLInputElement>(
				document.getElementById("node-editor") as HTMLElement,
				"textbox",
			).map((i) => i.value);
		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const instance = Sortable.get(nodeRows);
		const onEnd = instance?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		onEnd(fakeSortableEvent({ oldIndex: 1, newIndex: 1 }));
		onEnd(fakeSortableEvent({}));
		onEnd(fakeSortableEvent({ oldIndex: 1 }));
		onEnd(fakeSortableEvent({ newIndex: 1 }));

		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);
		expect(Sortable.get(nodeRows)).toBe(instance);
	});

	it("destroying the app tears down the node editor's Sortable instance exactly once", () => {
		const { app } = mountApp();

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const instance = Sortable.get(nodeRows);
		expect(instance).toBeTruthy();
		if (!instance) throw new Error("unreachable");
		const destroySpy = vi.spyOn(instance, "destroy");

		app.destroy();

		expect(destroySpy).toHaveBeenCalledTimes(1);
		expect(Sortable.get(nodeRows)).toBeNull();
	});

	it("destroying the app tears down the link editor's Sortable instance exactly once", () => {
		const { app } = mountApp();

		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const instance = Sortable.get(linkRows);
		expect(instance).toBeTruthy();
		if (!instance) throw new Error("unreachable");
		const destroySpy = vi.spyOn(instance, "destroy");

		app.destroy();

		expect(destroySpy).toHaveBeenCalledTimes(1);
		expect(Sortable.get(linkRows)).toBeNull();
	});

	it("the rows container and Sortable instance of each editor survive a re-render, keep reordering correctly, and are each destroyed exactly once on destroy", () => {
		const { app } = mountApp();

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const nodeSortable = Sortable.get(nodeRows);
		const linkSortable = Sortable.get(linkRows);
		expect(nodeSortable).toBeTruthy();
		expect(linkSortable).toBeTruthy();
		if (!nodeSortable || !linkSortable) throw new Error("unreachable");
		const nodeDestroySpy = vi.spyOn(nodeSortable, "destroy");
		const linkDestroySpy = vi.spyOn(linkSortable, "destroy");

		// Every committed action re-renders both editors; neither rows
		// container nor Sortable instance may be recreated by that.
		click(byRole(document, "button", "Add node"));
		click(byRole(document, "button", "Add link"));
		expect(requireElement<HTMLElement>("#node-editor .node-rows")).toBe(nodeRows);
		expect(requireElement<HTMLElement>("#link-editor .link-rows")).toBe(linkRows);
		expect(Sortable.get(nodeRows)).toBe(nodeSortable);
		expect(Sortable.get(linkRows)).toBe(linkSortable);

		// The controller's action objects are identity-stable, so this can't
		// catch a stale-closure bug; use-row-sortable's unit test pins that.
		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder Coal");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		const nodeNames = allByRole<HTMLInputElement>(
			document.getElementById("node-editor") as HTMLElement,
			"textbox",
		).map((i) => i.value);
		expect(nodeNames[1]).toBe("Coal");

		app.destroy();

		expect(nodeDestroySpy).toHaveBeenCalledTimes(1);
		expect(linkDestroySpy).toHaveBeenCalledTimes(1);
		expect(Sortable.get(nodeRows)).toBeNull();
		expect(Sortable.get(linkRows)).toBeNull();
	});

	it("boundary keyboard move is a no-op (ArrowUp on the first node row)", () => {
		mountApp();

		const nodeNames = () =>
			allByRole<HTMLInputElement>(
				document.getElementById("node-editor") as HTMLElement,
				"textbox",
			).map((i) => i.value);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const handle = byRole<HTMLButtonElement>(document, "button", "Reorder Coal");
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);
		expect(document.activeElement).toBe(handle);
	});
});

describe("link actions leave the node editor untouched", () => {
	it("add, delete, and endpoint-change link actions never destroy/recreate the node Sortable or its row DOM", () => {
		mountApp();

		const nodeRowsBefore = requireElement<HTMLElement>("#node-editor .node-rows");
		const nodeRowBefore = requireElement<HTMLElement>("#node-editor .node-row");
		const nodeSortableBefore = Sortable.get(nodeRowsBefore);
		if (!nodeSortableBefore) throw new Error("unreachable");
		const destroySpy = vi.spyOn(nodeSortableBefore, "destroy");

		click(byRole(document, "button", "Add link"));
		click(byRole(document, "button", "Delete link 1"));
		const source = byRole<HTMLSelectElement>(document, "combobox", "Source for link 1");
		source.value = "n2";
		fireChange(source);
		const target = byRole<HTMLSelectElement>(document, "combobox", "Target for link 1");
		target.value = "n4";
		fireChange(target);

		expect(destroySpy).not.toHaveBeenCalled();
		expect(requireElement<HTMLElement>("#node-editor .node-rows")).toBe(nodeRowsBefore);
		expect(requireElement<HTMLElement>("#node-editor .node-row")).toBe(nodeRowBefore);
		expect(Sortable.get(nodeRowsBefore)).toBe(nodeSortableBefore);
	});
});
