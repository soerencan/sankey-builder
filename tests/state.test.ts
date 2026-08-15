import { describe, expect, it } from "vitest";
import { type State, addLink, addNode, defaultState, deleteNode, nextNodeId } from "../src/state";

describe("defaultState", () => {
	it("returns the starting graph and settings", () => {
		const state = defaultState();
		expect(state.nodes).toHaveLength(4);
		expect(state.links).toHaveLength(3);
		expect(state.settings).toEqual({
			palette: "observable10",
			colorMode: "auto",
			linkColor: "source-target",
			alignment: "justify",
			theme: "auto",
		});
	});
});

describe("nextNodeId", () => {
	it("returns n1 for an empty node list", () => {
		const state: State = { nodes: [], links: [], settings: defaultState().settings };
		expect(nextNodeId(state)).toBe("n1");
	});

	it("increments past the highest existing numeric suffix", () => {
		const state = defaultState();
		// Highest id among n1..n4 is n4.
		expect(nextNodeId(state)).toBe("n5");
	});

	it("survives hydration with gappy ids", () => {
		const state: State = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n7", name: "B" },
			],
			links: [],
			settings: defaultState().settings,
		};
		expect(nextNodeId(state)).toBe("n8");
	});

	it("ignores ids that don't match the n<number> pattern", () => {
		const state: State = {
			nodes: [{ id: "custom", name: "Custom" }],
			links: [],
			settings: defaultState().settings,
		};
		expect(nextNodeId(state)).toBe("n1");
	});

	it("assigns ids via addNode using the same suffix logic", () => {
		const state: State = { nodes: [], links: [], settings: defaultState().settings };
		addNode(state);
		addNode(state);
		expect(state.nodes.map((n) => n.id)).toEqual(["n1", "n2"]);
	});
});

describe("deleteNode", () => {
	it("prunes links referencing the deleted node as source or target", () => {
		const state = defaultState();
		// n3 (Electricity) is both a target (from n1, n2) and a source (to n4).
		deleteNode(state, "n3");
		expect(state.nodes.map((n) => n.id)).toEqual(["n1", "n2", "n4"]);
		expect(state.links).toEqual([]);
	});

	it("keeps links that don't reference the deleted node", () => {
		const state = defaultState();
		deleteNode(state, "n4");
		expect(state.links).toEqual([
			{ source: "n1", target: "n3", value: 10 },
			{ source: "n2", target: "n3", value: 6 },
		]);
	});
});

describe("addLink", () => {
	it("no-ops when fewer than two nodes exist", () => {
		const state: State = {
			nodes: [{ id: "n1", name: "A" }],
			links: [],
			settings: defaultState().settings,
		};
		addLink(state);
		expect(state.links).toEqual([]);
	});

	it("defaults to the first two distinct nodes and value 1", () => {
		const state: State = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			links: [],
			settings: defaultState().settings,
		};
		addLink(state);
		expect(state.links).toEqual([{ source: "n1", target: "n2", value: 1 }]);
	});
});
