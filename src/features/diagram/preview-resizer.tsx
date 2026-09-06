import type { JSX, RefObject } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

export const PREVIEW_HEIGHT_STORAGE_KEY = "sankey-builder-preview-height";
export const MIN_PREVIEW_HEIGHT = 240;
export const MAX_PREVIEW_HEIGHT = 720;
export const DEFAULT_PREVIEW_HEIGHT = 360;
const PREVIEW_HEIGHT_STEP = 40;

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
 * height writes directly to `diagramRef` below rather than flowing back
 * through the controller's `state`/commit().
 *
 * `height` is render state: `aria-valuenow`/`aria-valuetext` are JSX
 * expressions derived from it, and the CSS custom-property write on
 * `diagramRef` happens in the layout effect below, keyed on `height` — so
 * both land on the DOM together, on the next render, after any apply().
 * `heightRef` is a separate, synchronously-updated mirror of the same value:
 * a click, keydown, or pointermove computes its next height from "the last
 * height apply() was called with", and Preact's state updates are batched
 * into a microtask, so reading `height` itself inside apply() would see a
 * stale value for a second interaction landing before that microtask flush
 * (e.g. two quick clicks, or successive pointermoves during one drag).
 */
export function PreviewResizer({ diagramRef }: PreviewResizerProps) {
	const splitterRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(() => loadPreviewHeight(localStorage));
	const heightRef = useRef(height);
	const dragRef = useRef<DragState | null>(null);

	function apply(next: number): void {
		const clamped = clampPreviewHeight(next);
		heightRef.current = clamped;
		setHeight(clamped);
		persistPreviewHeight(localStorage, clamped);
	}

	// Keyed on height (and the stable diagramRef), so it also covers the
	// initial render: diagramRef is a sibling element this component doesn't
	// render, so JSX alone can't reach it, but by the time any layout effect
	// runs the whole App tree — including that sibling — has committed.
	useLayoutEffect(() => {
		diagramRef.current?.style.setProperty("--diagram-preview-height", `${height}px`);
	}, [height, diagramRef]);

	// Mount-once effect (empty dependency array): owns the window-level
	// pointermove/pointerup/pointercancel listeners a drag needs even once the
	// pointer leaves the splitter. `apply` only touches refs and the stable
	// setHeight, so a stale closure over it behaves identically to a fresh one.
	// biome-ignore lint/correctness/useExhaustiveDependencies: apply is effectively stable; see above.
	useLayoutEffect(() => {
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

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			// This cleanup runs on unmount, which can land mid-drag — release
			// capture and drop the drag state explicitly so a pointerup/
			// pointercancel that arrives after unmount is inert.
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
				aria-valuenow={height}
				aria-valuetext={`${height} pixels`}
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
