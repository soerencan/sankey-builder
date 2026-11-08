import {
	clampChroma,
	formatHex,
	modeOklch,
	modeRgb,
	useMode as registerColorSpace,
} from "culori/fn";
import openColor from "open-color";
import type { Palette } from "../../model/settings";

registerColorSpace(modeRgb);
const toOklch = registerColorSpace(modeOklch);

export const PALETTE_SIZE = 8;

// Fixed hues and lightness values preserve each colored slot's identity.
const BASE_COLORS = [
	[openColor.blue[6], 0.57],
	[openColor.orange[6], 0.72],
	[openColor.teal[6], 0.66],
	[openColor.grape[6], 0.54],
	[openColor.red[6], 0.6],
	[openColor.lime[7], 0.78],
	[openColor.pink[5], 0.69],
	[openColor.yellow[4], 0.75],
] as const;

// Find each hue's sRGB limit before scaling chroma. Clipping RGB channels
// after scaling could change the hue and lightness at the vivid end.
const MAXIMUM_COLORS = BASE_COLORS.map(([hex, lightness]) => {
	const color = toOklch(hex);
	if (!color) throw new Error(`Invalid base palette color: ${hex}`);
	return clampChroma({ ...color, l: lightness, c: 0.4 }, "oklch");
});

function withSaturation(saturation: number): readonly string[] {
	return MAXIMUM_COLORS.map((color) => formatHex({ ...color, c: color.c * saturation }));
}

function grayscaleRamp(): readonly string[] {
	// Midtone endpoints keep the ramp visible against both page themes.
	const light = 0.78;
	const dark = 0.54;
	return Array.from({ length: PALETTE_SIZE }, (_, index) =>
		formatHex({
			mode: "oklch",
			l: light + ((dark - light) * index) / (PALETTE_SIZE - 1),
			c: 0,
			h: 0,
		}),
	);
}

const PALETTES: Record<Palette, readonly string[]> = {
	grayscale: grayscaleRamp(),
	muted: withSaturation(0.4),
	balanced: withSaturation(0.7),
	vivid: withSaturation(0.85),
	intense: withSaturation(1),
};

export function paletteColors(key: Palette): readonly string[] {
	return PALETTES[key];
}
