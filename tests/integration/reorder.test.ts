// @vitest-environment happy-dom

import Sortable from "sortablejs";
import { describe, expect, it, vi } from "vitest";
import {
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
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const handle = requireElement<HTMLButtonElement>('#node-editor .drag-handle[data-id="n1"]');
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		// Coal (n1) moved down one position.
		expect(nodeNames()).toEqual(["Gas", "Coal", "Electricity", "Homes"]);

		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n1", "n3", "n4"]);

		// Link dropdown option order follows the new node order.
		const firstSource = document.querySelector<HTMLSelectElement>("#link-editor .link-source");
		const options = Array.from(firstSource?.querySelectorAll("option.node-option") ?? []).map(
			(o) => o.textContent,
		);
		expect(options).toEqual(["Gas", "Coal", "Electricity", "Homes"]);

		// Focus is back on the moved row's handle, now at index 1.
		const moved = document.querySelector<HTMLButtonElement>(
			'#node-editor .drag-handle[data-id="n1"]',
		);
		expect(document.activeElement).toBe(moved);
		expect(moved?.getAttribute("data-index")).toBe("1");
	});

	it("keyboard-reorders a link row: order, storage, and focus all follow", () => {
		mountApp();

		const linkValues = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#link-editor .link-value")).map(
				(i) => i.value,
			);
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const handle = requireElement<HTMLButtonElement>('#link-editor .drag-handle[data-index="0"]');
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		expect(linkValues()).toEqual(["6", "10", "14"]);

		const stored = getStoredState();
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);

		// Focus lands on the moved link's handle, now at index 1.
		const moved = document.querySelector<HTMLButtonElement>(
			'#link-editor .drag-handle[data-index="1"]',
		);
		expect(document.activeElement).toBe(moved);
	});

	// Pointer/touch dragging is delegated to SortableJS
	// (src/features/editor/use-row-sortable.ts), which happy-dom can construct
	// but can't be driven through a realistic pointer/touch gesture (no real
	// layout, no native drag/touch pipeline) — see VERIFICATION.md for what
	// still needs a real browser. These tests instead cover the wiring: a real
	// Sortable instance is attached to each rows container with the intended
	// options, the two boxes can never share a drop target, and invoking the
	// registered onEnd (as Sortable itself would once a real drag completes)
	// commits the same state/DOM/storage change a keyboard reorder does.
	//
	// use-row-sortable.ts's onEnd handler also reads `item` to restore pre-drag
	// DOM order before dispatching the move, so the no-op-guard tests below
	// that only exercise oldIndex/newIndex omit it; fakeSortableEvent casts
	// past that rather than constructing a full Event.
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
			// touchStartThreshold only does anything alongside a delay (it cancels
			// a *delayed* drag start once the finger wanders too far) — delay is
			// touch-only so mouse dragging still starts immediately.
			expect(instance.options.delay).toBe(150);
			expect(instance.options.delayOnTouchOnly).toBe(true);
			expect(instance.options.touchStartThreshold).toBe(4);
			expect(instance.options.ghostClass).toBe("row-ghost");
			expect(instance.options.chosenClass).toBe("row-chosen");
			expect(instance.options.fallbackClass).toBe("row-fallback");
		}

		// Cross-box inertness: each box's Sortable group is named after its own
		// row class, so the two instances never share a group and a drag can
		// never be dropped from one box into the other. Sortable normalizes the
		// string `group` option it was given into a `{name, ...}` object on the
		// instance — cast (@types/sortablejs still types `group` as the string
		// input, not that runtime shape) to read it back out.
		const groupName = (instance: Sortable) =>
			(instance.options.group as unknown as { name: string }).name;
		expect(groupName(nodeSortable)).toBe("node-row");
		expect(groupName(linkSortable)).toBe("link-row");
		expect(groupName(nodeSortable)).not.toBe(groupName(linkSortable));
	});

	it("committing a node row's Sortable onEnd reorders it: order, dropdowns, and storage all follow", () => {
		mountApp();

		const nodeNames = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const nodeSortable = Sortable.get(nodeRows);
		const onEnd = nodeSortable?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// Sortable has already reordered the DOM by the time onEnd fires for a
		// real drag; this event's indices are what the handler actually acts
		// on, so a synthetic `item` (left in its current, untouched position —
		// the next test below drives the DOM-restore step itself) is enough to
		// exercise the commit path in isolation.
		const item = requireElement<HTMLElement>('.drag-handle[data-id="n1"]', nodeRows).closest(
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

		const rowIds = () =>
			Array.from(nodeRows.querySelectorAll<HTMLButtonElement>(".drag-handle")).map(
				(h) => h.dataset.id,
			);
		expect(rowIds()).toEqual(["n1", "n2", "n3", "n4"]);

		const draggedRow = requireElement<HTMLElement>('.drag-handle[data-id="n1"]', nodeRows).closest(
			".node-row",
		) as HTMLElement;

		// Reproduce the live DOM state Sortable leaves behind mid-drag (it has
		// already moved the row by the time onEnd fires): n1 dragged down to
		// sit just before n4, landing at [n2, n3, n1, n4].
		for (const id of ["n2", "n3", "n1", "n4"]) {
			const row = requireElement<HTMLButtonElement>(
				`.drag-handle[data-id="${id}"]`,
				nodeRows,
			).closest(".node-row");
			if (row) nodeRows.appendChild(row);
		}
		expect(rowIds()).toEqual(["n2", "n3", "n1", "n4"]);

		// Focused once the mid-drag DOM state is established — the handle's
		// focus at the moment onEnd fires (e.g. from the mousedown that started
		// the drag) is what use-row-sortable.ts's onEnd is responsible for
		// carrying through its own restore/dispatch/re-render, not whatever
		// happened to Sortable's own earlier drag-tracking DOM edits.
		draggedRow.querySelector<HTMLButtonElement>(".drag-handle")?.focus();

		// fakeSortableEvent only carries oldIndex/newIndex, and this test needs
		// `item` too, so it builds the event directly.
		onEnd({ item: draggedRow, oldIndex: 0, newIndex: 2 } as unknown as Sortable.SortableEvent);

		// The move (n1 to index 2) landed, but by DOM identity, not just value —
		// same row/container elements throughout, no duplicated or lost rows.
		const rowsAfter = Array.from(nodeRows.querySelectorAll(".node-row"));
		expect(rowsAfter).toHaveLength(4);
		expect(new Set(rowsAfter).size).toBe(rowsAfter.length);
		expect(rowIds()).toEqual(["n2", "n3", "n1", "n4"]);
		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n3", "n1", "n4"]);

		// Preact reused the same keyed row/handle across the re-render, so focus
		// survived the whole restore-then-dispatch-then-reconcile sequence.
		expect(document.activeElement).toBe(
			requireElement<HTMLButtonElement>('.drag-handle[data-id="n1"]', nodeRows),
		);
	});

	it("committing a link row's Sortable onEnd reorders it: order and storage follow", () => {
		mountApp();

		const linkValues = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#link-editor .link-value")).map(
				(i) => i.value,
			);
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const linkSortable = Sortable.get(linkRows);
		const onEnd = linkSortable?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// Sortable has already reordered the DOM by the time onEnd fires for a
		// real drag; this event's indices are what the handler actually acts
		// on, so a synthetic `item` (left in its current, untouched position —
		// the test below drives the DOM-restore step itself) is enough to
		// exercise the commit path in isolation — mirrors the node-row
		// equivalent above.
		const item = requireElement<HTMLElement>('.drag-handle[data-index="0"]', linkRows).closest(
			".link-row",
		) as HTMLElement;
		onEnd({ item, oldIndex: 0, newIndex: 1 } as unknown as Sortable.SortableEvent);

		expect(linkValues()).toEqual(["6", "10", "14"]);
		const stored = getStoredState();
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);
	});

	it("an invalid link-value draft follows its link through a keyboard reorder, not its array position", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		const handle = requireElement<HTMLButtonElement>('#link-editor .drag-handle[data-index="0"]');
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		// Same element, now at row 1: the draft is keyed by link.id, drawn from
		// a monotonic per-instance sequence, not the row's array index.
		const movedValueInput = requireElement<HTMLInputElement>('.link-value[data-index="1"]');
		expect(movedValueInput).toBe(valueInput);
		expect(movedValueInput.value).toBe("abc");
		expect(movedValueInput.getAttribute("aria-invalid")).toBe("true");

		// The link now at row 0 (the one that was displaced) is unaffected.
		const otherValueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		expect(otherValueInput.value).toBe("6");
		expect(otherValueInput.hasAttribute("aria-invalid")).toBe(false);
	});

	it("an invalid link-value draft follows its link through a pointer (Sortable onEnd) reorder", async () => {
		mountApp();

		const valueInput = requireElement<HTMLInputElement>('.link-value[data-index="0"]');
		valueInput.value = "abc";
		fireInput(valueInput);
		await tick();
		expect(valueInput.getAttribute("aria-invalid")).toBe("true");

		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const onEnd = Sortable.get(linkRows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");
		const item = requireElement<HTMLElement>('.drag-handle[data-index="0"]', linkRows).closest(
			".link-row",
		) as HTMLElement;

		onEnd({ item, oldIndex: 0, newIndex: 1 } as unknown as Sortable.SortableEvent);

		const movedValueInput = requireElement<HTMLInputElement>('.link-value[data-index="1"]');
		expect(movedValueInput).toBe(valueInput);
		expect(movedValueInput.value).toBe("abc");
		expect(movedValueInput.getAttribute("aria-invalid")).toBe("true");
	});

	it("a cloned row keeps its select/input values (Sortable's drag ghost is a cloneNode)", () => {
		mountApp();

		// Sortable builds the floating drag ghost via cloneNode, which copies
		// attributes but not live properties — selection/value state must
		// therefore live in attributes or the ghost degrades to placeholders.
		const linkRow = requireElement<HTMLElement>("#link-editor .link-row");
		const nodeRow = requireElement<HTMLElement>("#node-editor .node-row");
		const source = requireElement<HTMLSelectElement>(".link-source", linkRow);
		const target = requireElement<HTMLSelectElement>(".link-target", linkRow);
		const value = requireElement<HTMLInputElement>(".link-value", linkRow);
		expect(source.value).not.toBe("");

		const linkClone = linkRow.cloneNode(true) as HTMLElement;
		expect(linkClone.querySelector<HTMLSelectElement>(".link-source")?.value).toBe(source.value);
		expect(linkClone.querySelector<HTMLSelectElement>(".link-target")?.value).toBe(target.value);
		expect(linkClone.querySelector<HTMLInputElement>(".link-value")?.value).toBe(value.value);

		const nodeClone = nodeRow.cloneNode(true) as HTMLElement;
		expect(nodeClone.querySelector<HTMLInputElement>(".node-name")?.value).toBe(
			nodeRow.querySelector<HTMLInputElement>(".node-name")?.value,
		);

		// A valid edit is a committed action — its refresh() render runs
		// synchronously, so the row's ref-based value-attribute mirror (see
		// link-row.tsx) has already updated by the time this reads the clone.
		value.value = "42";
		fireInput(value);
		const cloneAfterEdit = linkRow.cloneNode(true) as HTMLElement;
		expect(cloneAfterEdit.querySelector<HTMLInputElement>(".link-value")?.value).toBe("42");
	});

	it("the onEnd no-op guard: a same-index or indexless event moves nothing", () => {
		mountApp();

		const nodeNames = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		const nodeRows = requireElement<HTMLElement>("#node-editor .node-rows");
		const instance = Sortable.get(nodeRows);
		const onEnd = instance?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		onEnd(fakeSortableEvent({ oldIndex: 1, newIndex: 1 }));
		onEnd(fakeSortableEvent({}));
		onEnd(fakeSortableEvent({ oldIndex: 1 }));
		onEnd(fakeSortableEvent({ newIndex: 1 }));

		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);
		// Still the same instance on the same container — none of the no-op
		// calls triggered config.move (and therefore no rebuild).
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

		// DataPanel's single root re-renders both editors together on every
		// committed action; neither editor's rows container nor Sortable
		// instance is recreated by that (use-row-sortable.ts's effect is
		// mount-once per rows container).
		click(document.querySelector('[data-action="add-node"]'));
		click(document.querySelector('[data-action="add-link"]'));
		expect(requireElement<HTMLElement>("#node-editor .node-rows")).toBe(nodeRows);
		expect(requireElement<HTMLElement>("#link-editor .link-rows")).toBe(linkRows);
		expect(Sortable.get(nodeRows)).toBe(nodeSortable);
		expect(Sortable.get(linkRows)).toBe(linkSortable);

		// A reorder after those rerenders still lands correctly. (onMoveRef's
		// currency — that a rerender's fresh actions closure, not a stale one
		// captured at an earlier render, is what actually runs — is pinned by
		// use-row-sortable's own unit test, not this integration check: the
		// controller's action objects are identity-stable across rerenders
		// here, so a stale-closure bug wouldn't make this assertion fail.)
		const handle = requireElement<HTMLButtonElement>('#node-editor .drag-handle[data-id="n1"]');
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
		const nodeNames = Array.from(
			document.querySelectorAll<HTMLInputElement>("#node-editor .node-name"),
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
			Array.from(document.querySelectorAll<HTMLInputElement>("#node-editor .node-name")).map(
				(i) => i.value,
			);
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);

		const handle = requireElement<HTMLButtonElement>('#node-editor .drag-handle[data-id="n1"]');
		handle.focus();
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

		// Already at the top: order unchanged and focus stays put.
		expect(nodeNames()).toEqual(["Coal", "Gas", "Electricity", "Homes"]);
		expect(document.activeElement).toBe(handle);
	});
});

