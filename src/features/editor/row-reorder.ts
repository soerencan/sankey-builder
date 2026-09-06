import Sortable from "sortablejs";

/**
 * Sortable's own destroy(), called mid-drag, skips the branch that removes
 * the floating fallback clone from <body>, leaving it stuck on screen. The
 * statics must be read before destroy() nulls them.
 */
export function destroySortable(instance: Sortable | null): void {
	if (instance && Sortable.active === instance) {
		Sortable.ghost?.remove();
		Sortable.clone?.remove();
	}
	instance?.destroy();
}

/**
 * Must run before several instances are destroyed as a group: destroy() on
 * any instance, even an idle one, clears the shared `Sortable.active`/
 * `ghost`/`clone` statics, so a later destroySortable() for the instance
 * actually mid-drag would no longer find its clone.
 */
export function removeActiveDragClone(): void {
	Sortable.ghost?.remove();
	Sortable.clone?.remove();
}
