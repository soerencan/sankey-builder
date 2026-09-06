/**
 * Every closed application-setting domain, each declared exactly once. D3-free —
 * features/diagram/colors.ts (which owns the actual d3 scheme arrays and ordinal-
 * scale construction) imports this module rather than the other way around, so
 * platform/storage.ts's validation stays d3-free too.
 */

// --- Palette ---

/** Display order for the toolbar carousel — also features/diagram/colors.ts's PALETTES' full key set. */
export const PALETTE_ORDER = ["observable10", "tableau10", "category10", "set2", "dark2"] as const;

export type Palette = (typeof PALETTE_ORDER)[number];

const PALETTE_KEYS: ReadonlySet<string> = new Set(PALETTE_ORDER);

/**
 * Own-property guard against the prototype chain (e.g. a palette key of
 * "toString" resolving to `Object.prototype.toString` instead of failing
 * the lookup). Backed by a set derived from PALETTE_ORDER, not a labels
 * map — presentation metadata lives in the settings feature's options module,
 * which this module must not depend on.
 */
export function isPaletteKey(key: unknown): key is Palette {
	return typeof key === "string" && PALETTE_KEYS.has(key);
}

// --- Link color mode ---

const LINK_COLOR_MODES = ["source", "target", "source-target", "static"] as const;
export type LinkColorMode = (typeof LINK_COLOR_MODES)[number];
const LINK_COLOR_MODE_SET: ReadonlySet<string> = new Set(LINK_COLOR_MODES);

export function isLinkColorMode(value: unknown): value is LinkColorMode {
	return typeof value === "string" && LINK_COLOR_MODE_SET.has(value);
}

// --- Alignment ---

/** Canonical value set — the rendered alignment buttons' set is contract-tested against this. */
export const ALIGNMENTS = ["left", "right", "center", "justify"] as const;
export type Alignment = (typeof ALIGNMENTS)[number];
const ALIGNMENT_SET: ReadonlySet<string> = new Set(ALIGNMENTS);

export function isAlignment(value: unknown): value is Alignment {
	return typeof value === "string" && ALIGNMENT_SET.has(value);
}

// --- Theme ---

const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
const THEME_SET: ReadonlySet<string> = new Set(THEMES);

export function isTheme(value: unknown): value is Theme {
	return typeof value === "string" && THEME_SET.has(value);
}

// --- Aspect ratio ---

export type AspectRatio = "a-series" | "3:2" | "16:9" | "2:1" | "3:1";

export interface AspectRatioOption {
	value: AspectRatio;
	width: number;
	height: number;
}

// A fixed logical height keeps typography, node width, and padding stable
// between presets. Integer widths make SVG and canvas export dimensions
// predictable; A-series and 16:9 are rounded by less than one logical pixel.
// Display labels live in the settings feature's options module's ASPECT_RATIO_LABELS.
export const ASPECT_RATIO_OPTIONS: readonly AspectRatioOption[] = [
	{ value: "a-series", width: 679, height: 480 },
	{ value: "3:2", width: 720, height: 480 },
	{ value: "16:9", width: 853, height: 480 },
	{ value: "2:1", width: 960, height: 480 },
	{ value: "3:1", width: 1440, height: 480 },
];

const ASPECT_RATIO_OPTIONS_BY_VALUE = new Map(
	ASPECT_RATIO_OPTIONS.map((option) => [option.value, option]),
);

export function isAspectRatio(value: unknown): value is AspectRatio {
	return typeof value === "string" && ASPECT_RATIO_OPTIONS_BY_VALUE.has(value as AspectRatio);
}

export function aspectRatioOption(value: AspectRatio): AspectRatioOption {
	// Every AspectRatio member has an entry, built from the same array above.
	return ASPECT_RATIO_OPTIONS_BY_VALUE.get(value) as AspectRatioOption;
}

// --- Settings ---

export interface Settings {
	palette: Palette;
	linkColor: LinkColorMode;
	alignment: Alignment;
	aspectRatio: AspectRatio;
	theme: Theme;
}

/** Excludes theme, a per-browser preference rather than diagram data. */
export type DiagramSettings = Omit<Settings, "theme">;

// --- Defaults ---

export const DEFAULT_SETTINGS: Settings = {
	palette: "observable10",
	linkColor: "source-target",
	alignment: "justify",
	aspectRatio: "2:1",
	theme: "auto",
};
