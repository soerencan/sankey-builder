// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { attachRowSortable } from "../src/row-reorder";
import { loadSortableGlobal } from "./helpers/sortable-global";

beforeAll(() => {
	loadSortableGlobal();
});

beforeEach(() => {
	document.body.innerHTML = '<div id="rows"></div>';
});

describe("attachRowSortable", () => {
	it("destroys the previous instance and attaches a fresh one with the shared options", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const move = vi.fn();

		const first = attachRowSortable(container, { rowClass: "node-row", move }, null);
		expect(Sortable.get(container)).toBe(first);

		const second = attachRowSortable(container, { rowClass: "node-row", move }, first);
		expect(second).not.toBe(first);
		expect(Sortable.get(container)).toBe(second);
	});

	/**
	 * Sortable's own destroy() calls its internal drop handler with no event,
	 * which — per the vendored source — skips the branch that removes the
	 * floating fallback clone from <body>, even though it still resets the
	 * Sortable.active/ghost/clone statics to null. Reproducing that mid-drag
	 * precondition through a real pointer/touch gesture isn't practical under
	 * happy-dom (no real layout, and SortableJS's fallback drag start depends
	 * on a genuine pointer-event pipeline it doesn't provide) — so this drives
	 * the real Sortable statics directly rather than mocking Sortable itself,
	 * exercising the actual cleanup branch in attachRowSortable.
	 */
	it("removes an orphaned floating clone when the previous instance is destroyed mid-drag", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const move = vi.fn();
		const previous = attachRowSortable(container, { rowClass: "node-row", move }, null);

		const ghost = document.createElement("div");
		ghost.className = "row-fallback";
		document.body.appendChild(ghost);
		const clone = document.createElement("div");
		clone.className = "row-fallback-clone";
		document.body.appendChild(clone);

		Sortable.active = previous;
		Sortable.ghost = ghost;
		Sortable.clone = clone;

		const nextContainer = document.createElement("div");
		document.body.appendChild(nextContainer);
		attachRowSortable(nextContainer, { rowClass: "node-row", move }, previous);

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
	});

	it("leaves the floating clone alone when the previous instance is not the active drag", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const move = vi.fn();
		const previous = attachRowSortable(container, { rowClass: "node-row", move }, null);
		const other = attachRowSortable(
			document.createElement("div"),
			{ rowClass: "link-row", move },
			null,
		);

		const ghost = document.createElement("div");
		document.body.appendChild(ghost);
		Sortable.active = other;
		Sortable.ghost = ghost;

		const nextContainer = document.createElement("div");
		document.body.appendChild(nextContainer);
		attachRowSortable(nextContainer, { rowClass: "node-row", move }, previous);

		// `previous` wasn't the active instance, so its destroy() is a normal,
		// non-mid-drag teardown — the unrelated active drag's ghost is untouched.
		expect(document.body.contains(ghost)).toBe(true);
	});
});