// Link add/delete/endpoint-change/reorder invalidate only the link editor —
// none of them touch the node editor's rows or its Sortable instance.
describe("link actions leave the node editor untouched", () => {
	it("add, delete, and endpoint-change link actions never destroy/recreate the node Sortable or its row DOM", () => {
		mountApp();

		const nodeRowsBefore = requireElement<HTMLElement>("#node-editor .node-rows");
		const nodeRowBefore = requireElement<HTMLElement>("#node-editor .node-row");
		const nodeSortableBefore = Sortable.get(nodeRowsBefore);
		if (!nodeSortableBefore) throw new Error("unreachable");
		const destroySpy = vi.spyOn(nodeSortableBefore, "destroy");

		click(document.querySelector('[data-action="add-link"]'));
		click(document.querySelector('.link-delete[data-index="0"]'));
		const source = requireElement<HTMLSelectElement>('.link-source[data-index="0"]');
		source.value = "n2";
		fireChange(source);
		const target = requireElement<HTMLSelectElement>('.link-target[data-index="0"]');
		target.value = "n4";
		fireChange(target);

		expect(destroySpy).not.toHaveBeenCalled();
		expect(requireElement<HTMLElement>("#node-editor .node-rows")).toBe(nodeRowsBefore);
		expect(requireElement<HTMLElement>("#node-editor .node-row")).toBe(nodeRowBefore);
		expect(Sortable.get(nodeRowsBefore)).toBe(nodeSortableBefore);
	});
});
