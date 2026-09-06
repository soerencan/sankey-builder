/**
 * Presentation metadata for the setting domains. Depends on model/settings,
 * never the reverse, so the model stays free of user-facing strings.
 */

import type { Alignment, LinkColorMode, Settings, Theme } from "../../model/settings";
import { SETTING_DOMAINS } from "../../model/settings";

/**
 * One outer record over every setting, each inner record over every value,
 * so a new setting or a new value without a label fails typecheck. A
 * standalone `Record<Palette, string>` would only catch the latter.
 */
export const SETTING_LABELS: { [K in keyof Settings]: Record<Settings[K], string> } = {
	palette: {
		observable10: "Observable 10",
		tableau10: "Tableau 10",
		category10: "Category 10",
		set2: "Set 2",
		dark2: "Dark 2",
	},
	linkColor: {
		source: "Source",
		"source-target": "Source to target (gradient)",
		target: "Target",
		static: "Neutral",
	},
	alignment: {
		left: "Left",
		center: "Center",
		right: "Right",
		justify: "Justify",
	},
	aspectRatio: {
		"a-series": "A-series",
		"3:2": "3:2",
		"16:9": "16:9",
		"2:1": "2:1",
		"3:1": "3:1",
	},
	theme: {
		auto: "System",
		light: "Light",
		dark: "Dark",
	},
};

// --- Link color mode: icons and the narrow sheet's short labels ---

export const LINK_COLOR_ICONS: Record<LinkColorMode, string> = {
	source: "icon-link-source",
	"source-target": "icon-link-gradient",
	target: "icon-link-target",
	static: "icon-link-neutral",
};

/** For the narrow display sheet. */
export const LINK_COLOR_SHORT_LABELS: Record<LinkColorMode, string> = {
	source: "Source",
	"source-target": "Gradient",
	target: "Target",
	static: "Neutral",
};

// --- Alignment: icons for the icon-only segmented control ---

const ALIGNMENT_ICONS: Record<Alignment, string> = {
	left: "icon-align-left",
	center: "icon-align-center",
	right: "icon-align-right",
	justify: "icon-align-justify",
};

// --- Theme: icons ---

export const THEME_ICONS: Record<Theme, string> = {
	auto: "icon-theme-system",
	light: "icon-theme-light",
	dark: "icon-theme-dark",
};

// --- Choice arrays, one per setting, in SETTING_DOMAINS order ---

export interface PaletteChoice {
	value: Settings["palette"];
	label: string;
}

export const PALETTE_CHOICES: readonly PaletteChoice[] = SETTING_DOMAINS.palette.map((value) => ({
	value,
	label: SETTING_LABELS.palette[value],
}));

export interface LinkColorChoice {
	value: LinkColorMode;
	label: string;
	shortLabel: string;
	iconId: string;
}

export const LINK_COLOR_CHOICES: readonly LinkColorChoice[] = SETTING_DOMAINS.linkColor.map(
	(value) => ({
		value,
		label: SETTING_LABELS.linkColor[value],
		shortLabel: LINK_COLOR_SHORT_LABELS[value],
		iconId: LINK_COLOR_ICONS[value],
	}),
);

export interface AlignmentChoice {
	value: Alignment;
	label: string;
	iconId: string;
}

export const ALIGNMENT_CHOICES: readonly AlignmentChoice[] = SETTING_DOMAINS.alignment.map(
	(value) => ({
		value,
		label: SETTING_LABELS.alignment[value],
		iconId: ALIGNMENT_ICONS[value],
	}),
);

export interface AspectRatioChoice {
	value: Settings["aspectRatio"];
	label: string;
}

export const ASPECT_RATIO_CHOICES: readonly AspectRatioChoice[] = SETTING_DOMAINS.aspectRatio.map(
	(value) => ({
		value,
		label: SETTING_LABELS.aspectRatio[value],
	}),
);

export interface ThemeChoice {
	value: Theme;
	label: string;
	iconId: string;
}

export const THEME_CHOICES: readonly ThemeChoice[] = SETTING_DOMAINS.theme.map((value) => ({
	value,
	label: SETTING_LABELS.theme[value],
	iconId: THEME_ICONS[value],
}));
