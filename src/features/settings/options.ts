/**
 * Presentation metadata for the setting domains. Depends on model/settings,
 * never the reverse, so the model stays free of user-facing strings.
 */

import type { Settings, Theme } from "../../model/settings";
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

export const THEME_ICONS: Record<Theme, string> = {
	auto: "icon-theme-system",
	light: "icon-theme-light",
	dark: "icon-theme-dark",
};

export interface PaletteChoice {
	value: Settings["palette"];
	label: string;
}

export const PALETTE_CHOICES: readonly PaletteChoice[] = SETTING_DOMAINS.palette.map((value) => ({
	value,
	label: SETTING_LABELS.palette[value],
}));

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
