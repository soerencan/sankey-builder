/**
 * Deliberately d3-free: features/settings/palettes.ts and
 * features/diagram/colors.ts depend on this module, not the reverse, so
 * storage validation never pulls d3 in.
 */

// The one table for every setting: its allowed values, and their display
// order. There is no second ordering anywhere else.
export const SETTING_DOMAINS = {
	palette: ["observable10", "tableau10", "category10", "set2", "dark2"],
	linkColor: ["source", "source-target", "target", "static"],
	alignment: ["left", "center", "right", "justify"],
	aspectRatio: ["a-series", "3:2", "16:9", "2:1", "3:1"],
	theme: ["auto", "light", "dark"],
} as const;

// `-readonly` strips the modifier this mapped type would otherwise inherit
// from SETTING_DOMAINS's `as const` tuples: Settings' fields are mutated in
// place (see graph.ts's State), unlike the domain table itself.
export type Settings = {
	-readonly [K in keyof typeof SETTING_DOMAINS]: (typeof SETTING_DOMAINS)[K][number];
};

export type Palette = Settings["palette"];
export type LinkColorMode = Settings["linkColor"];
export type Alignment = Settings["alignment"];
export type AspectRatio = Settings["aspectRatio"];
export type Theme = Settings["theme"];

export type DiagramSettingKey = Exclude<keyof Settings, "theme">;
export type DiagramSettings = Pick<Settings, DiagramSettingKey>;

/** The only place that knows theme is a per-browser preference and not diagram data. */
function isDiagramSettingKey(key: keyof Settings): key is DiagramSettingKey {
	return key !== "theme";
}

export const DIAGRAM_SETTING_KEYS: readonly DiagramSettingKey[] = (
	Object.keys(SETTING_DOMAINS) as (keyof Settings)[]
).filter(isDiagramSettingKey);

export function isSettingValue<K extends keyof Settings>(
	key: K,
	value: unknown,
): value is Settings[K] {
	const domain: readonly string[] = SETTING_DOMAINS[key];
	return typeof value === "string" && domain.includes(value);
}

export function pickDiagramSettings(settings: DiagramSettings): DiagramSettings {
	const picked = {} as DiagramSettings;
	for (const key of DIAGRAM_SETTING_KEYS) {
		assignSetting(picked, key, settings[key]);
	}
	return picked;
}

/**
 * TypeScript can't tell that `target[key]` and `value` share a type when
 * both are indexed by the same generic key; this narrows it once so callers
 * don't reach for `any`.
 */
export function assignSetting<K extends DiagramSettingKey>(
	target: DiagramSettings,
	key: K,
	value: DiagramSettings[K],
): void {
	target[key] = value;
}

// --- Aspect ratio ---

export interface AspectRatioOption {
	value: AspectRatio;
	width: number;
	height: number;
}

// A fixed logical height keeps typography, node width, and padding stable
// between presets. Integer widths make export dimensions predictable;
// A-series and 16:9 are rounded by less than one logical pixel.
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

export function aspectRatioOption(value: AspectRatio): AspectRatioOption {
	return ASPECT_RATIO_OPTIONS_BY_VALUE.get(value) as AspectRatioOption;
}

// --- Defaults ---

export const DEFAULT_SETTINGS: Settings = {
	palette: "observable10",
	linkColor: "source-target",
	alignment: "justify",
	aspectRatio: "2:1",
	theme: "auto",
};
