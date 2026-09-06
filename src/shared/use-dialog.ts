import type { RefObject } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

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

	function close(): void {
		const dialog = dialogRef.current;
		if (!dialog?.open) return;
		dialog.close();
	}

	function open(trigger: HTMLElement): void {
		const dialog = dialogRef.current;
		if (!dialog) return;
		triggerRef.current = trigger;
		dialog.showModal();
		// Focus lands on the active setting, or the first control in dialogs
		// without one (export).
		const pressed = dialog.querySelector<HTMLElement>('[aria-pressed="true"]');
		const initial = pressed ?? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
		initial?.focus();
	}

	// Focus is restored from the native "close" event, the one point every
	// close path (close(), backdrop click, Escape) goes through.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the dialog element is stable for the hook's lifetime and `close` reads dialogRef.current fresh each call.
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		function handleClose(): void {
			triggerRef.current?.focus();
		}
		function handleClick(event: MouseEvent): void {
			if (event.target === dialog) close();
		}
		dialog.addEventListener("close", handleClose);
		dialog.addEventListener("click", handleClick);
		return () => {
			dialog.removeEventListener("close", handleClose);
			dialog.removeEventListener("click", handleClick);
		};
	}, []);

	return { ref: dialogRef, open, close };
}
