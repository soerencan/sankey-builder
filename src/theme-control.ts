import type { DialogController } from "./dialog";
import { setupDialog } from "./dialog";
import type { State, Theme } from "./state";

export interface ThemeControlActions {
	setTheme(theme: Theme): void;
}

/**
 * Label and sprite-symbol id per theme mode, keyed by the actual state
 * value. Values stay auto/light/dark; "System" is only the dialog/button's
 * displayed label for "auto".
 */
const THEME_OPTIONS: Record<Theme, { label: string; iconId: string }> = {
	auto: { label: "System", iconId: "icon-theme-system" },
	light: { label: "Light", iconId: "icon-theme-light" },
	dark: { label: "Dark", iconId: "icon-theme-dark" },
};

function isThemeKey(value: unknown): value is Theme {
	return typeof value === "string" && Object.hasOwn(THEME_OPTIONS, value);
}

/**
 * Swaps #theme-button's icon/label and the dialog options' aria-pressed to
 * match state — same full-rebuild-from-state approach as syncToolbar, just
 * scoped to the header button and dialog rather than .diagram-panel, since
 * those two live outside it. Also called once at boot (after
 * setupThemeControl). Import deliberately does not call this — theme is a
 * per-browser preference, not diagram data, so it's untouched by import and
 * there's nothing here that could go stale (see app.ts's
 * ioActions.importDiagram).
 */
export function syncThemeControl(doc: Document, state: State): void {
	const theme = state.settings.theme;
	const { label, iconId } = THEME_OPTIONS[theme];

	const button = doc.getElementById("theme-button");
	if (button) {
		const use = button.querySelector("use");
		use?.setAttribute("href", `#${iconId}`);
		button.setAttribute("aria-label", `Theme: ${label}`);
	}

	const options = Array.from(doc.querySelectorAll<HTMLButtonElement>('[data-action="set-theme"]'));
	for (const option of options) {
		option.setAttribute("aria-pressed", option.dataset.value === theme ? "true" : "false");
	}
}

/**
 * Delegated click listeners on #theme-button and #theme-dialog — the two
 * elements the header control is split across (they sit outside
 * .diagram-panel, so setupToolbar's single panel-wide listener doesn't cover
 * them). Same data-action switch style as setupToolbar, just with its own
 * pair of roots instead of one shared ancestor. `signal` is the owning app
 * instance's AbortSignal — AppHandle.destroy() aborting it tears both
 * listeners below down.
 */
export function setupThemeControl(
	doc: Document,
	state: State,
	actions: ThemeControlActions,
	signal: AbortSignal,
): void {
	const button = doc.getElementById("theme-button");
	const dialogEl = doc.getElementById("theme-dialog");
	if (!button || !(dialogEl instanceof HTMLDialogElement)) return;

	const dialog: DialogController = setupDialog(dialogEl, signal);

	function handleClick(event: Event): void {
		if (!(event.target instanceof Element)) return;
		const trigger = event.target.closest<HTMLElement>("[data-action]");
		if (!trigger) return;
		const { action, value } = trigger.dataset;

		if (action === "open-theme-dialog") {
			dialog.open(trigger);
		} else if (action === "set-theme" && isThemeKey(value)) {
			actions.setTheme(value);
			syncThemeControl(doc, state);
			dialog.close();
		}
	}

	button.addEventListener("click", handleClick, { signal });
	// close-dialog/backdrop clicks are handled by dialog.ts's own listener
	// (registered by setupDialog above), not here — this only reacts to
	// set-theme, so the two listeners never double-handle the same click.
	dialogEl.addEventListener("click", handleClick, { signal });
}
