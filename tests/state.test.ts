import { describe, expect, it } from "vitest";
import {
	type State,
	addLink,
	addNode,
	defaultState,
	deleteNode,
	isComplete,
	nextNodeId,
} from "../src/state";

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

	it("prunes only links referencing the deleted id, leaving null endpoints untouched", () => {
		const state: State = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			links: [
				{ source: "n1", target: null, value: 1 },
				{ source: "n2", target: null, value: 2 },
				{ source: null, target: null, value: 3 },
			],
			settings: defaultState().settings,
		};
		deleteNode(state, "n1");
		expect(state.links).toEqual([
			{ source: "n2", target: null, value: 2 },
			{ source: null, target: null, value: 3 },
		]);
	});
});

describe("addLink", () => {
	it("creates an unassigned null/null/value-1 link", () => {
		const state: State = {
			nodes: [
				{ id: "n1", name: "A" },
				{ id: "n2", name: "B" },
			],
			links: [],
			settings: defaultState().settings,
		};
		addLink(state);
		expect(state.links).toEqual([{ source: null, target: null, value: 1 }]);
	});

	it("works at any node count, including zero nodes", () => {
		const state: State = { nodes: [], links: [], settings: defaultState().settings };
		addLink(state);
		expect(state.links).toEqual([{ source: null, target: null, value: 1 }]);
	});
});

describe("isComplete", () => {
	it("is true only when both endpoints are assigned", () => {
		expect(isComplete({ source: "n1", target: "n2", value: 1 })).toBe(true);
	});

	it("is false when the source is null", () => {
		expect(isComplete({ source: null, target: "n2", value: 1 })).toBe(false);
	});

	it("is false when the target is null", () => {
		expect(isComplete({ source: "n1", target: null, value: 1 })).toBe(false);
	});

	it("is false when both endpoints are null", () => {
		expect(isComplete({ source: null, target: null, value: 1 })).toBe(false);
	});
});
