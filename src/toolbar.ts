import { PALETTE_LABELS, PALETTE_ORDER, isPaletteKey, paletteColors } from "./colors";
import type { DialogController } from "./dialog";
import { setupDialog } from "./dialog";
import type { Alignment, LinkColorMode, Palette, State } from "./state";

export interface ToolbarActions {
	setPalette(value: Palette): void;
	setLinkColor(mode: LinkColorMode): void;
	setAlignment(value: Alignment): void;
}

// Number of swatches shown per strip — matches the five named palettes'
// meaningful prefix; palettes with more entries (e.g. category10's 10) are
// truncated to keep the preview/dialog rows a consistent width.
const SWATCH_COUNT = 5;

/**
 * Label and sprite-symbol id per link-color mode, keyed by the actual state
 * value (unchanged by this UI-only move — see PLAN.md's "Link colors").
 * Exported so tests can pin index.html's hardcoded dialog row labels to this
 * map, the same way tests/smoke.test.ts already pins the palette dialog to
 * PALETTE_LABELS.
 */
export const LINK_COLOR_OPTIONS: Record<LinkColorMode, { label: string; iconId: string }> = {
	source: { label: "Source", iconId: "icon-link-source" },
	"source-target": { label: "Source to target (gradient)", iconId: "icon-link-gradient" },
	target: { label: "Target", iconId: "icon-link-target" },
	static: { label: "Neutral", iconId: "icon-link-neutral" },
};

function isLinkColorKey(value: unknown): value is LinkColorMode {
	return typeof value === "string" && Object.hasOwn(LINK_COLOR_OPTIONS, value);
}

/**
 * Own-property guard, same rationale as isLinkColorKey above. index.html's
 * align-group buttons carry their own static label/icon (unlike the Links
 * button, which reflects the current mode), so this doesn't need a
 * label/icon lookup table alongside it.
 */
const ALIGNMENT_VALUES: Record<Alignment, true> = {
	left: true,
	center: true,
	right: true,
	justify: true,
};

function isAlignmentKey(value: unknown): value is Alignment {
	return typeof value === "string" && Object.hasOwn(ALIGNMENT_VALUES, value);
}

function buildSwatchStrip(strip: HTMLElement, palette: Palette): void {
	strip.replaceChildren();
	for (const color of paletteColors(palette).slice(0, SWATCH_COUNT)) {
		const swatch = document.createElement("span");
		swatch.className = "swatch";
		swatch.style.backgroundColor = color;
		strip.appendChild(swatch);
	}
}

/**
 * Rebuilds the carousel preview and dialog rows from state — same
 * full-rebuild-from-state approach as the node/link editors, just scoped to
 * swatch strips and aria attributes rather than whole DOM subtrees. Also
 * called once at boot (after setupToolbar) and after an import replaces
 * settings, so the toolbar never shows a stale palette.
 */
export function syncToolbar(state: State): void {
	const panel = document.querySelector(".diagram-panel");
	if (!panel) return;
	const palette = state.settings.palette;

	const preview = panel.querySelector<HTMLButtonElement>("#palette-preview");
	if (preview) {
		const strip = preview.querySelector<HTMLElement>(".swatch-strip");
		if (strip) buildSwatchStrip(strip, palette);
		preview.setAttribute("aria-label", `Palette: ${PALETTE_LABELS[palette]}`);
	}

	const options = Array.from(
		panel.querySelectorAll<HTMLButtonElement>('[data-action="set-palette"]'),
	);
	for (const option of options) {
		const value = option.dataset.value;
		if (!isPaletteKey(value)) continue;
		option.setAttribute("aria-pressed", value === palette ? "true" : "false");
		const strip = option.querySelector<HTMLElement>(".swatch-strip");
		if (strip) buildSwatchStrip(strip, value);
	}

	const linkColor = state.settings.linkColor;
	const { label, iconId } = LINK_COLOR_OPTIONS[linkColor];
	const linksButton = panel.querySelector<HTMLButtonElement>("#links-button");
	if (linksButton) {
		const use = linksButton.querySelector("use");
		use?.setAttribute("href", `#${iconId}`);
		linksButton.setAttribute("aria-label", `Links: ${label}`);
	}

	// Document-scoped (not panel-scoped) rather than following the
	// panel-only pattern above: the narrow Diagram dialog holds a second copy
	// of these buttons, and both copies must stay in sync without this
	// function needing to know where they live.
	const linkColorOptions = Array.from(
		document.querySelectorAll<HTMLButtonElement>('[data-action="set-link-color"]'),
	);
	for (const option of linkColorOptions) {
		option.setAttribute("aria-pressed", option.dataset.value === linkColor ? "true" : "false");
	}

	// Document-scoped for the same reason as linkColorOptions above.
	const alignment = state.settings.alignment;
	const alignmentOptions = Array.from(
		document.querySelectorAll<HTMLButtonElement>('[data-action="set-alignment"]'),
	);
	for (const option of alignmentOptions) {
		option.setAttribute("aria-pressed", option.dataset.value === alignment ? "true" : "false");
	}
}

