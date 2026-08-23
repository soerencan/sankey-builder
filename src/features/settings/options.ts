/**
 * Presentation metadata for the five closed setting domains — labels, icon
 * ids, and other display strings that index.html's hand-authored dialog
 * markup is contract-tested against (tests/integration/settings.test.ts).
 * Imports types/values from model/settings but never the reverse, so the
 * model stays free of user-facing strings.
 */

import type { AspectRatio, LinkColorMode, Palette, Theme } from "../../model/settings";

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

/**
 * Label and sprite-symbol id per link-color mode, keyed by the actual state
 * value. Contract-tested against index.html's hardcoded links/Diagram dialog
 * rows in tests/integration/settings.test.ts.
 */
export const LINK_COLOR_OPTIONS: Record<LinkColorMode, { label: string; iconId: string }> = {
	source: { label: "Source", iconId: "icon-link-source" },
	"source-target": { label: "Source to target (gradient)", iconId: "icon-link-gradient" },
	target: { label: "Target", iconId: "icon-link-target" },
	static: { label: "Neutral", iconId: "icon-link-neutral" },
};

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
