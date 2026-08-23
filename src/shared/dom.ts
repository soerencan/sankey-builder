/**
 * Realm-safe replacements for `instanceof Element`/`HTMLElement`/
 * `HTMLInputElement`. A delegated listener's `event.target` — or an element
 * looked up on a `Document` booted against a window other than this
 * module's own ambient one (e.g. a second `startApp()` instance mounted
 * into another window) — can be constructed by a different realm's
 * `Element`/`HTMLElement`/`HTMLInputElement`. `instanceof` there compares
 * constructor identity across realms and can wrongly return false. These
 * duck-type instead: `nodeType` is a plain data property (identical across
 * every realm), and `in` walks the object's own prototype chain rather than
 * comparing it against this module's constructor reference.
 */
export function isElement(target: EventTarget | null): target is Element {
	return (target as Node | null)?.nodeType === Node.ELEMENT_NODE;
}

// Note the narrowing gap: SVG/MathML elements have `dataset` too, so they
// pass this guard despite not being HTMLElement — callers must stick to
// APIs shared across those element types (e.g. `.dataset`, `.closest()`).
export function isHTMLElement(target: EventTarget | null): target is HTMLElement {
	return isElement(target) && "dataset" in target;
}

export function isHTMLInputElement(target: EventTarget | null): target is HTMLInputElement {
	return isHTMLElement(target) && target.tagName === "INPUT";
}

export function isHTMLDialogElement(target: EventTarget | null): target is HTMLDialogElement {
	return isHTMLElement(target) && target.tagName === "DIALOG";
}
