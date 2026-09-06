import { describe, expect, it } from "vitest";
import { defaultState } from "../../model/graph";
import { createNodeColorResolver } from "./colors";

describe("createNodeColorResolver", () => {
	it("resolves the same node id to the same color across separate instances", () => {
		const state = defaultState();
		const first = createNodeColorResolver(state.nodes, state.settings.palette);
		const second = createNodeColorResolver(state.nodes, state.settings.palette);
		for (const node of state.nodes) {
			expect(first(node)).toBe(second(node));
		}
	});

	it("changes resolved colors when the active palette switches", () => {
		const state = defaultState();
		const observable10 = createNodeColorResolver(state.nodes, state.settings.palette);
		const before = state.nodes.map((n) => observable10(n));

		state.settings.palette = "dark2";
		const dark2 = createNodeColorResolver(state.nodes, state.settings.palette);
		const after = state.nodes.map((n) => dark2(n));

		expect(after).not.toEqual(before);
	});
});
