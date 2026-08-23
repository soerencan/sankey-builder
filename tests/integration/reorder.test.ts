// @vitest-environment happy-dom

import Sortable from "sortablejs";
import { describe, expect, it } from "vitest";
import { click, fireInput, getStoredState, mountApp, requireElement } from "../helpers/mount-app";

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
		// Default links: n1->n3 (10), n2->n3 (6), n3->n4 (14).
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

	// Pointer/touch dragging is now delegated to SortableJS (src/features/editor/row-reorder.ts),
	// which happy-dom can construct but can't be driven through a realistic
	// pointer/touch gesture (no real layout, no native drag/touch pipeline) —
	// see VERIFICATION.md for what still needs a real browser. These tests
	// instead cover the wiring: a real Sortable instance is attached to each
	// rows container with the intended options, the two boxes can never share
	// a drop target, and invoking the registered onEnd (as Sortable itself
	// would once a real drag completes) commits the same state/DOM/storage
	// change the old pointer-drag tests asserted.
	//
	// features/editor/row-reorder.ts's onEnd handler only reads oldIndex/newIndex off the
	// event, so these synthetic events omit every other SortableEvent field —
	// fakeSortableEvent casts past that rather than constructing a full Event.
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
		const onEnd = Sortable.get(nodeRows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// Sortable has already reordered the DOM by the time onEnd fires for a
		// real drag; the handler itself only needs the before/after indices, so
		// a synthetic event is enough to exercise the commit path in isolation.
		onEnd(fakeSortableEvent({ oldIndex: 0, newIndex: 2 }));

		expect(nodeNames()).toEqual(["Gas", "Electricity", "Coal", "Homes"]);
		const stored = getStoredState();
		expect(stored.nodes.map((n: { id: string }) => n.id)).toEqual(["n2", "n3", "n1", "n4"]);

		// The rebuild the move triggers replaces .node-rows wholesale, so the
		// old container's Sortable instance must not still be registered — the
		// no-leak guarantee attachRowSortable's destroy(previous) provides.
		expect(Sortable.get(nodeRows)).toBeNull();
	});

	it("committing a link row's Sortable onEnd reorders it: order and storage follow", () => {
		mountApp();

		const linkValues = () =>
			Array.from(document.querySelectorAll<HTMLInputElement>("#link-editor .link-value")).map(
				(i) => i.value,
			);
		expect(linkValues()).toEqual(["10", "6", "14"]);

		const linkRows = requireElement<HTMLElement>("#link-editor .link-rows");
		const onEnd = Sortable.get(linkRows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		onEnd(fakeSortableEvent({ oldIndex: 0, newIndex: 1 }));

		expect(linkValues()).toEqual(["6", "10", "14"]);
		const stored = getStoredState();
		expect(stored.links.map((l: { value: number }) => l.value)).toEqual([6, 10, 14]);
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

		// Value edits skip the row rebuild (focus preservation), so the attribute
		// mirror in commitLinkValue must keep later clones truthful too.
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

	it("rebuilding the node editor destroys the previous Sortable instance rather than leaking it", () => {
		mountApp();

		const before = requireElement<HTMLElement>("#node-editor .node-rows");
		expect(Sortable.get(before)).toBeTruthy();

		// add-node rebuilds the node editor (renderNodeEditor replaces
		// .node-rows wholesale), which is the case attachRowSortable's
		// destroy(previous) exists to handle.
		click(document.querySelector('[data-action="add-node"]'));

		expect(Sortable.get(before)).toBeNull();
		const after = requireElement<HTMLElement>("#node-editor .node-rows");
		expect(after).not.toBe(before);
		expect(Sortable.get(after)).toBeTruthy();
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
