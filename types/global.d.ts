declare const d3: typeof import("d3") & typeof import("d3-sankey");

/**
 * Minimal ambient declaration for the vendored SortableJS UMD global
 * (vendor/sortable.min.js) — covers only the constructor/options/instance
 * surface app.js (and its tests) actually use, not the library's full API.
 * `options.group` is typed as the plain string app.js passes in; at runtime
 * Sortable normalizes it into `{name, pull, put}` on the instance, which
 * tests introspect via an explicit cast rather than widening this type.
 */
declare class Sortable {
	constructor(el: HTMLElement, options?: Sortable.Options);
	options: Sortable.Options;
	destroy(): void;
}

declare namespace Sortable {
	/**
	 * Instance bound to `el` by a prior `new Sortable(el, ...)`. `undefined`
	 * when `el` was never bound; `null` once a bound instance's `destroy()`
	 * has run (it nulls out the element's binding rather than deleting it).
	 */
	function get(el: HTMLElement): Sortable | null | undefined;

	/**
	 * The instance currently mid-drag, or `null`/`undefined` when nothing is
	 * dragging (`undefined` before the first drag anywhere on the page;
	 * `null` once any drag has completed).
	 */
	let active: Sortable | null | undefined;
	/** The floating clone tracking the pointer in `forceFallback` mode, if a drag is active. */
	let ghost: HTMLElement | null | undefined;
	/** The clone element used when a group's `pull` mode is `"clone"`, if a drag is active. */
	let clone: HTMLElement | null | undefined;

	interface SortableEvent {
		oldIndex?: number;
		newIndex?: number;
	}

	interface Options {
		handle?: string;
		group?: string;
		animation?: number;
		forceFallback?: boolean;
		ghostClass?: string;
		chosenClass?: string;
		fallbackClass?: string;
		delay?: number;
		delayOnTouchOnly?: boolean;
		touchStartThreshold?: number;
		onEnd?(event: SortableEvent): void;
	}
}
