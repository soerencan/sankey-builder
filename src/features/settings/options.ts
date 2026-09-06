/**
 * Presentation metadata for the setting domains. Depends on model/settings,
 * never the reverse, so the model stays free of user-facing strings.
 */

import type { Alignment, AspectRatio, LinkColorMode, Palette, Theme } from "../../model/settings";

// --- Palette ---

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
	/** For the narrow display sheet. */
	shortLabel: string;
	iconId: string;
}

// Declaration order is the dialogs' display order, and intentionally differs
// from model/settings' LINK_COLOR_MODES.
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

// Display order, which intentionally differs from model/settings' ALIGNMENTS.
export const ALIGNMENT_OPTIONS: readonly { value: Alignment; label: string; iconId: string }[] = [
	{ value: "left", label: "Left", iconId: "icon-align-left" },
	{ value: "center", label: "Center", iconId: "icon-align-center" },
	{ value: "right", label: "Right", iconId: "icon-align-right" },
	{ value: "justify", label: "Justify", iconId: "icon-align-justify" },
];

// --- Theme ---

export const THEME_OPTIONS: Record<Theme, { label: string; iconId: string }> = {
	auto: { label: "System", iconId: "icon-theme-system" },
	light: { label: "Light", iconId: "icon-theme-light" },
	dark: { label: "Dark", iconId: "icon-theme-dark" },
};

// --- Aspect ratio ---

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
	"a-series": "A-series",
	"3:2": "3:2",
	"16:9": "16:9",
	"2:1": "2:1",
	"3:1": "3:1",
};
