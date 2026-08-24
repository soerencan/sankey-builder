import type { JSX, RefObject } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

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

export interface PreviewResizerProps {
	/**
	 * The #diagram root, which the current height is written to as
	 * --diagram-preview-height. A ref, not the element directly: App renders
	 * #diagram and this component as siblings in one tree, so the element
	 * only exists once the whole tree has committed — read only from effects
	 * and event handlers below, never during render.
	 */
	diagramRef: RefObject<HTMLElement>;
	/** The realm to read/write localStorage on and to attach the window-level drag listeners to. */
	win: Window;
}

interface DragState {
	startY: number;
	startHeight: number;
	pointerId: number;
}

/**
 * The desktop preview splitter. The preference is intentionally kept outside
 * diagram State: it changes only the displayed viewport, never D3's logical
 * extent or exported JSON/SVG/PNG dimensions — which is also why applying a
 * height writes directly to `diagramRef`/the DOM below rather than flowing
 * back through the controller's `state`/refresh().
 *
 * Height and aria-valuenow are written directly to the DOM through refs
 * inside the event handlers below, not through useState, so a click or
 * keydown is reflected synchronously (existing tests assert immediately
 * after dispatching the event, with no microtask/render flush in between).
 * `initialHeight` only seeds the first render's markup.
 */
export function PreviewResizer({ diagramRef, win }: PreviewResizerProps) {
	const splitterRef = useRef<HTMLDivElement>(null);
	const [initialHeight] = useState(() => loadPreviewHeight(win.localStorage));
	const heightRef = useRef(initialHeight);
	const dragRef = useRef<DragState | null>(null);

	function apply(next: number, persist = true): void {
		const height = clampPreviewHeight(next);
		heightRef.current = height;
		diagramRef.current?.style.setProperty("--diagram-preview-height", `${height}px`);
		const splitter = splitterRef.current;
		if (splitter) {
			splitter.setAttribute("aria-valuenow", String(height));
			splitter.setAttribute("aria-valuetext", `${height} pixels`);
		}
		if (persist) persistPreviewHeight(win.localStorage, height);
	}

	// Mount-once effect (empty dependency array): applies the loaded height to
	// diagramRef.current (a sibling element this component doesn't render, so
	// JSX alone can't reach it — populated by the time this runs, since layout
	// effects fire only after the whole App tree has committed) and owns the
	// window-level pointermove/pointerup/pointercancel listeners a drag needs
	// even once the pointer leaves the splitter.
	// biome-ignore lint/correctness/useExhaustiveDependencies: diagramRef/win are stable for this component's lifetime — see the mount-once rationale above.
	useLayoutEffect(() => {
		apply(heightRef.current, false);

		const onPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			apply(drag.startHeight + event.clientY - drag.startY);
		};

		// Shared by pointerup and pointercancel: both simply disarm the drag.
		// The height already applied mid-drag (via onPointerMove above) is left
		// as-is — a canceled gesture (e.g. an incoming call or an edge-swipe
		// interrupting a touch drag) ends the drag at its current position
		// exactly like a pointerup there would, it just isn't followed by one.
		const endDrag = (pointerId: number) => {
			if (!dragRef.current) return;
			dragRef.current = null;
			splitterRef.current?.releasePointerCapture?.(pointerId);
		};

		const onPointerUp = (event: PointerEvent) => endDrag(event.pointerId);
		const onPointerCancel = (event: PointerEvent) => endDrag(event.pointerId);

		win.addEventListener("pointermove", onPointerMove);
		win.addEventListener("pointerup", onPointerUp);
		win.addEventListener("pointercancel", onPointerCancel);

		return () => {
			win.removeEventListener("pointermove", onPointerMove);
			win.removeEventListener("pointerup", onPointerUp);
			win.removeEventListener("pointercancel", onPointerCancel);
			// An AbortSignal-driven teardown can't unwind a drag already in
			// flight — release capture and drop the drag state explicitly so a
			// pointerup/pointercancel that arrives after unmount is inert.
			const drag = dragRef.current;
			if (drag) {
				splitterRef.current?.releasePointerCapture?.(drag.pointerId);
				dragRef.current = null;
			}
		};
	}, []);

	function onSplitterKeyDown(event: JSX.TargetedKeyboardEvent<HTMLDivElement>): void {
		let next: number | undefined;
		if (event.key === "ArrowUp") next = heightRef.current - PREVIEW_HEIGHT_STEP;
		else if (event.key === "ArrowDown") next = heightRef.current + PREVIEW_HEIGHT_STEP;
		else if (event.key === "Home") next = MIN_PREVIEW_HEIGHT;
		else if (event.key === "End") next = MAX_PREVIEW_HEIGHT;
		if (next === undefined) return;
		event.preventDefault();
		apply(next);
	}

	function onSplitterPointerDown(event: JSX.TargetedPointerEvent<HTMLDivElement>): void {
		dragRef.current = {
			startY: event.clientY,
			startHeight: heightRef.current,
			pointerId: event.pointerId,
		};
		splitterRef.current?.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	}

	return (
		<>
			<button
				type="button"
				class="preview-size-button"
				data-action="preview-smaller"
				aria-label="Make diagram preview smaller"
				title="Make preview smaller"
				onClick={() => apply(heightRef.current - PREVIEW_HEIGHT_STEP)}
			>
				<svg class="icon" aria-hidden="true" focusable="false">
					<use href="#icon-minus" />
				</svg>
			</button>
			<div
				id="preview-splitter"
				ref={splitterRef}
				// biome-ignore lint/a11y/useSemanticElements: an <hr> can't be focusable/draggable — this is an interactive slider-style splitter, not a decorative divider.
				role="separator"
				aria-label="Resize diagram preview"
				aria-orientation="horizontal"
				aria-valuemin={MIN_PREVIEW_HEIGHT}
				aria-valuemax={MAX_PREVIEW_HEIGHT}
				aria-valuenow={initialHeight}
				tabIndex={0}
				title="Drag vertically to resize the preview"
				onKeyDown={onSplitterKeyDown}
				onPointerDown={onSplitterPointerDown}
			>
				<span class="preview-grip" aria-hidden="true" />
			</div>
			<button
				type="button"
				class="preview-size-button"
				data-action="preview-larger"
				aria-label="Make diagram preview larger"
				title="Make preview larger"
				onClick={() => apply(heightRef.current + PREVIEW_HEIGHT_STEP)}
			>
				<svg class="icon" aria-hidden="true" focusable="false">
					<use href="#icon-plus" />
				</svg>
			</button>
			<button
				type="button"
				class="preview-size-button preview-reset"
				data-action="preview-reset"
				aria-label="Reset diagram preview size"
				title="Reset preview size"
				onClick={() => apply(DEFAULT_PREVIEW_HEIGHT)}
			>
				<svg class="icon" aria-hidden="true" focusable="false">
					<use href="#icon-reset" />
				</svg>
			</button>
		</>
	);
}