/**
 * Delegated click listener on the whole diagram panel — the toolbar's
 * carousel buttons and the palette dialog's option rows both live under it,
 * so one listener covers both without the panel and the dialog each wiring
 * their own. `data-action="close-dialog"` is deliberately NOT handled here:
 * dialog.ts's own listener (registered by setupDialog below) owns closing,
 * so the two listeners never double-handle the same click.
 *
 * Doesn't sync the initial preview itself — main.ts calls syncToolbar(state)
 * separately, once state has finished loading.
 */
export function setupToolbar(state: State, actions: ToolbarActions): void {
	const panel = document.querySelector(".diagram-panel");
	if (!panel) return;

	const dialogEl = panel.querySelector<HTMLDialogElement>("#palette-dialog");
	const dialog: DialogController | null = dialogEl ? setupDialog(dialogEl) : null;

	const linksDialogEl = panel.querySelector<HTMLDialogElement>("#links-dialog");
	const linksDialog: DialogController | null = linksDialogEl ? setupDialog(linksDialogEl) : null;

	// The narrow Diagram surface: unlike the other dialogs, choosing an
	// option here does NOT close it (PLAN.md's Narrow-screen Diagram surface)
	// — the diagram updates live behind it and the user dismisses it
	// explicitly (Close, backdrop, Escape).
	const displayDialogEl = panel.querySelector<HTMLDialogElement>("#display-dialog");
	const displayDialog: DialogController | null = displayDialogEl
		? setupDialog(displayDialogEl)
		: null;

	panel.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) return;
		// Buttons contain child icons/swatch strips, so the click target is
		// often a descendant rather than the button itself — closest() finds
		// the actual data-action owner regardless of which child was hit.
		const trigger = event.target.closest<HTMLElement>("[data-action]");
		if (!trigger) return;
		const { action, value } = trigger.dataset;

		if (action === "palette-prev" || action === "palette-next") {
			const current = PALETTE_ORDER.indexOf(state.settings.palette);
			const step = action === "palette-prev" ? -1 : 1;
			const next = (current + step + PALETTE_ORDER.length) % PALETTE_ORDER.length;
			actions.setPalette(PALETTE_ORDER[next]);
			syncToolbar(state);
		} else if (action === "open-palette-dialog") {
			dialog?.open(trigger);
		} else if (action === "set-palette" && isPaletteKey(value)) {
			actions.setPalette(value);
			syncToolbar(state);
			dialog?.close();
		} else if (action === "open-links-dialog") {
			linksDialog?.open(trigger);
		} else if (action === "open-display-dialog") {
			displayDialog?.open(trigger);
		} else if (action === "set-link-color" && isLinkColorKey(value)) {
			actions.setLinkColor(value);
			syncToolbar(state);
			// Only the links dialog's own copy closes on choice — the Diagram
			// dialog's copy (same data-action/data-value) stays open.
			if (trigger.closest("dialog") === linksDialogEl) linksDialog?.close();
		} else if (action === "set-alignment" && isAlignmentKey(value)) {
			actions.setAlignment(value);
			syncToolbar(state);
		}
	});
}
