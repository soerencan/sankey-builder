export interface RowReorderConfig {
	/** id of the editor box root (e.g. "node-editor"). */
	rootId: string;
	/**
	 * Row element class within the box (e.g. "node-row"). Also used, verbatim,
	 * as the Sortable `group` name for that box's rows container — since the
	 * node and link boxes use different row classes, their Sortable instances
	 * never share a group, which is what keeps a drag from one box being
	 * droppable into the other.
	 */
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
 * Delegated keyboard reordering for a box of editor rows — Arrow Up/Down on
 * a .drag-handle. This is the accessibility path: SortableJS (used for
 * pointer/touch dragging, see attachRowSortable below) has no keyboard
 * support of its own. Lives on the box root, which survives the wholesale
 * rebuilds the editors do, so it only needs setting up once.
 */
export function setupRowReorder(config: RowReorderConfig): void {
	const root = document.getElementById(config.rootId);
	if (!root) return;
	const rowSelector = `.${config.rowClass}`;

	const rowOf = (target: EventTarget | null): HTMLElement | null =>
		target instanceof Element ? target.closest<HTMLElement>(rowSelector) : null;

	const rows = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>(rowSelector));

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

// Touch-only hold before a drag arms (delayOnTouchOnly below) — matches the
// hold-to-lift feel of native mobile list reordering; mouse drags still start
// immediately. Below this many pixels of finger movement *during* that hold,
// Sortable cancels the pending drag rather than starting one, so a scroll
// gesture that starts on a row still scrolls instead of lifting it.
// touchStartThreshold has no effect without a delay (touch or otherwise) —
// SortableJS only consults it from the delayed-drag path.
const TOUCH_HOLD_DELAY_MS = 150;
const TOUCH_START_THRESHOLD_PX = 4;

/**
 * Creates a SortableJS instance for a rows container, for pointer/touch
 * dragging. The editors rebuild their `.node-rows`/`.link-rows` container
 * wholesale on every state change, so this is called once per rebuild
 * (from renderNodeEditor/renderLinkEditor) rather than once at setup like
 * setupRowReorder above — `previous`, if given, is destroy()ed first so a
 * rebuild never leaks an instance still listening on a detached container.
 *
 * `forceFallback` makes Sortable synthesize its own drag (a floating clone
 * that tracks the pointer, `fallbackClass`) instead of native HTML5 DnD,
 * which iOS Safari doesn't support for arbitrary elements anyway and whose
 * ghost rendering is otherwise inconsistent across browsers — this keeps the
 * feel identical on desktop and mobile. `ghostClass` styles the in-list
 * placeholder left behind at the drop target; `chosenClass` styles the
 * source row while it's being dragged.
 *
 * Known gap vs. the old pointer-drag implementation: there's no Escape-to-
 * cancel. forceFallback Sortable has no cancel affordance and no public API
 * to abort an in-progress drag, so this doesn't attempt to reach into its
 * internals to fake one. The manual escape hatch is dropping outside any row
 * (or releasing back at the origin), which leaves order unchanged.
 */
export function attachRowSortable(
	container: HTMLElement,
	config: Pick<RowReorderConfig, "rowClass" | "move">,
	previous: Sortable | null,
): Sortable {
	// A container rebuild (e.g. a keyboard reorder in the other box, or a
	// delete tap from a second finger) can land mid-drag on `previous`.
	// Sortable's own destroy() calls its internal drop handler with no
	// event, which skips the branch that would otherwise remove the
	// floating fallback clone from <body> — so destroying an active instance
	// mid-drag would otherwise leave that clone stuck on screen (state stays
	// consistent; it's a purely visual orphan). Grab it via the statics
	// *before* destroy() runs, since destroy() also nulls them out.
	if (previous && Sortable.active === previous) {
		Sortable.ghost?.remove();
		Sortable.clone?.remove();
	}
	previous?.destroy();
	return new Sortable(container, {
		handle: ".drag-handle",
		group: config.rowClass,
		animation: 150,
		forceFallback: true,
		ghostClass: "row-ghost",
		chosenClass: "row-chosen",
		fallbackClass: "row-fallback",
		delay: TOUCH_HOLD_DELAY_MS,
		delayOnTouchOnly: true,
		touchStartThreshold: TOUCH_START_THRESHOLD_PX,
		onEnd(event) {
			const { oldIndex, newIndex } = event;
			if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
			config.move(oldIndex, newIndex);
		},
	});
}
