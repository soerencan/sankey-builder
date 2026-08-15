import type { Alignment, LinkColorMode, State, Theme } from "./state";

export interface ControlsActions {
	setLinkColor(value: LinkColorMode): void;
	setAlignment(value: Alignment): void;
	// Raw select value, including "manual": branching into enterManualMode
	// vs. a plain palette switch is a state write, which main.ts owns.
	selectPalette(value: string): void;
	setTheme(value: Theme): void;
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

	// Sync the static <select> markup to state on load, so the defaults live
	// in one place (defaultState()) rather than duplicated as `selected`
	// attributes that could drift out of sync.
	const linkColorSelect = root.querySelector<HTMLSelectElement>("#link-color");
	if (linkColorSelect) linkColorSelect.value = state.settings.linkColor;
	const alignmentSelect = root.querySelector<HTMLSelectElement>("#alignment");
	if (alignmentSelect) alignmentSelect.value = state.settings.alignment;
	const themeSelect = root.querySelector<HTMLSelectElement>("#theme");
	if (themeSelect) themeSelect.value = state.settings.theme;
	// "Manual" is a colorMode flip, not a palette value — settings.palette
	// keeps the last named palette underneath it as the fallback scale.
	const paletteSelect = root.querySelector<HTMLSelectElement>("#palette");
	if (paletteSelect) {
		paletteSelect.value = state.settings.colorMode === "manual" ? "manual" : state.settings.palette;
	}

	root.addEventListener("change", (event) => {
		if (!(event.target instanceof HTMLSelectElement)) return;
		const { action } = event.target.dataset;
		// Select values arrive as plain strings; app.js trusts the DOM options
		// to hold only valid values, so these casts mirror that trust rather
		// than adding runtime validation app.js never had.
		if (action === "update-link-color") {
			actions.setLinkColor(event.target.value as LinkColorMode);
		} else if (action === "update-alignment") {
			actions.setAlignment(event.target.value as Alignment);
		} else if (action === "update-palette") {
			actions.selectPalette(event.target.value);
		} else if (action === "update-theme") {
			actions.setTheme(event.target.value as Theme);
		}
	});
}
