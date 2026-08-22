export type AspectRatio = "a-series" | "3:2" | "16:9" | "2:1" | "3:1";

export interface AspectRatioOption {
	value: AspectRatio;
	label: string;
	width: number;
	height: number;
}

// A fixed logical height keeps typography, node width, and padding stable
// between presets. Integer widths make SVG and canvas export dimensions
// predictable; A-series and 16:9 are rounded by less than one logical pixel.
export const ASPECT_RATIO_OPTIONS: readonly AspectRatioOption[] = [
	{ value: "a-series", label: "A-series", width: 679, height: 480 },
	{ value: "3:2", label: "3:2", width: 720, height: 480 },
	{ value: "16:9", label: "16:9", width: 853, height: 480 },
	{ value: "2:1", label: "2:1", width: 960, height: 480 },
	{ value: "3:1", label: "3:1", width: 1440, height: 480 },
];

const OPTIONS_BY_VALUE = new Map(ASPECT_RATIO_OPTIONS.map((option) => [option.value, option]));

export function isAspectRatio(value: unknown): value is AspectRatio {
	return typeof value === "string" && OPTIONS_BY_VALUE.has(value as AspectRatio);
}

export function aspectRatioOption(value: AspectRatio): AspectRatioOption {
	return OPTIONS_BY_VALUE.get(value) ?? (ASPECT_RATIO_OPTIONS[3] as AspectRatioOption);
}
