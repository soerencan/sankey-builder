import { converter, modeLrgb, useMode as registerColorSpace, wcagContrast } from "culori/fn";
import { describe, expect, it } from "vitest";
import { SETTING_DOMAINS } from "../../model/settings";
import { PALETTE_SIZE, paletteColors } from "./palettes";

registerColorSpace(modeLrgb);
const toOklch = converter("oklch");
const LEVELS = ["muted", "balanced", "vivid", "intense"] as const;
const EXPECTED_CHROMA = [0.4, 0.7, 0.85, 1];

describe("paletteColors", () => {
	it.each(SETTING_DOMAINS.palette)(
		"%s provides eight distinct export-compatible colors",
		(palette) => {
			const colors = paletteColors(palette);
			expect(colors).toHaveLength(PALETTE_SIZE);
			expect(new Set(colors).size).toBe(PALETTE_SIZE);
			for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
		},
	);

	it("increases chroma at each level while preserving each slot's hue and lightness", () => {
		for (let index = 0; index < PALETTE_SIZE; index++) {
			const colors = LEVELS.map((palette) => {
				const color = toOklch(paletteColors(palette)[index]);
				if (!color) throw new Error(`Invalid color in ${palette}`);
				return color;
			});
			const intense = colors[colors.length - 1];
			for (let level = 0; level < colors.length; level++) {
				const color = colors[level];
				expect(Math.abs(color.l - intense.l)).toBeLessThan(0.003);
				expect(Math.abs(color.c / intense.c - EXPECTED_CHROMA[level])).toBeLessThan(0.02);
				if (level > 0) expect(color.c).toBeGreaterThan(colors[level - 1].c);
				if (color.h === undefined || intense.h === undefined) {
					throw new Error("Chromatic colors must have hues");
				}
				const hueDifference = Math.abs(color.h - intense.h);
				expect(Math.min(hueDifference, 360 - hueDifference)).toBeLessThan(3);
			}
		}
	});

	it("spaces Grayscale evenly in perceived lightness from light to dark", () => {
		const levels = paletteColors("grayscale").map((hex) => {
			const color = toOklch(hex);
			if (!color) throw new Error("Invalid Grayscale color");
			return color.l;
		});
		const step = (levels[0] - levels[levels.length - 1]) / (PALETTE_SIZE - 1);
		for (let index = 1; index < levels.length; index++) {
			expect(levels[index]).toBeLessThan(levels[index - 1]);
			// Adjacent step lengths include two colors' 8-bit rounding errors.
			expect(Math.abs(levels[index - 1] - levels[index] - step)).toBeLessThan(0.004);
		}
	});

	it("uses neutral grays with enough separation from both theme backgrounds", () => {
		for (const hex of paletteColors("grayscale")) {
			const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
			expect(new Set(channels).size).toBe(1);
			for (const background of ["#ffffff", "#1c2026"]) {
				expect(wcagContrast(hex, background)).toBeGreaterThanOrEqual(1.9);
			}
		}
	});
});
