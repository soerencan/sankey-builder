export interface RowReorderConfig {
	/** id of the editor box root (e.g. "node-editor"). */
	rootId: string;
	/** Row element class within the box (e.g. "node-row"). */
	rowClass: string;
	/** Applies the reorder to state and rebuilds the box (via main.ts refresh). */
	move(from: number, to: number): void;
	/**
	 * CSS selector for the handle to refocus after a keyboard move, once the box
	 * has rebuilt. `to` is the row's new index. Nodes locate by stable id, links
	 * by the new index, so repeated presses walk the row through the list.
	 */
	refocusSelector(movedHandle: HTMLElement, to: number): string;
}

// Below this, a pointerdown-then-up on a handle is a click/tap, not a drag —
// mirrors the click affordance a <button> handle otherwise implies.
const DRAG_THRESHOLD_PX = 4;

interface Drag {
	pointerId: number;
	handle: HTMLElement;
	row: HTMLElement;
	fromIndex: number;
}

/**
 * Delegated pointer + keyboard reordering for a box of editor rows. Rows are
 * dragged only via their .drag-handle, so text selection and input drags
 * elsewhere in the row are unaffected. All handlers live on the box root and
 * read the live DOM, so they survive the wholesale rebuilds the editors do.
 * State is tracked per-box, so a drag that starts in one box and ends in
 * another is a no-op (no cross-box moves).
 */
export function setupRowReorder(config: RowReorderConfig): void {
	const root = document.getElementById(config.rootId);
	if (!root) return;
	const rowSelector = `.${config.rowClass}`;

	const rowOf = (target: EventTarget | null): HTMLElement | null =>
		target instanceof Element ? target.closest<HTMLElement>(rowSelector) : null;

	const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(rowSelector));

	const clearIndicators = (): void => {
		const marked = root.querySelectorAll(`${rowSelector}.drop-before, ${rowSelector}.drop-after`);
		for (const el of Array.from(marked)) {
			el.classList.remove("drop-before", "drop-after");
		}
	};

	/** True when the pointer is in the lower half of the row (insert after it). */
	const isAfter = (clientY: number, row: HTMLElement): boolean => {
		const rect = row.getBoundingClientRect();
		return clientY > rect.top + rect.height / 2;
	};

	// Row under the pointer, found by hit-testing rather than event.target:
	// once a drag starts, setPointerCapture routes every event to the handle
	// regardless of where the pointer physically is.
	const rowAtPoint = (clientX: number, clientY: number): HTMLElement | null =>
		rowOf(document.elementFromPoint(clientX, clientY));

	// Releasing capture on an already-disconnected handle (the box was rebuilt
	// mid-drag) is a spec-safe no-op, so callers don't need to guard for it.
	const releaseCapture = (d: Drag): void => {
		if (d.handle.hasPointerCapture(d.pointerId)) {
			d.handle.releasePointerCapture(d.pointerId);
		}
		d.row.classList.remove("dragging");
	};

	// Set on pointerdown over a handle, before the threshold is crossed —
	// distinct from `drag` below so a tap/click never starts one.
	let armed: {
		pointerId: number;
		handle: HTMLElement;
		row: HTMLElement;
		startX: number;
		startY: number;
	} | null = null;
	// Promoted from `armed` once the pointer has moved past the threshold.
	let drag: Drag | null = null;

	const cleanup = (): void => {
		clearIndicators();
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
		window.removeEventListener("keydown", onKeyDown);
		document.body.classList.remove("row-dragging");
		armed = null;
		drag = null;
	};

	function onPointerMove(event: PointerEvent): void {
		if (!armed || event.pointerId !== armed.pointerId) return;
		if (!drag) {
			const dx = event.clientX - armed.startX;
			const dy = event.clientY - armed.startY;
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
			const fromIndex = rows().indexOf(armed.row);
			// The row was rebuilt out from under this drag (e.g. a keyboard reorder
			// or a delete from another finger) before it ever started moving.
			if (fromIndex === -1) {
				cleanup();
				return;
			}
			drag = { pointerId: armed.pointerId, handle: armed.handle, row: armed.row, fromIndex };
			armed.handle.setPointerCapture(armed.pointerId);
			drag.row.classList.add("dragging");
			document.body.classList.add("row-dragging");
		}
		const target = rowAtPoint(event.clientX, event.clientY);
		clearIndicators();
		if (target && target !== drag.row) {
			target.classList.add(isAfter(event.clientY, target) ? "drop-after" : "drop-before");
		}
	}

	function onPointerUp(event: PointerEvent): void {
		if (!armed || event.pointerId !== armed.pointerId) return;
		// A rebuild mid-drag (see onPointerMove) can also land between promotion
		// and drop; drag.row/fromIndex are stale against the rebuilt DOM, so skip
		// the commit rather than move whatever now sits at that stale index.
		if (drag?.row.isConnected) {
			const target = rowAtPoint(event.clientX, event.clientY);
			if (target && target !== drag.row) {
				const overIndex = rows().indexOf(target);
				const gap = isAfter(event.clientY, target) ? overIndex + 1 : overIndex;
				const from = drag.fromIndex;
				// Removing `from` first shifts a later gap down by one.
				const to = gap > from ? gap - 1 : gap;
				if (to !== from) config.move(from, to);
			}
		}
		if (drag) releaseCapture(drag);
		cleanup();
	}

	function onPointerCancel(event: PointerEvent): void {
		if (!armed || event.pointerId !== armed.pointerId) return;
		if (drag) releaseCapture(drag);
		cleanup();
	}

	// Parity with native HTML5 DnD, which cancels a drag on Escape.
	function onKeyDown(event: KeyboardEvent): void {
		if (event.key !== "Escape" || !drag) return;
		releaseCapture(drag);
		cleanup();
	}

	root.addEventListener("pointerdown", (event) => {
		// Left mouse button only; touch/pen report button -1 and should proceed.
		if (event.pointerType === "mouse" && event.button !== 0) return;
		// A second pointer going down mid-drag must not hijack the first one's
		// `armed`/`drag` state — the guards below key off pointerId alone, so an
		// overwrite here would let the second pointer's move/up drive a commit
		// using the first pointer's source row.
		if (armed !== null || drag !== null) return;
		const handle =
			event.target instanceof Element ? event.target.closest<HTMLElement>(".drag-handle") : null;
		if (!handle) return;
		const row = rowOf(handle);
		if (!row) return;
		armed = {
			pointerId: event.pointerId,
			handle,
			row,
			startX: event.clientX,
			startY: event.clientY,
		};
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		window.addEventListener("keydown", onKeyDown);
	});

	root.addEventListener("keydown", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement) || !target.classList.contains("drag-handle")) return;
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		const row = rowOf(target);
		if (!row) return;
		event.preventDefault();
		const current = rows();
		const from = current.indexOf(row);
		const to = event.key === "ArrowUp" ? from - 1 : from + 1;
		if (to < 0 || to >= current.length) return;
		const selector = config.refocusSelector(target, to);
		config.move(from, to);
		// Scope to this box: a bare `.drag-handle[data-index="N"]` would match the
		// other editor's handle earlier in the document.
		root.querySelector<HTMLElement>(selector)?.focus();
	});
}
