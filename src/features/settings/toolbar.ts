import type { State } from "../../model/graph";
import {
	ASPECT_RATIO_OPTIONS,
	type Alignment,
	type AspectRatio,
	type LinkColorMode,
	PALETTE_LABELS,
	PALETTE_ORDER,
	type Palette,
	aspectRatioOption,
	isAlignment,
	isAspectRatio,
	isLinkColorMode,
	isPaletteKey,
} from "../../model/settings";
import type { DialogController } from "../../shared/dialog";
import { setupDialog } from "../../shared/dialog";
import { paletteColors } from "../diagram/colors";

export interface ToolbarActions {
	setPalette(value: Palette): void;
	setLinkColor(mode: LinkColorMode): void;
	setAlignment(value: Alignment): void;
	setAspectRatio(value: AspectRatio): void;
}

// Number of swatches shown per strip — matches the five named palettes'
// meaningful prefix; palettes with more entries (e.g. category10's 10) are
// truncated to keep the preview/dialog rows a consistent width.
const SWATCH_COUNT = 5;

/**
 * Label and sprite-symbol id per link-color mode, keyed by the actual state
 * value. Exported so tests can pin index.html's hardcoded dialog row labels
 * to this map, the same way tests/integration/settings.test.ts already pins
 * the palette dialog to PALETTE_LABELS.
 */
export const LINK_COLOR_OPTIONS: Record<LinkColorMode, { label: string; iconId: string }> = {
	source: { label: "Source", iconId: "icon-link-source" },
	"source-target": { label: "Source to target (gradient)", iconId: "icon-link-gradient" },
	target: { label: "Target", iconId: "icon-link-target" },
	static: { label: "Neutral", iconId: "icon-link-neutral" },
};

function buildSwatchStrip(doc: Document, strip: HTMLElement, palette: Palette): void {
	strip.replaceChildren();
	for (const color of paletteColors(palette).slice(0, SWATCH_COUNT)) {
		const swatch = doc.createElement("span");
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
export function syncToolbar(doc: Document, state: State): void {
	const panel = doc.querySelector(".diagram-panel");
	if (!panel) return;
	const palette = state.settings.palette;

	const preview = panel.querySelector<HTMLButtonElement>("#palette-preview");
	if (preview) {
		const strip = preview.querySelector<HTMLElement>(".swatch-strip");
		if (strip) buildSwatchStrip(doc, strip, palette);
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
		if (strip) buildSwatchStrip(doc, strip, value);
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
		doc.querySelectorAll<HTMLButtonElement>('[data-action="set-link-color"]'),
	);
	for (const option of linkColorOptions) {
		option.setAttribute("aria-pressed", option.dataset.value === linkColor ? "true" : "false");
	}

	// Document-scoped for the same reason as linkColorOptions above.
	const alignment = state.settings.alignment;
	const alignmentOptions = Array.from(
		doc.querySelectorAll<HTMLButtonElement>('[data-action="set-alignment"]'),
	);
	for (const option of alignmentOptions) {
		option.setAttribute("aria-pressed", option.dataset.value === alignment ? "true" : "false");
	}

	const aspectRatio = state.settings.aspectRatio;
	const ratioButton = panel.querySelector<HTMLButtonElement>("#aspect-ratio-button");
	if (ratioButton) {
		ratioButton
			.querySelector<HTMLElement>(".aspect-ratio-current")
			?.replaceChildren(`Aspect ${aspectRatioOption(aspectRatio).label}`);
		ratioButton.setAttribute("aria-label", `Aspect ratio: ${aspectRatioOption(aspectRatio).label}`);
	}
	for (const option of Array.from(
		doc.querySelectorAll<HTMLButtonElement>('[data-action="set-aspect-ratio"]'),
	)) {
		option.setAttribute("aria-pressed", option.dataset.value === aspectRatio ? "true" : "false");
	}
	const diagram = doc.getElementById("diagram");
	const ratio = aspectRatioOption(aspectRatio);
	diagram?.style.setProperty("--diagram-aspect-ratio", `${ratio.width} / ${ratio.height}`);
	diagram?.style.setProperty("--diagram-aspect-number", String(ratio.width / ratio.height));
}

/**
 * Delegated click listener on the whole diagram panel — the toolbar's
 * carousel buttons and the palette dialog's option rows both live under it,
 * so one listener covers both without the panel and the dialog each wiring
 * their own. `data-action="close-dialog"` is deliberately NOT handled here:
 * shared/dialog.ts's own listener (registered by setupDialog below) owns closing,
 * so the two listeners never double-handle the same click.
 *
 * Doesn't sync the initial preview itself — app/start-app.ts calls syncToolbar(doc,
 * state) separately, once state has finished loading. `signal` is the
 * owning app instance's AbortSignal — AppHandle.destroy() aborting it tears
 * the panel-wide listener (and every setupDialog listener below) down.
 */
export function setupToolbar(
	doc: Document,
	state: State,
	actions: ToolbarActions,
	signal: AbortSignal,
): void {
	const panel = doc.querySelector(".diagram-panel");
	if (!panel) return;

	const dialogEl = panel.querySelector<HTMLDialogElement>("#palette-dialog");
	const dialog: DialogController | null = dialogEl ? setupDialog(dialogEl, signal) : null;

	const linksDialogEl = panel.querySelector<HTMLDialogElement>("#links-dialog");
	const linksDialog: DialogController | null = linksDialogEl
		? setupDialog(linksDialogEl, signal)
		: null;

	const aspectDialogEl = panel.querySelector<HTMLDialogElement>("#aspect-ratio-dialog");
	const aspectDialog: DialogController | null = aspectDialogEl
		? setupDialog(aspectDialogEl, signal)
		: null;

	// The narrow Diagram surface: unlike the other dialogs, choosing an
	// option here does NOT close it — the diagram updates live behind it and
	// the user dismisses it explicitly (Close, backdrop, Escape).
	const displayDialogEl = panel.querySelector<HTMLDialogElement>("#display-dialog");
	const displayDialog: DialogController | null = displayDialogEl
		? setupDialog(displayDialogEl, signal)
		: null;

	panel.addEventListener(
		"click",
		(event) => {
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
				syncToolbar(doc, state);
			} else if (action === "open-palette-dialog") {
				dialog?.open(trigger);
			} else if (action === "set-palette" && isPaletteKey(value)) {
				actions.setPalette(value);
				syncToolbar(doc, state);
				dialog?.close();
			} else if (action === "open-links-dialog") {
				linksDialog?.open(trigger);
			} else if (action === "open-aspect-ratio-dialog") {
				aspectDialog?.open(trigger);
			} else if (action === "open-display-dialog") {
				displayDialog?.open(trigger);
			} else if (action === "set-link-color" && isLinkColorMode(value)) {
				actions.setLinkColor(value);
				syncToolbar(doc, state);
				// Only the links dialog's own copy closes on choice — the Diagram
				// dialog's copy (same data-action/data-value) stays open.
				if (trigger.closest("dialog") === linksDialogEl) linksDialog?.close();
			} else if (action === "set-alignment" && isAlignment(value)) {
				actions.setAlignment(value);
				syncToolbar(doc, state);
			} else if (action === "set-aspect-ratio" && isAspectRatio(value)) {
				actions.setAspectRatio(value);
				syncToolbar(doc, state);
				if (trigger.closest("dialog") === aspectDialogEl) aspectDialog?.close();
			}
		},
		{ signal },
	);
}
