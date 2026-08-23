import { schemeCategory10, schemeDark2, schemeObservable10, schemeSet2, schemeTableau10 } from "d3";
import { describe, expect, it } from "vitest";
import { defaultState } from "../../model/graph";
import { createNodeColorResolver, paletteColors } from "./colors";

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

describe("paletteColors", () => {
	it("returns the real d3 scheme array for each palette", () => {
		expect(paletteColors("observable10")).toEqual(schemeObservable10);
		expect(paletteColors("tableau10")).toEqual(schemeTableau10);
		expect(paletteColors("category10")).toEqual(schemeCategory10);
		expect(paletteColors("set2")).toEqual(schemeSet2);
		expect(paletteColors("dark2")).toEqual(schemeDark2);
	});
});
