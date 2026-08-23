import type { RefObject } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { isElement } from "./dom";

export interface DialogHandle {
	/** Attach to the JSX-rendered <dialog>. */
	ref: RefObject<HTMLDialogElement>;
	/** Opens the dialog modally and moves focus in; `trigger` is refocused on close. */
	open(trigger: HTMLElement): void;
	/** No-op if the dialog isn't currently open. */
	close(): void;
}

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Preact-owned open/close/focus wiring for a JSX-rendered <dialog>, replacing
 * the now-deleted shared/dialog.ts (its imperative equivalent) once
 * theme-control.tsx became this hook's last remaining non-caller. Keeps no
 * open state in Preact — showModal()/close() run imperatively on the ref so
 * callers (and tests) stay synchronous. Every caller in this migration still
 * mounts one <dialog> per hook call, so a single mount-once effect can own
 * its listeners for the component's lifetime.
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
		try {
			dialog.showModal();
		} catch {
			// Feature-detection fallback for a showModal that throws (not needed
			// by happy-dom or any real browser target today, but cheap insurance
			// against a runtime that only partially implements <dialog>).
			dialog.setAttribute("open", "");
		}
		// Prefers the currently selected option (aria-pressed) so reopening a
		// chooser lands on the active setting, falling back to the first
		// focusable control (e.g. the export dialog, which has none pressed).
		const pressed = dialog.querySelector<HTMLElement>('[aria-pressed="true"]');
		const initial = pressed ?? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
		initial?.focus();
	}

	// One native "close" listener covers every close path (explicit close(),
	// a backdrop click below, or the browser's own Escape handling) with a
	// single focus-restore site. The delegated click listener covers backdrop
	// clicks and any descendant [data-action="close-dialog"] button without
	// each dialog wiring its own onClick.
	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-once by design — the dialog element's identity is stable for this hook's lifetime, and `close` reads dialogRef.current fresh on every close path rather than needing to be a dependency.
	useLayoutEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		function handleClose(): void {
			triggerRef.current?.focus();
		}
		function handleClick(event: MouseEvent): void {
			if (event.target === dialog) {
				close();
				return;
			}
			if (!isElement(event.target)) return;
			if (event.target.closest('[data-action="close-dialog"]')) close();
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
