import type { RefObject } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import Sortable from "sortablejs";
import { isHTMLElement } from "../../shared/dom";
import { destroySortable } from "./row-reorder";

export interface UseRowSortableOptions {
	/** Row element class within the rows container (e.g. "node-row"); also used as the Sortable `group` name. */
	rowClass: string;
	onMove(from: number, to: number): void;
}

// Mirrors row-reorder.ts's attachRowSortable exactly — see that module's own
// doc comments for why each option is set the way it is (forceFallback, the
// touch-hold delay/threshold, the ghost/chosen/fallback classes).
const TOUCH_HOLD_DELAY_MS = 150;
const TOUCH_START_THRESHOLD_PX = 4;

/**
 * Owns one SortableJS instance (pointer/touch drag) plus the keyboard
 * ArrowUp/ArrowDown reorder path for a Preact-rendered rows container.
 *
 * Unlike the pre-Preact editors, the rows container is never torn down on a
 * committed move — Preact keeps it and diffs its keyed rows in place across
 * the controller's synchronous re-render — so this effect runs once on mount
 * and cleans up once on unmount (`useLayoutEffect` with an empty dependency
 * array), rather than being recreated on every render the way
 * `attachRowSortable` used to be. `onMove` is read through a ref so a new
 * closure each render never forces that recreation either.
 */
export function useRowSortable(
	containerRef: RefObject<HTMLElement>,
	{ rowClass, onMove }: UseRowSortableOptions,
): void {
	const onMoveRef = useRef(onMove);
	onMoveRef.current = onMove;

	// containerRef is a ref, not reactive state: adding containerRef.current to
	// the dependency array below would break the mount-once guarantee this
	// effect depends on — its value differs between the pre-commit render
	// pass (still null) and every later one, which would recreate the Sortable
	// instance on the very next render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
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
				// A drag can start from a keyboard-focused handle (e.g. Tab, then
				// pointer/touch drag the same row) — captured before the DOM edit
				// below so it can be restored afterward regardless of whether this
				// engine blurs an element on any DOM move of one of its ancestors
				// (some do, even for a single atomic insertBefore/appendChild).
				const activeElement = item.ownerDocument.activeElement;
				const focusedHandle =
					isHTMLElement(activeElement) && item.contains(activeElement) ? activeElement : null;

				// Sortable has already moved `item` in the live DOM by the time onEnd
				// fires. Put it back where Preact last rendered it BEFORE dispatching
				// the move, so the controller's synchronous re-render reconciles its
				// keyed list against the DOM order it previously produced — not
				// against Sortable's own edit, which would otherwise race it.
				//
				// `siblings` excludes `item` to reconstruct that pre-drag order, but
				// the actual DOM edit below is a single insertBefore — which, given a
				// node already in the tree, moves it there atomically — rather than a
				// separate remove() followed by a later insert.
				const siblings = Array.from(container.children).filter((child) => child !== item);
				container.insertBefore(item, siblings[oldIndex] ?? null);
				onMoveRef.current(oldIndex, newIndex);
				focusedHandle?.focus();
			},
		});

		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (!isHTMLElement(target) || !target.classList.contains("drag-handle")) return;
			if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
			const row = target.closest<HTMLElement>(rowSelector);
			if (!row) return;
			event.preventDefault();
			const rows = Array.from(container.querySelectorAll<HTMLElement>(rowSelector));
			const from = rows.indexOf(row);
			const to = event.key === "ArrowUp" ? from - 1 : from + 1;
			if (from < 0 || to < 0 || to >= rows.length) return;
			onMoveRef.current(from, to);
			// onMove's controller path renders synchronously, and Preact reuses
			// this same handle element across the keyed re-render, so it can be
			// refocused immediately rather than deferred to a later effect.
			target.focus();
		};
		container.addEventListener("keydown", onKeyDown);

		return () => {
			container.removeEventListener("keydown", onKeyDown);
			destroySortable(instance);
		};
		// rowClass is a stable literal for the lifetime of one mounted editor —
		// this dependency array is effectively mount-once, not a signal that the
		// effect is meant to react to it changing. See the doc comment above.
	}, [rowClass]);
}
