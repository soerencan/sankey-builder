import { isElement } from "../../shared/dom";

export const PREVIEW_HEIGHT_STORAGE_KEY = "sankey-builder-preview-height";
export const MIN_PREVIEW_HEIGHT = 240;
export const MAX_PREVIEW_HEIGHT = 720;
export const DEFAULT_PREVIEW_HEIGHT = 360;
export const PREVIEW_HEIGHT_STEP = 40;

export function clampPreviewHeight(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_PREVIEW_HEIGHT;
	return Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, Math.round(value)));
}

export function loadPreviewHeight(storage: Storage): number {
	try {
		const stored = storage.getItem(PREVIEW_HEIGHT_STORAGE_KEY);
		if (stored === null || stored.trim() === "") return DEFAULT_PREVIEW_HEIGHT;
		const value = Number(stored);
		return Number.isFinite(value) ? clampPreviewHeight(value) : DEFAULT_PREVIEW_HEIGHT;
	} catch {
		return DEFAULT_PREVIEW_HEIGHT;
	}
}

function persistPreviewHeight(storage: Storage, value: number): void {
	try {
		storage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, String(value));
	} catch {
		// Preview sizing remains usable when browser storage is unavailable; it
		// simply returns to the default in the next session.
	}
}

/**
 * Wires the desktop preview splitter. The preference is intentionally kept
 * outside diagram State: it changes only the displayed viewport, never D3's
 * logical extent or exported JSON/SVG/PNG dimensions.
 *
 * `signal` tears down every listener below on AppHandle.destroy(), but a
 * pointer drag already in flight at that moment holds pointer capture and
 * in-progress `dragStartY`/`dragStartHeight` state the signal alone can't
 * unwind — the returned disposer resets that state and releases capture, and
 * app/start-app.ts calls it explicitly from destroy() rather than relying on the
 * signal for it.
 */
export function setupPreviewResizer(doc: Document, win: Window, signal: AbortSignal): () => void {
	const noopDisposer = () => {};
	const diagram = doc.getElementById("diagram");
	const controls = doc.querySelector<HTMLElement>(".preview-resizer");
	const splitter = doc.getElementById("preview-splitter");
	if (!diagram || !controls || !splitter) return noopDisposer;

	let height = loadPreviewHeight(win.localStorage);
	let dragStartY: number | null = null;
	let dragStartHeight = height;
	let dragPointerId: number | null = null;

	const apply = (next: number, persist = true) => {
		height = clampPreviewHeight(next);
		diagram.style.setProperty("--diagram-preview-height", `${height}px`);
		splitter.setAttribute("aria-valuenow", String(height));
		splitter.setAttribute("aria-valuetext", `${height} pixels`);
		if (persist) persistPreviewHeight(win.localStorage, height);
	};

	splitter.setAttribute("aria-valuemin", String(MIN_PREVIEW_HEIGHT));
	splitter.setAttribute("aria-valuemax", String(MAX_PREVIEW_HEIGHT));
	apply(height, false);

	controls.addEventListener(
		"click",
		(event) => {
			if (!isElement(event.target)) return;
			const action = event.target.closest<HTMLElement>("[data-action]")?.dataset.action;
			if (action === "preview-smaller") apply(height - PREVIEW_HEIGHT_STEP);
			else if (action === "preview-larger") apply(height + PREVIEW_HEIGHT_STEP);
			else if (action === "preview-reset") apply(DEFAULT_PREVIEW_HEIGHT);
		},
		{ signal },
	);

	splitter.addEventListener(
		"keydown",
		(event) => {
			let next: number | undefined;
			if (event.key === "ArrowUp") next = height - PREVIEW_HEIGHT_STEP;
			else if (event.key === "ArrowDown") next = height + PREVIEW_HEIGHT_STEP;
			else if (event.key === "Home") next = MIN_PREVIEW_HEIGHT;
			else if (event.key === "End") next = MAX_PREVIEW_HEIGHT;
			if (next === undefined) return;
			event.preventDefault();
			apply(next);
		},
		{ signal },
	);

	splitter.addEventListener(
		"pointerdown",
		(event) => {
			dragStartY = event.clientY;
			dragStartHeight = height;
			dragPointerId = event.pointerId;
			splitter.setPointerCapture?.(event.pointerId);
			event.preventDefault();
		},
		{ signal },
	);

	win.addEventListener(
		"pointermove",
		(event) => {
			if (dragStartY === null) return;
			apply(dragStartHeight + event.clientY - dragStartY);
		},
		{ signal },
	);

	win.addEventListener(
		"pointerup",
		(event) => {
			if (dragStartY === null) return;
			dragStartY = null;
			dragPointerId = null;
			splitter.releasePointerCapture?.(event.pointerId);
		},
		{ signal },
	);

	return function cancelDrag(): void {
		if (dragStartY === null) return;
		if (dragPointerId !== null) splitter.releasePointerCapture?.(dragPointerId);
		dragStartY = null;
		dragPointerId = null;
	};
}
