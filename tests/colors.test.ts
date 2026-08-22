import { beforeAll, describe, expect, it } from "vitest";
import { createNodeColorResolver, isPaletteKey } from "../src/colors";
import { defaultState } from "../src/state";
import { loadD3Global } from "./helpers/d3-global";

beforeAll(() => {
	loadD3Global();
});

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

describe("createNodeColorResolver", () => {
	it("resolves the same node id to the same color across separate instances", () => {
		const state = defaultState();
		const first = createNodeColorResolver(state);
		const second = createNodeColorResolver(state);
		for (const node of state.nodes) {
			expect(first(node)).toBe(second(node));
		}
	});

	it("changes resolved colors when the active palette switches", () => {
		const state = defaultState();
		const observable10 = createNodeColorResolver(state);
		const before = state.nodes.map((n) => observable10(n));

		state.settings.palette = "dark2";
		const dark2 = createNodeColorResolver(state);
		const after = state.nodes.map((n) => dark2(n));

		expect(after).not.toEqual(before);
	});
});
