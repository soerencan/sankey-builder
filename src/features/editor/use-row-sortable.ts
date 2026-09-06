import type { RefObject } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import Sortable from "sortablejs";
import { destroySortable } from "./row-reorder";

export interface UseRowSortableOptions {
	/** Also the Sortable `group` name. */
	rowClass: string;
	onMove(from: number, to: number): void;
}

// Hold-to-lift on touch, so a scroll gesture that starts on a row still
// scrolls. touchStartThreshold only takes effect together with a delay:
// SortableJS consults it from the delayed-drag path alone.
const TOUCH_HOLD_DELAY_MS = 150;
const TOUCH_START_THRESHOLD_PX = 4;

/**
 * The effect must run once per mount: Preact keeps the rows container and
 * diffs its keyed rows in place, so recreating the Sortable instance on
 * every render would be wasted work and would drop a drag in progress.
 * `onMove` is read through a ref so a new closure each render doesn't force
 * that either.
 */
export function useRowSortable(
	containerRef: RefObject<HTMLElement>,
	{ rowClass, onMove }: UseRowSortableOptions,
): void {
	const onMoveRef = useRef(onMove);
	onMoveRef.current = onMove;

	// biome-ignore lint/correctness/useExhaustiveDependencies: containerRef.current is null during the first render pass and set afterwards; depending on it would recreate the Sortable instance on the very next render.
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const rowSelector = `.${rowClass}`;

		const instance = new Sortable(container, {
			handle: ".drag-handle",
			group: rowClass,
			animation: 150,
			forceFallback: true,
			ghostClass: "row-ghost",
			chosenClass: "row-chosen",
			fallbackClass: "row-fallback",
			delay: TOUCH_HOLD_DELAY_MS,
			delayOnTouchOnly: true,
			touchStartThreshold: TOUCH_START_THRESHOLD_PX,
			onEnd(event) {
				const { item, oldIndex, newIndex } = event;
				if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
				// Some engines blur an element when an ancestor is moved in the
				// DOM, so a focused handle is captured before the edit below.
				const activeElement = item.ownerDocument.activeElement;
				const focusedHandle =
					activeElement instanceof HTMLElement && item.contains(activeElement)
						? activeElement
						: null;

				// Sortable has already moved `item` in the DOM. Put it back where
				// Preact last rendered it before dispatching, so the synchronous
				// re-render reconciles against the order it produced, not Sortable's.
				const siblings = Array.from(container.children).filter((child) => child !== item);
				container.insertBefore(item, siblings[oldIndex] ?? null);
				onMoveRef.current(oldIndex, newIndex);
				focusedHandle?.focus();
			},
		});

		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (!(target instanceof HTMLElement) || !target.classList.contains("drag-handle")) return;
			if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
			const row = target.closest<HTMLElement>(rowSelector);
			if (!row) return;
			event.preventDefault();
			const rows = Array.from(container.querySelectorAll<HTMLElement>(rowSelector));
			const from = rows.indexOf(row);
			const to = event.key === "ArrowUp" ? from - 1 : from + 1;
			if (from < 0 || to < 0 || to >= rows.length) return;
			onMoveRef.current(from, to);
			// The re-render is synchronous and keyed, so this is still the same
			// handle element.
			target.focus();
		};
		container.addEventListener("keydown", onKeyDown);

		return () => {
			container.removeEventListener("keydown", onKeyDown);
			destroySortable(instance);
		};
	}, [rowClass]);
}
