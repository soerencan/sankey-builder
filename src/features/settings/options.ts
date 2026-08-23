/**
 * Presentation metadata for the five closed setting domains — labels, icon
 * ids, and other display strings that index.html's hand-authored dialog
 * markup is contract-tested against (tests/integration/settings.test.ts).
 * Imports types/values from model/settings but never the reverse, so the
 * model stays free of user-facing strings.
 */

import type { Alignment, AspectRatio, LinkColorMode, Palette, Theme } from "../../model/settings";

// --- Palette ---

/** Human-readable names, matching the labels index.html's palette chooser rows use. */
export const PALETTE_LABELS: Record<Palette, string> = {
	observable10: "Observable 10",
	tableau10: "Tableau 10",
	category10: "Category 10",
	set2: "Set 2",
	dark2: "Dark 2",
};

// --- Link color mode ---

export interface LinkColorOptionMeta {
	label: string;
	/** The narrow display-dialog's abbreviated copy — identical to `label` except for the gradient mode. */
	shortLabel: string;
	iconId: string;
}

/**
 * Label and sprite-symbol id per link-color mode, keyed by the actual state
 * value. Declaration order is the dialogs' display order (DiagramPanel reads
 * it via Object.entries) — source, source-target, target, static — which
 * intentionally differs from model/settings.ts's LINK_COLOR_MODES validation
 * order. DiagramPanel renders the links/Diagram dialog rows directly from
 * this table; tests/integration/settings.test.ts's rendered-DOM contract
 * pins that every entry is actually wired into the markup.
 */
export const LINK_COLOR_OPTIONS: Record<LinkColorMode, LinkColorOptionMeta> = {
	source: { label: "Source", shortLabel: "Source", iconId: "icon-link-source" },
	"source-target": {
		label: "Source to target (gradient)",
		shortLabel: "Gradient",
		iconId: "icon-link-gradient",
	},
	target: { label: "Target", shortLabel: "Target", iconId: "icon-link-target" },
	static: { label: "Neutral", shortLabel: "Neutral", iconId: "icon-link-neutral" },
};

// --- Alignment ---

/**
 * Label and sprite-symbol id per alignment, in the toolbar/dialog's display
 * order (left, center, right, justify) — deliberately not
 * model/settings.ts's ALIGNMENTS validation order (left, right, center,
 * justify), so this array is the source for DOM iteration order rather than
 * a re-sort of that one. DiagramPanel renders the alignment rows directly
 * from this table; tests/integration/settings.test.ts's rendered-DOM
 * contract pins the value set (not order) against model/settings.ts's
 * ALIGNMENTS, since that's the one genuinely independent source left to
 * check against.
 */
export const ALIGNMENT_OPTIONS: readonly { value: Alignment; label: string; iconId: string }[] = [
	{ value: "left", label: "Left", iconId: "icon-align-left" },
	{ value: "center", label: "Center", iconId: "icon-align-center" },
	{ value: "right", label: "Right", iconId: "icon-align-right" },
	{ value: "justify", label: "Justify", iconId: "icon-align-justify" },
];

// --- Theme ---

/**
 * Label and sprite-symbol id per theme mode, keyed by the actual state
 * value. Values stay auto/light/dark; "System" is only the dialog/button's
 * displayed label for "auto".
 */
export const THEME_OPTIONS: Record<Theme, { label: string; iconId: string }> = {
	auto: { label: "System", iconId: "icon-theme-system" },
	light: { label: "Light", iconId: "icon-theme-light" },
	dark: { label: "Dark", iconId: "icon-theme-dark" },
};

// --- Aspect ratio ---

/** Human-readable names, matching the labels index.html's aspect-ratio picker rows use. */
export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
	"a-series": "A-series",
	"3:2": "3:2",
	"16:9": "16:9",
	"2:1": "2:1",
	"3:1": "3:1",
};
