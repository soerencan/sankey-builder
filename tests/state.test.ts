import { describe, expect, it } from "vitest";
import {
	type Node,
	type State,
	addLink,
	addNode,
	defaultState,
	deleteNode,
	isComplete,
	moveLink,
	moveNode,
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

describe("moveNode", () => {
	function fourNodes(): State {
		const nodes: Node[] = [
			{ id: "n1", name: "A" },
			{ id: "n2", name: "B" },
			{ id: "n3", name: "C" },
			{ id: "n4", name: "D" },
		];
		return { nodes, links: [], settings: defaultState().settings };
	}
	const ids = (state: State) => state.nodes.map((n) => n.id);

	it("moves a node forward", () => {
		const state = fourNodes();
		moveNode(state, 0, 2);
		expect(ids(state)).toEqual(["n2", "n3", "n1", "n4"]);
	});

	it("moves a node backward", () => {
		const state = fourNodes();
		moveNode(state, 3, 1);
		expect(ids(state)).toEqual(["n1", "n4", "n2", "n3"]);
	});

	it("clamps a too-high destination to the last index", () => {
		const state = fourNodes();
		moveNode(state, 0, 99);
		expect(ids(state)).toEqual(["n2", "n3", "n4", "n1"]);
	});

	it("clamps a negative destination to the first index", () => {
		const state = fourNodes();
		moveNode(state, 3, -5);
		expect(ids(state)).toEqual(["n4", "n1", "n2", "n3"]);
	});

	it("clamps a too-high source", () => {
		const state = fourNodes();
		moveNode(state, 99, 0);
		expect(ids(state)).toEqual(["n4", "n1", "n2", "n3"]);
	});

	it("is a no-op when source and destination resolve to the same index", () => {
		const state = fourNodes();
		moveNode(state, 1, 1);
		expect(ids(state)).toEqual(["n1", "n2", "n3", "n4"]);
	});

	it("is a no-op for a single-item array", () => {
		const state: State = {
			nodes: [{ id: "n1", name: "A" }],
			links: [],
			settings: defaultState().settings,
		};
		moveNode(state, 0, 1);
		expect(ids(state)).toEqual(["n1"]);
	});

	it("is a no-op for an empty array", () => {
		const state: State = { nodes: [], links: [], settings: defaultState().settings };
		expect(() => moveNode(state, 0, 1)).not.toThrow();
		expect(state.nodes).toEqual([]);
	});
});

describe("moveLink", () => {
	it("reorders links, forward and backward", () => {
		const state = defaultState();
		// Default links: n1->n3 (10), n2->n3 (6), n3->n4 (14).
		moveLink(state, 0, 2);
		expect(state.links.map((l) => l.value)).toEqual([6, 14, 10]);
		moveLink(state, 2, 0);
		expect(state.links.map((l) => l.value)).toEqual([10, 6, 14]);
	});

	it("clamps out-of-range indices and no-ops on same index", () => {
		const state = defaultState();
		moveLink(state, 0, 99);
		expect(state.links.map((l) => l.value)).toEqual([6, 14, 10]);
		moveLink(state, 1, 1);
		expect(state.links.map((l) => l.value)).toEqual([6, 14, 10]);
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
