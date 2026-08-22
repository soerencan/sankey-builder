export interface DialogController {
	/** Opens the dialog modally and moves focus in; `trigger` is refocused on close. */
	open(trigger: HTMLElement): void;
	/** No-op if the dialog isn't currently open. */
	close(): void;
}

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Markup-agnostic open/close/focus wiring for a native <dialog>, shared by
 * every dialog the app opens (the palette chooser, link color, theme,
 * and the narrow Display surface all reuse this).
 */
export function setupDialog(dialog: HTMLDialogElement): DialogController {
	let trigger: HTMLElement | null = null;

	function close(): void {
		if (!dialog.open) return;
		dialog.close();
	}

	// Delegated rather than per-button: dialogs built by callers (e.g. the
	// palette chooser's five options) don't need their own close wiring.
	dialog.addEventListener("click", (event) => {
		// The dialog element's own box fills the area outside its rendered
		// content once shown modally — a click landing directly on it (not on
		// a descendant) is therefore a backdrop click.
		if (event.target === dialog) {
			close();
			return;
		}
		if (!(event.target instanceof Element)) return;
		if (event.target.closest('[data-action="close-dialog"]')) close();
	});

	// Covers every close path (the two above, a future Escape/cancel handler,
	// or a caller calling close() directly) with one focus-restore site.
	dialog.addEventListener("close", () => {
		trigger?.focus();
	});

	function open(el: HTMLElement): void {
		trigger = el;
		try {
			dialog.showModal();
		} catch {
			// Feature-detection fallback for a showModal that throws (not needed
			// by happy-dom or any real browser target today, but cheap insurance
			// against a runtime that only partially implements <dialog>).
			dialog.setAttribute("open", "");
		}
		// Explicit rather than relying on native autofocus/[autofocus]: prefers
		// the currently selected option (aria-pressed) so reopening the chooser
		// lands on the active palette, falling back to the first focusable
		// control (e.g. the first time it's opened, before anything is pressed).
		const pressed = dialog.querySelector<HTMLElement>('[aria-pressed="true"]');
		const initial = pressed ?? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
		initial?.focus();
	}

	return { open, close };
}
