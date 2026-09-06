import type { RefObject } from "preact";
import { useCallback, useLayoutEffect, useRef } from "preact/hooks";

export interface DialogHandle {
	ref: RefObject<HTMLDialogElement>;
	/** `trigger` is refocused on close. */
	open(trigger: HTMLElement): void;
	/** No-op if the dialog isn't currently open. */
	close(): void;
}

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Open state is not Preact state: showModal()/close() run imperatively on
 * the ref so callers and tests stay synchronous.
 */
export function useDialog(): DialogHandle {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const triggerRef = useRef<HTMLElement | null>(null);

	const position = useCallback((): void => {
		const dialog = dialogRef.current;
		const trigger = triggerRef.current;
		if (!dialog?.open || !trigger) return;
		const bounds = trigger.getBoundingClientRect();
		const panel = dialog.getBoundingClientRect();
		const { innerWidth: width, innerHeight: height } = window;
		const left = Math.max(8, Math.min(bounds.left, width - panel.width - 8));
		const below = bounds.bottom + 8;
		const top = below + panel.height <= height - 8 ? below : bounds.top - panel.height - 8;
		dialog.style.setProperty("--panel-left", `${left}px`);
		dialog.style.setProperty(
			"--panel-top",
			`${Math.max(8, Math.min(top, height - panel.height - 8))}px`,
		);
	}, []);

	const stopPositioning = useCallback((): void => {
		window.removeEventListener("resize", position);
		window.removeEventListener("scroll", position, true);
	}, [position]);

	function close(): void {
		const dialog = dialogRef.current;
		if (!dialog?.open) return;
		stopPositioning();
		dialog.close();
	}

	function open(trigger: HTMLElement): void {
		const dialog = dialogRef.current;
		if (!dialog) return;
		triggerRef.current = trigger;
		if (dialog.open) return;
		dialog.showModal();
		position();
		window.addEventListener("resize", position);
		window.addEventListener("scroll", position, true);
		// Focus lands on the active setting, or the first control in dialogs
		// without one (export).
		const pressed = dialog.querySelector<HTMLElement>('[aria-pressed="true"]');
		const initial =
			pressed ??
			dialog.querySelector(".dialog-content")?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
			dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
		initial?.focus();
	}

	// Focus is restored from the native "close" event, the one point every
	// close path (close(), backdrop click, Escape) goes through.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the dialog element is stable for the hook's lifetime and `close` reads dialogRef.current fresh each call.
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		function handleClose(): void {
			stopPositioning();
			triggerRef.current?.focus();
		}
		function handleClick(event: MouseEvent): void {
			if (event.target !== dialog || !dialog) return;
			const rect = dialog.getBoundingClientRect();
			if (
				event.clientX < rect.left ||
				event.clientX >= rect.right ||
				event.clientY < rect.top ||
				event.clientY >= rect.bottom
			)
				close();
		}
		dialog.addEventListener("close", handleClose);
		dialog.addEventListener("click", handleClick);
		return () => {
			stopPositioning();
			dialog.removeEventListener("close", handleClose);
			dialog.removeEventListener("click", handleClick);
		};
	}, []);

	return { ref: dialogRef, open, close };
}
