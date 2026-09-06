import type { JSX, RefObject } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Icon } from "../../shared/icon";

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
		// Without storage the height simply resets next session.
	}
}

export interface PreviewResizerProps {
	/** A sibling in App's tree, so it exists only after commit: read it from effects and handlers, never during render. */
	diagramRef: RefObject<HTMLElement>;
}

interface DragState {
	startY: number;
	startHeight: number;
	pointerId: number;
}

/**
 * The preview height lives outside diagram State and is written straight to
 * `diagramRef`: it changes only the displayed viewport, never the layout
 * extent or exported dimensions.
 *
 * `heightRef` mirrors `height` synchronously because Preact batches state
 * updates into a microtask: a second click or pointermove landing before the
 * flush would otherwise compute from a stale height.
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

	useLayoutEffect(() => {
		diagramRef.current?.style.setProperty("--diagram-preview-height", `${height}px`);
	}, [height, diagramRef]);

	// Window-level listeners, since a drag continues once the pointer leaves
	// the splitter.
	// biome-ignore lint/correctness/useExhaustiveDependencies: apply only touches refs and the stable setHeight, so a stale closure behaves identically to a fresh one.
	useLayoutEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			apply(drag.startHeight + event.clientY - drag.startY);
		};

		// A canceled gesture keeps the height applied so far, like a pointerup
		// at that position would.
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
			// Unmount can land mid-drag.
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
				<Icon id="icon-minus" />
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
				<Icon id="icon-plus" />
			</button>
			<button
				type="button"
				class="preview-size-button preview-reset"
				aria-label="Reset diagram preview size"
				title="Reset preview size"
				onClick={() => apply(DEFAULT_PREVIEW_HEIGHT)}
			>
				<Icon id="icon-reset" />
			</button>
		</>
	);
}
