import type { Alignment, State, Theme } from "./state";

export interface ControlsActions {
	setAlignment(value: Alignment): void;
	setTheme(value: Theme): void;
}

/**
 * Syncs the static <select> markup in #controls to state, so the defaults live
 * in one place (defaultState()) rather than duplicated as `selected` attributes
 * that could drift out of sync. Also called after an import replaces settings.
 * Palette and link color live in the diagram toolbar now (src/toolbar.ts's
 * syncToolbar).
 */
export function syncControls(state: State): void {
	const root = document.getElementById("controls");
	if (!root) return;

	const alignmentSelect = root.querySelector<HTMLSelectElement>("#alignment");
	if (alignmentSelect) alignmentSelect.value = state.settings.alignment;
	const themeSelect = root.querySelector<HTMLSelectElement>("#theme");
	if (themeSelect) themeSelect.value = state.settings.theme;
}

/**
 * Delegated change listener on #controls, mirroring the node/link editors'
 * setup functions. Settings are simple string fields, so this reads
 * straight off state and routes raw select values to actions rather than
 * going through per-field setters.
 */
export function setupControls(state: State, actions: ControlsActions): void {
	const root = document.getElementById("controls");
	if (!root) return;

	syncControls(state);

	root.addEventListener("change", (event) => {
		if (!(event.target instanceof HTMLSelectElement)) return;
		const { action } = event.target.dataset;
		// Select values arrive as plain strings; app.js trusts the DOM options
		// to hold only valid values, so these casts mirror that trust rather
		// than adding runtime validation app.js never had.
		if (action === "update-alignment") {
			actions.setAlignment(event.target.value as Alignment);
		} else if (action === "update-theme") {
			actions.setTheme(event.target.value as Theme);
		}
	});
}
