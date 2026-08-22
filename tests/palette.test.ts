import { describe, expect, it } from "vitest";
import { PALETTE_LABELS, PALETTE_ORDER, isPaletteKey } from "../src/palette";

// No d3-global helper import in this file — palette.ts (unlike colors.ts) is
// d3-free at both module-eval and call time, same as persist.ts which
// depends on that.

describe("isPaletteKey", () => {
	it("accepts the five real palette keys", () => {
		for (const key of ["observable10", "tableau10", "category10", "set2", "dark2"]) {
			expect(isPaletteKey(key)).toBe(true);
		}
	});

	it("rejects a prototype-chain hole (e.g. toString)", () => {
		expect(isPaletteKey("toString")).toBe(false);
	});

	it("rejects an unrecognized string", () => {
		expect(isPaletteKey("rainbow")).toBe(false);
	});

	it("rejects non-strings", () => {
		expect(isPaletteKey(undefined)).toBe(false);
		expect(isPaletteKey(null)).toBe(false);
		expect(isPaletteKey(42)).toBe(false);
		expect(isPaletteKey({})).toBe(false);
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
