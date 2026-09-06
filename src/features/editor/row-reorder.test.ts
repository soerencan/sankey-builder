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

	// A real mid-drag gesture isn't reproducible under happy-dom (no layout,
	// no real pointer pipeline), so this sets the real Sortable statics
	// directly rather than mocking Sortable.
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

		// `instance` wasn't the active one, so the unrelated drag's ghost stays.
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
		// Same as another editor root's unmount: nulls the shared statics.
		destroySortable(idleInstance);
		destroySortable(activeInstance);

		expect(document.body.contains(ghost)).toBe(false);
		expect(document.body.contains(clone)).toBe(false);
	});
});
