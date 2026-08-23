import { describe, expect, it } from "vitest";
import {
	ASPECT_RATIO_OPTIONS,
	DEFAULT_SETTINGS,
	PALETTE_ORDER,
	aspectRatioOption,
	isAlignment,
	isAspectRatio,
	isLinkColorMode,
	isPaletteKey,
	isTheme,
} from "./settings";

// No import from features/diagram/colors.ts in this file — settings.ts (unlike
// features/diagram/colors.ts) is d3-free at both module-eval and call time, same as
// platform/storage.ts which depends on that.

describe("isPaletteKey", () => {
	it.each<[unknown, boolean]>([
		["observable10", true],
		["tableau10", true],
		["category10", true],
		["set2", true],
		["dark2", true],
		// "toString" resolves via the Object.prototype chain on a naive `in`/property check.
		["toString", false],
		["rainbow", false],
		[undefined, false],
		[null, false],
		[42, false],
		[{}, false],
	])("isPaletteKey(%j) is %s", (input, expected) => {
		expect(isPaletteKey(input)).toBe(expected);
	});
});

describe("PALETTE_ORDER", () => {
	it("contains every palette key exactly once", () => {
		for (const key of ["observable10", "tableau10", "category10", "set2", "dark2"]) {
			expect(PALETTE_ORDER.filter((k) => k === key)).toHaveLength(1);
		}
		expect(PALETTE_ORDER).toHaveLength(5);
	});
});

describe("isLinkColorMode", () => {
	it.each<[unknown, boolean]>([
		["source", true],
		["target", true],
		["source-target", true],
		["static", true],
		["toString", false],
		["manual", false],
		[undefined, false],
		[null, false],
		[42, false],
		[{}, false],
	])("isLinkColorMode(%j) is %s", (input, expected) => {
		expect(isLinkColorMode(input)).toBe(expected);
	});
});

describe("isAlignment", () => {
	it.each<[unknown, boolean]>([
		["left", true],
		["right", true],
		["center", true],
		["justify", true],
		["toString", false],
		["top", false],
		[undefined, false],
		[null, false],
		[42, false],
		[{}, false],
	])("isAlignment(%j) is %s", (input, expected) => {
		expect(isAlignment(input)).toBe(expected);
	});
});

describe("isTheme", () => {
	it.each<[unknown, boolean]>([
		["auto", true],
		["light", true],
		["dark", true],
		["toString", false],
		["system", false],
		[undefined, false],
		[null, false],
		[42, false],
		[{}, false],
	])("isTheme(%j) is %s", (input, expected) => {
		expect(isTheme(input)).toBe(expected);
	});
});

describe("isAspectRatio", () => {
	it.each<[unknown, boolean]>([
		["a-series", true],
		["3:2", true],
		["16:9", true],
		["2:1", true],
		["3:1", true],
		["toString", false],
		["4:3", false],
		[undefined, false],
		[null, false],
		[42, false],
		[{}, false],
	])("isAspectRatio(%j) is %s", (input, expected) => {
		expect(isAspectRatio(input)).toBe(expected);
	});
});

describe("aspectRatioOption", () => {
	it("returns the matching option for every value in ASPECT_RATIO_OPTIONS", () => {
		for (const option of ASPECT_RATIO_OPTIONS) {
			expect(aspectRatioOption(option.value)).toBe(option);
		}
	});

	it("contains every aspect ratio value exactly once", () => {
		const values = ASPECT_RATIO_OPTIONS.map((option) => option.value);
		expect(new Set(values).size).toBe(values.length);
	});
});

describe("DEFAULT_SETTINGS", () => {
	it("matches the pre-consolidation defaults", () => {
		expect(DEFAULT_SETTINGS).toEqual({
			palette: "observable10",
			linkColor: "source-target",
			alignment: "justify",
			aspectRatio: "2:1",
			theme: "auto",
		});
	});
});
