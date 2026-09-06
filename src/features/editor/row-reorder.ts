import Sortable from "sortablejs";

/**
 * Safely destroys a Sortable instance, including mid-drag orphaned-clone
 * cleanup. Shared by both editors' use-row-sortable.ts hook instances and
 * AppHandle's destroy() indirectly (via unmounting each editor root), so the
 * mid-drag branch below isn't duplicated per caller.
 */
export function destroySortable(instance: Sortable | null): void {
	// The only caller reaching this mid-drag is AppHandle's destroy(): each
	// editor's Sortable instance is mounted once for the component's
	// lifetime, so unmounting it (the sole path to this function) can land
	// on `instance` while it's mid-drag.
	// Sortable's own destroy() calls its internal drop handler with no
	// event, which skips the branch that would otherwise remove the
	// floating fallback clone from <body> — so destroying an active instance
	// mid-drag would otherwise leave that clone stuck on screen (state stays
	// consistent; it's a purely visual orphan). Grab it via the statics
	// *before* destroy() runs, since destroy() also nulls them out.
	if (instance && Sortable.active === instance) {
		Sortable.ghost?.remove();
		Sortable.clone?.remove();
	}
	instance?.destroy();
}

/**
 * Removes any Sortable drag ghost/fallback-clone left in the DOM by whichever
 * instance is mid-drag, without destroying anything. Must run before *any*
 * of an application's Sortable instances are destroy()ed as a group (see
 * AppHandle's destroy() in start-app.tsx): SortableJS's destroy() always
 * clears the shared `Sortable.active`/`ghost`/`clone` statics as a side
 * effect of its internal drop handler, regardless of which instance called
 * it — even one that was never dragging. Destroying an unrelated, idle
 * instance first would silently null those statics before a later
 * destroySortable() call for the actually-active instance gets to check
 * them, leaving its clone stuck on screen.
 */
export function removeActiveDragClone(): void {
	Sortable.ghost?.remove();
	Sortable.clone?.remove();
}
