const EDITOR_COLUMN_MIN_WIDTH = 240;
const EDITOR_COLUMN_MAX_WIDTH = 640;
const EDITOR_COLUMN_ARROW_STEP = 16;

/**
 * Drives the editor column's width from the divider between it and the
 * diagram — pure UI chrome (not app state), so it manipulates the DOM
 * directly rather than routing through validateAndRender()/state. Width
 * isn't persisted; it resets to the CSS default (320px) on reload.
 */
export function setupResizer(): void {
	const dividerEl = document.getElementById("resizer");
	const editorColumnEl = document.querySelector<HTMLElement>(".editor-column");
	if (!dividerEl || !editorColumnEl) return;
	// Narrowed locals: nested function declarations below don't retain the
	// null-check narrowing on the outer `const`s, so capture the non-null
	// types once here rather than re-asserting at every use site.
	const divider = dividerEl;
	const editorColumn = editorColumnEl;

	function clamp(width: number): number {
		return Math.min(EDITOR_COLUMN_MAX_WIDTH, Math.max(EDITOR_COLUMN_MIN_WIDTH, width));
	}

	function setWidth(width: number): void {
		const clamped = clamp(width);
		editorColumn.style.width = `${clamped}px`;
		divider.setAttribute("aria-valuenow", String(Math.round(clamped)));
	}

	divider.setAttribute("aria-valuemin", String(EDITOR_COLUMN_MIN_WIDTH));
	divider.setAttribute("aria-valuemax", String(EDITOR_COLUMN_MAX_WIDTH));
	divider.setAttribute(
		"aria-valuenow",
		String(Math.round(editorColumn.getBoundingClientRect().width)),
	);

	let startX = 0;
	let startWidth = 0;

	function onPointerMove(event: PointerEvent): void {
		setWidth(startWidth + (event.clientX - startX));
	}

	function onPointerUp(event: PointerEvent): void {
		divider.releasePointerCapture(event.pointerId);
		divider.removeEventListener("pointermove", onPointerMove);
		divider.removeEventListener("pointerup", onPointerUp);
		divider.removeEventListener("pointercancel", onPointerUp);
		divider.classList.remove("is-dragging");
		document.body.classList.remove("resizing");
	}

	divider.addEventListener("pointerdown", (event) => {
		// Left mouse button only; touch/pen report button -1 and should proceed.
		if (event.pointerType === "mouse" && event.button !== 0) return;
		// preventDefault() below (to stop text selection while dragging) also
		// suppresses the browser's default focus-on-pointerdown behavior — focus
		// explicitly so the arrow-key path still works right after a drag.
		divider.focus();
		startX = event.clientX;
		startWidth = editorColumn.getBoundingClientRect().width;
		divider.setPointerCapture(event.pointerId);
		divider.classList.add("is-dragging");
		document.body.classList.add("resizing");
		divider.addEventListener("pointermove", onPointerMove);
		divider.addEventListener("pointerup", onPointerUp);
		divider.addEventListener("pointercancel", onPointerUp);
		event.preventDefault();
	});

	divider.addEventListener("keydown", (event) => {
		const current = editorColumn.getBoundingClientRect().width;
		if (event.key === "ArrowLeft") {
			setWidth(current - EDITOR_COLUMN_ARROW_STEP);
			event.preventDefault();
		} else if (event.key === "ArrowRight") {
			setWidth(current + EDITOR_COLUMN_ARROW_STEP);
			event.preventDefault();
		}
	});
}
