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
	aspectRatio: number;
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
export function PreviewResizer({ diagramRef, aspectRatio }: PreviewResizerProps) {
	const splitterRef = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState(() => loadPreviewHeight(localStorage));
	const [availableWidth, setAvailableWidth] = useState(0);
	const heightRef = useRef(height);
	const dragRef = useRef<DragState | null>(null);
	const maximum =
		availableWidth > 0
			? Math.min(MAX_PREVIEW_HEIGHT, Math.floor(availableWidth / aspectRatio))
			: MAX_PREVIEW_HEIGHT;
	const minimum = Math.min(MIN_PREVIEW_HEIGHT, maximum);
	const boundsRef = useRef({ minimum, maximum });
	boundsRef.current = { minimum, maximum };
	const displayedHeight = Math.min(maximum, Math.max(minimum, height));
	const adjustable = minimum < maximum;

	function currentHeight(): number {
		const bounds = boundsRef.current;
		return Math.min(bounds.maximum, Math.max(bounds.minimum, heightRef.current));
	}

	function apply(next: number): void {
		const bounds = boundsRef.current;
		const clamped = Math.min(bounds.maximum, Math.max(bounds.minimum, Math.round(next)));
		if (clamped === currentHeight()) return;
		heightRef.current = clamped;
		setHeight(clamped);
		persistPreviewHeight(localStorage, clamped);
	}

	useLayoutEffect(() => {
		const panel = diagramRef.current?.parentElement;
		const toolbar = panel?.querySelector(".diagram-toolbar");
		if (!panel || !toolbar) return;
		setAvailableWidth(panel.clientWidth);
		// The toolbar shares the available width without changing height when the preview resizes.
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setAvailableWidth(entry.borderBoxSize[0]?.inlineSize ?? entry.contentRect.width);
		});
		observer.observe(toolbar, { box: "border-box" });
		return () => observer.disconnect();
	}, [diagramRef]);

	useLayoutEffect(() => {
		diagramRef.current?.style.setProperty("--diagram-preview-height", `${displayedHeight}px`);
	}, [displayedHeight, diagramRef]);

	// Window-level listeners, since a drag continues once the pointer leaves
	// the splitter.
	// biome-ignore lint/correctness/useExhaustiveDependencies: apply only touches refs and the stable setHeight, so a stale closure behaves identically to a fresh one.
	useLayoutEffect(() => {
		const onPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			const next = drag.startHeight + event.clientY - drag.startY;
			apply(next);
			const { minimum, maximum } = boundsRef.current;
			if (next < minimum || next > maximum) {
				drag.startY = event.clientY;
				drag.startHeight = currentHeight();
			}
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
		if (event.key === "ArrowUp") next = currentHeight() - PREVIEW_HEIGHT_STEP;
		else if (event.key === "ArrowDown") next = currentHeight() + PREVIEW_HEIGHT_STEP;
		else if (event.key === "Home") next = boundsRef.current.minimum;
		else if (event.key === "End") next = boundsRef.current.maximum;
		if (next === undefined) return;
		event.preventDefault();
		apply(next);
	}

	function onSplitterPointerDown(event: JSX.TargetedPointerEvent<HTMLDivElement>): void {
		if (!adjustable) return;
		dragRef.current = {
			startY: event.clientY,
			startHeight: currentHeight(),
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
				disabled={displayedHeight <= minimum}
				onClick={() => apply(currentHeight() - PREVIEW_HEIGHT_STEP)}
			>
				<Icon id="icon-minus" />
			</button>
			{/* biome-ignore lint/a11y/useSemanticElements: An hr cannot contain the grip icon or act as an interactive resize handle. */}
			<div
				id="preview-splitter"
				ref={splitterRef}
				role="separator"
				aria-label="Resize diagram preview"
				aria-orientation="horizontal"
				aria-valuemin={minimum}
				aria-valuemax={maximum}
				aria-valuenow={displayedHeight}
				aria-valuetext={`${displayedHeight} pixels`}
				aria-disabled={!adjustable || undefined}
				tabIndex={adjustable ? 0 : -1}
				title="Drag vertically to resize the preview"
				onKeyDown={onSplitterKeyDown}
				onPointerDown={onSplitterPointerDown}
			>
				<Icon id="icon-grip-horizontal" />
			</div>
			<button
				type="button"
				class="preview-size-button"
				aria-label="Make diagram preview larger"
				title="Make preview larger"
				disabled={displayedHeight >= maximum}
				onClick={() => apply(currentHeight() + PREVIEW_HEIGHT_STEP)}
			>
				<Icon id="icon-plus" />
			</button>
		</>
	);
}
