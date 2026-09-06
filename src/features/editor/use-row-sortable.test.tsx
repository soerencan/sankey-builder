// @vitest-environment happy-dom

import { render } from "preact";
import { useRef } from "preact/hooks";
import Sortable from "sortablejs";
import { describe, expect, it, vi } from "vitest";
import { allByRole, byRole } from "../../../tests/helpers/dom-queries";
import { useRowSortable } from "./use-row-sortable";

function Rows({ ids, onMove }: { ids: string[]; onMove: (from: number, to: number) => void }) {
	const ref = useRef<HTMLDivElement>(null);
	useRowSortable(ref, { rowClass: "row", onMove });
	return (
		<div class="rows" ref={ref}>
			{ids.map((id) => (
				<div class="row" key={id}>
					<button type="button" class="drag-handle">
						{id}
					</button>
				</div>
			))}
		</div>
	);
}

// Each row's identity is its drag handle's accessible name (its text, the
// fixture's own row id) — the rows container itself carries no other id, and
// use-row-sortable.ts doesn't need one: it identifies rows by DOM position,
// not by attribute.
function rowIds(rows: HTMLElement): string[] {
	return allByRole<HTMLButtonElement>(rows, "button").map((handle) => handle.textContent ?? "");
}

describe("useRowSortable", () => {
	it("creates exactly one Sortable instance per mounted container and destroys it on unmount", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		render(<Rows ids={["a", "b"]} onMove={() => {}} />, container);

		const rows = container.querySelector<HTMLElement>(".rows");
		if (!rows) throw new Error("unreachable");
		const instance = Sortable.get(rows);
		expect(instance).toBeTruthy();

		// A rerender must not recreate the instance: the effect that creates it
		// is keyed on `rowClass`, a stable literal for the life of this render,
		// so it never re-runs after mount.
		render(<Rows ids={["a", "b"]} onMove={() => {}} />, container);
		expect(Sortable.get(rows)).toBe(instance);

		render(null, container);
		expect(Sortable.get(rows)).toBeNull();
	});

	it("dispatches to the latest onMove after a rerender, not the one captured at mount", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const onMoveA = vi.fn();
		render(<Rows ids={["a", "b"]} onMove={onMoveA} />, container);

		const rows = container.querySelector<HTMLElement>(".rows");
		if (!rows) throw new Error("unreachable");

		// A new onMove closure each render, same as a real caller's inline
		// action-object method — the effect that creates the Sortable instance
		// runs once, but onMoveRef.current must still track this.
		const onMoveB = vi.fn();
		render(<Rows ids={["a", "b"]} onMove={onMoveB} />, container);

		const handle = byRole<HTMLButtonElement>(rows, "button", "a");
		handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		expect(onMoveA).not.toHaveBeenCalled();
		expect(onMoveB).toHaveBeenCalledWith(0, 1);
	});

	/**
	 * The one invariant that's awkward to observe through the full app (see
	 * tests/integration/reorder.test.ts for the end-to-end version of this
	 * scenario, including focus and the final model-order DOM): `onMove`
	 * itself is the dispatch, so reading the DOM synchronously from inside it
	 * proves the restore step ran first, not merely that the final state
	 * happens to look right after everything (including a caller re-render)
	 * has settled.
	 */
	it("restores the pre-drag DOM order before invoking onMove, which already observes that restored order", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		let orderAtDispatch: string[] = [];
		const onMove = vi.fn((_from: number, _to: number) => {
			const rows = container.querySelector<HTMLElement>(".rows");
			if (rows) orderAtDispatch = rowIds(rows);
		});
		render(<Rows ids={["a", "b", "c", "d"]} onMove={onMove} />, container);

		const rows = container.querySelector<HTMLElement>(".rows");
		if (!rows) throw new Error("unreachable");
		const onEnd = Sortable.get(rows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		// Reproduce Sortable's mid-drag DOM edit directly: row "a" (oldIndex 0)
		// dragged down to land at [b, c, a, d], as a real drag would leave it by
		// the time onEnd fires. Built via sequential appendChild (each an atomic
		// move), not a separate remove() + insert.
		for (const id of ["b", "c", "a", "d"]) {
			const row = byRole<HTMLButtonElement>(rows, "button", id).closest(".row");
			if (row) rows.appendChild(row);
		}
		expect(rowIds(rows)).toEqual(["b", "c", "a", "d"]);

		const dragged = byRole<HTMLButtonElement>(rows, "button", "a").closest(".row") as HTMLElement;
		onEnd({ item: dragged, oldIndex: 0, newIndex: 2 } as unknown as Sortable.SortableEvent);

		expect(orderAtDispatch).toEqual(["a", "b", "c", "d"]);
		expect(onMove).toHaveBeenCalledWith(0, 2);
	});

	it("the onEnd no-op guard: a same-index or indexless event neither restores nor dispatches", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const onMove = vi.fn();
		render(<Rows ids={["a", "b"]} onMove={onMove} />, container);

		const rows = container.querySelector<HTMLElement>(".rows");
		if (!rows) throw new Error("unreachable");
		const onEnd = Sortable.get(rows)?.options.onEnd;
		if (!onEnd) throw new Error("unreachable");

		onEnd({ oldIndex: 1, newIndex: 1 } as unknown as Sortable.SortableEvent);
		onEnd({} as unknown as Sortable.SortableEvent);
		onEnd({ oldIndex: 1 } as unknown as Sortable.SortableEvent);
		onEnd({ newIndex: 1 } as unknown as Sortable.SortableEvent);

		expect(onMove).not.toHaveBeenCalled();
		expect(rowIds(rows)).toEqual(["a", "b"]);
	});
});
