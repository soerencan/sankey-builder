import { describe, expect, it } from "vitest";
import { defaultState, deleteNode, moveNode, renameNode } from "../../model/graph";
import { paletteColors } from "../settings/palettes";
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

	it("assigns the i-th node the i-th palette color", () => {
		const palette = "observable10";
		const colors = paletteColors(palette);
		const nodes = colors.map((_, i) => ({ id: `n${i}`, name: `Node ${i}` }));
		const resolve = createNodeColorResolver(nodes, palette);
		nodes.forEach((node, i) => {
			expect(resolve(node)).toBe(colors[i]);
		});
	});

	it("wraps around when there are more nodes than palette colors", () => {
		const palette = "observable10";
		const colors = paletteColors(palette);
		const nodes = Array.from({ length: colors.length + 1 }, (_, i) => ({
			id: `n${i}`,
			name: `Node ${i}`,
		}));
		const resolve = createNodeColorResolver(nodes, palette);

		expect(resolve(nodes[colors.length])).toBe(colors[0]);
	});

	it("resolves an id absent from the constructor's nodes to the first color", () => {
		const state = defaultState();
		const resolve = createNodeColorResolver(state.nodes, state.settings.palette);
		const colors = paletteColors(state.settings.palette);

		expect(resolve({ id: "unknown", name: "Unknown" })).toBe(colors[0]);
	});

	it("gives a duplicate node id the color of its first occurrence, and the next node the following index", () => {
		const palette = "observable10";
		const colors = paletteColors(palette);
		const nodes = [
			{ id: "a", name: "A" },
			{ id: "a", name: "A again" },
			{ id: "b", name: "B" },
		];
		const resolve = createNodeColorResolver(nodes, palette);

		expect(resolve(nodes[0])).toBe(colors[0]);
		expect(resolve(nodes[1])).toBe(colors[0]);
		expect(resolve(nodes[2])).toBe(colors[1]);
	});
});

it("keeps saved colors through reordering, renaming, and deletion", () => {
	const state = defaultState();
	const before = createNodeColorResolver(state.nodes, state.settings.palette);
	moveNode(state, 0, 3);
	renameNode(state, "n2", "Renamed");
	deleteNode(state, "n3");
	const after = createNodeColorResolver(state.nodes, state.settings.palette);
	for (const node of state.nodes) expect(after(node)).toBe(before(node));
});

it("keeps palette slots when switching to a shorter palette and back", () => {
	const nodes = [{ id: "a", name: "A", colorIndex: 9 }];
	expect(createNodeColorResolver(nodes, "dark2")(nodes[0])).toBe(paletteColors("dark2")[1]);
	expect(createNodeColorResolver(nodes, "observable10")(nodes[0])).toBe(
		paletteColors("observable10")[9],
	);
});
