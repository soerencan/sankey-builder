// @vitest-environment happy-dom

import Sortable from "sortablejs";
import { beforeEach, describe, expect, it } from "vitest";
import { destroySortable, removeActiveDragClone } from "./row-reorder";

beforeEach(() => {
	document.body.innerHTML = '<div id="rows"></div>';
});

describe("destroySortable", () => {
	it("destroys the instance", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const instance = new Sortable(container, { handle: ".drag-handle" });

		destroySortable(instance);

		expect(Sortable.get(container)).toBeNull();
	});

	it("tolerates null (no instance to tear down)", () => {
		expect(() => destroySortable(null)).not.toThrow();
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
	 * exercising the actual cleanup branch in destroySortable.
	 */
	it("removes an orphaned floating clone when the instance is destroyed mid-drag", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const instance = new Sortable(container, { handle: ".drag-handle" });

		const ghost = document.createElement("div");
		ghost.className = "row-fallback";
		document.body.appendChild(ghost);
		const clone = document.createElement("div");
		clone.className = "row-fallback-clone";
		document.body.appendChild(clone);

		Sortable.active = instance;
		Sortable.ghost = ghost;
		Sortable.clone = clone;

		destroySortable(instance);

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
	});

	it("leaves the floating clone alone when the destroyed instance is not the active drag", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const instance = new Sortable(container, { handle: ".drag-handle" });
		const other = new Sortable(document.createElement("div"), { handle: ".drag-handle" });

		const ghost = document.createElement("div");
		document.body.appendChild(ghost);
		Sortable.active = other;
		Sortable.ghost = ghost;

		destroySortable(instance);

		// `instance` wasn't the active instance, so its destroy() is a normal,
		// non-mid-drag teardown — the unrelated active drag's ghost is untouched.
		expect(document.body.contains(ghost)).toBe(true);
	});
});

describe("removeActiveDragClone", () => {
	it("removes the active drag's ghost/clone without destroying any instance", () => {
		const container = document.getElementById("rows") as HTMLElement;
		const instance = new Sortable(container, { handle: ".drag-handle" });

		const ghost = document.createElement("div");
		document.body.appendChild(ghost);
		const clone = document.createElement("div");
		document.body.appendChild(clone);
		Sortable.active = instance;
		Sortable.ghost = ghost;
		Sortable.clone = clone;

		removeActiveDragClone();

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
		// Only the DOM clone/ghost are cleaned up — the instance itself (and
		// the statics pointing at it) are left for the caller's own teardown.
		expect(Sortable.get(container)).toBe(instance);
	});

	it("tolerates no active drag", () => {
		expect(() => removeActiveDragClone()).not.toThrow();
	});

	/**
	 * The scenario removeActiveDragClone exists for: destroying an unrelated,
	 * idle Sortable instance first would otherwise null the shared
	 * Sortable.active/ghost/clone statics (see its own doc comment) before a
	 * later destroySortable() call for the actually-active instance can find
	 * them — this proves calling it first avoids exactly that.
	 */
	it("lets a later destroySortable() no-op safely once its own ghost/clone were already removed", () => {
		const activeContainer = document.getElementById("rows") as HTMLElement;
		const activeInstance = new Sortable(activeContainer, { handle: ".drag-handle" });
		const idleInstance = new Sortable(document.createElement("div"), { handle: ".drag-handle" });

		const ghost = document.createElement("div");
		document.body.appendChild(ghost);
		const clone = document.createElement("div");
		document.body.appendChild(clone);
		Sortable.active = activeInstance;
		Sortable.ghost = ghost;
		Sortable.clone = clone;

		removeActiveDragClone();
		// An unrelated instance's own teardown, same as another editor root's
		// unmount — SortableJS's destroy() nulls the shared statics regardless
		// of which instance called it, which is exactly the hazard
		// removeActiveDragClone must run ahead of.
		destroySortable(idleInstance);
		destroySortable(activeInstance);

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
	});
});
