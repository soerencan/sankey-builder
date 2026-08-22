import { PALETTE_LABELS, PALETTE_ORDER, isPaletteKey, paletteColors } from "./colors";
import type { DialogController } from "./dialog";
import { setupDialog } from "./dialog";
import type { Palette, State } from "./state";

export interface ToolbarActions {
	setPalette(value: Palette): void;
}

// Number of swatches shown per strip — matches the five named palettes'
// meaningful prefix; palettes with more entries (e.g. category10's 10) are
// truncated to keep the preview/dialog rows a consistent width.
const SWATCH_COUNT = 5;

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
		}
	});
}
