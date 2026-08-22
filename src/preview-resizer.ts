export const PREVIEW_HEIGHT_STORAGE_KEY = "sankey-builder-preview-height";
export const MIN_PREVIEW_HEIGHT = 240;
export const MAX_PREVIEW_HEIGHT = 720;
export const DEFAULT_PREVIEW_HEIGHT = 360;
export const PREVIEW_HEIGHT_STEP = 40;

export function clampPreviewHeight(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_PREVIEW_HEIGHT;
	return Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, Math.round(value)));
}

export function loadPreviewHeight(): number {
	try {
		const stored = localStorage.getItem(PREVIEW_HEIGHT_STORAGE_KEY);
		if (stored === null || stored.trim() === "") return DEFAULT_PREVIEW_HEIGHT;
		const value = Number(stored);
		return Number.isFinite(value) ? clampPreviewHeight(value) : DEFAULT_PREVIEW_HEIGHT;
	} catch {
		return DEFAULT_PREVIEW_HEIGHT;
	}
}

function persistPreviewHeight(value: number): void {
	try {
		localStorage.setItem(PREVIEW_HEIGHT_STORAGE_KEY, String(value));
	} catch {
		// Preview sizing remains usable when browser storage is unavailable; it
		// simply returns to the default in the next session.
	}
}

/**
 * Wires the desktop preview splitter. The preference is intentionally kept
 * outside diagram State: it changes only the displayed viewport, never D3's
 * logical extent or exported JSON/SVG/PNG dimensions.
 */
export function setupPreviewResizer(): void {
	const diagram = document.getElementById("diagram");
	const controls = document.querySelector<HTMLElement>(".preview-resizer");
	const splitter = document.getElementById("preview-splitter");
	if (!diagram || !controls || !splitter) return;

	let height = loadPreviewHeight();
	let dragStartY: number | null = null;
	let dragStartHeight = height;

	const apply = (next: number, persist = true) => {
		height = clampPreviewHeight(next);
		diagram.style.setProperty("--diagram-preview-height", `${height}px`);
		splitter.setAttribute("aria-valuenow", String(height));
		splitter.setAttribute("aria-valuetext", `${height} pixels`);
		if (persist) persistPreviewHeight(height);
	};

	splitter.setAttribute("aria-valuemin", String(MIN_PREVIEW_HEIGHT));
	splitter.setAttribute("aria-valuemax", String(MAX_PREVIEW_HEIGHT));
	apply(height, false);

	controls.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) return;
		const action = event.target.closest<HTMLElement>("[data-action]")?.dataset.action;
		if (action === "preview-smaller") apply(height - PREVIEW_HEIGHT_STEP);
		else if (action === "preview-larger") apply(height + PREVIEW_HEIGHT_STEP);
		else if (action === "preview-reset") apply(DEFAULT_PREVIEW_HEIGHT);
	});

	splitter.addEventListener("keydown", (event) => {
		let next: number | undefined;
		if (event.key === "ArrowUp") next = height - PREVIEW_HEIGHT_STEP;
		else if (event.key === "ArrowDown") next = height + PREVIEW_HEIGHT_STEP;
		else if (event.key === "Home") next = MIN_PREVIEW_HEIGHT;
		else if (event.key === "End") next = MAX_PREVIEW_HEIGHT;
		if (next === undefined) return;
		event.preventDefault();
		apply(next);
	});

	splitter.addEventListener("pointerdown", (event) => {
		dragStartY = event.clientY;
		dragStartHeight = height;
		splitter.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	});

	window.addEventListener("pointermove", (event) => {
		if (dragStartY === null) return;
		apply(dragStartHeight + event.clientY - dragStartY);
	});

	window.addEventListener("pointerup", (event) => {
		if (dragStartY === null) return;
		dragStartY = null;
		splitter.releasePointerCapture?.(event.pointerId);
	});
}
