import { describe, expect, it } from "vitest";
import { PALETTE_LABELS, PALETTE_ORDER, isPaletteKey } from "../src/palette";

// No import from colors.ts in this file — palette.ts (unlike colors.ts) is
// d3-free at both module-eval and call time, same as persist.ts which
// depends on that.

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

describe("PALETTE_LABELS", () => {
	it("has a non-empty label for every palette key", () => {
		for (const key of PALETTE_ORDER) {
			expect(PALETTE_LABELS[key].length).toBeGreaterThan(0);
		}
	});
});
