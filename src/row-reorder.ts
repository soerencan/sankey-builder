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

/**
 * Delegated drag-and-drop + keyboard reordering for a box of editor rows.
 * Rows are draggable only while the pointer is down on their .drag-handle, so
 * text selection and input drags elsewhere in the row are unaffected. All
 * handlers live on the box root and read the live DOM, so they survive the
 * wholesale rebuilds the editors do. State is tracked per-box, so a drag that
 * starts in one box and ends in another is a no-op (no cross-box moves).
 */
export function setupRowReorder(config: RowReorderConfig): void {
	const root = document.getElementById(config.rootId);
	if (!root) return;
	const rowSelector = `.${config.rowClass}`;

	// Set only by this box's own dragstart — null means "no drag from here", so
	// a drop bubbling up from a foreign drag is ignored.
	let draggingIndex: number | null = null;

	const rowOf = (target: EventTarget | null): HTMLElement | null =>
		target instanceof Element ? target.closest<HTMLElement>(rowSelector) : null;

	const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(rowSelector));

	const clearIndicators = (): void => {
		const marked = root.querySelectorAll(`${rowSelector}.drop-before, ${rowSelector}.drop-after`);
		for (const el of Array.from(marked)) {
			el.classList.remove("drop-before", "drop-after");
		}
	};

	const disableDrag = (): void => {
		const draggable = root.querySelectorAll<HTMLElement>(`${rowSelector}[draggable="true"]`);
		for (const el of Array.from(draggable)) {
			el.draggable = false;
		}
	};

	// Enable dragging only while the primary button is held on a handle.
	root.addEventListener("mousedown", (event) => {
		if (event.button !== 0) return;
		const target = event.target;
		if (!(target instanceof Element) || !target.closest(".drag-handle")) return;
		const row = rowOf(target);
		if (row) row.draggable = true;
	});
	// Disarm on window, not root: a right-click context menu or a mouseup
	// outside the box would otherwise leave the row stuck draggable, so a later
	// drag-select in its name input would start a row drag instead.
	window.addEventListener("mouseup", disableDrag);

	root.addEventListener("dragstart", (event) => {
		const row = rowOf(event.target);
		if (!row?.draggable) return;
		draggingIndex = rows().indexOf(row);
		row.classList.add("dragging");
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = "move";
			// Firefox won't start a drag unless some data is set.
			event.dataTransfer.setData("text/plain", String(draggingIndex));
		}
	});

	root.addEventListener("dragover", (event) => {
		if (draggingIndex === null) return;
		const row = rowOf(event.target);
		if (!row) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		clearIndicators();
		row.classList.add(isAfter(event, row) ? "drop-after" : "drop-before");
	});

	root.addEventListener("dragleave", (event) => {
		rowOf(event.target)?.classList.remove("drop-before", "drop-after");
	});

	root.addEventListener("drop", (event) => {
		if (draggingIndex === null) return;
		const row = rowOf(event.target);
		if (!row) return;
		event.preventDefault();
		const overIndex = rows().indexOf(row);
		const gap = isAfter(event, row) ? overIndex + 1 : overIndex;
		const from = draggingIndex;
		// Removing `from` first shifts a later gap down by one.
		const to = gap > from ? gap - 1 : gap;
		clearIndicators();
		draggingIndex = null;
		config.move(from, to);
	});

	root.addEventListener("dragend", () => {
		clearIndicators();
		disableDrag();
		for (const el of Array.from(root.querySelectorAll(`${rowSelector}.dragging`))) {
			el.classList.remove("dragging");
		}
		draggingIndex = null;
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

/** True when the pointer is in the lower half of the row (insert after it). */
function isAfter(event: DragEvent, row: HTMLElement): boolean {
	const rect = row.getBoundingClientRect();
	return event.clientY > rect.top + rect.height / 2;
}
