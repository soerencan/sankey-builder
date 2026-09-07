import { describe, expect, it } from "vitest";
import type { Diagram } from "../../model/graph";
import { defaultState, moveNode } from "../../model/graph";
import { layoutDiagram } from "./layout";

function diagramOf(state: ReturnType<typeof defaultState>): Diagram {
	return { nodes: state.nodes, links: state.links, settings: state.settings };
}

describe("layoutDiagram", () => {
	it.each(["left", "right", "center", "justify"] as const)(
		"preserves node editor order within each column with %s alignment",
		(alignment) => {
			const state = defaultState();
			state.settings.alignment = alignment;
			state.nodes = ["a", "b", "c", "d"].map((id) => ({ id, name: id }));
			state.links = [
				{ id: "l1", source: "a", target: "d", value: 1 },
				{ id: "l2", source: "b", target: "c", value: 1 },
			];

			const columnOrder = () => {
				const nodes = layoutDiagram(diagramOf(state))?.nodes ?? [];
				return nodes
					.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0)
					.map((node) => node.id);
			};

			expect(columnOrder()).toEqual(["a", "b", "c", "d"]);
			moveNode(state, 1, 0);
			expect(columnOrder()).toEqual(["b", "a", "c", "d"]);
		},
	);

	it("returns null for zero nodes", () => {
		const state = defaultState();
		state.nodes = [];
		state.links = [];

		expect(layoutDiagram(diagramOf(state))).toBeNull();
	});

	it("returns null when every link is incomplete", () => {
		const state = defaultState();
		state.links = [
			{ id: "l1", source: "n1", target: null, value: 1 },
			{ id: "l2", source: null, target: null, value: 1 },
		];

		expect(layoutDiagram(diagramOf(state))).toBeNull();
	});

	it("returns null for zero links", () => {
		const state = defaultState();
		state.links = [];

		expect(layoutDiagram(diagramOf(state))).toBeNull();
	});

	it("positions every node and every complete link for the default graph", () => {
		const state = defaultState();

		const layout = layoutDiagram(diagramOf(state));

		expect(layout?.nodes).toHaveLength(state.nodes.length);
		expect(layout?.links).toHaveLength(state.links.length);
	});

	it("plots only complete links when the graph mixes complete and incomplete ones", () => {
		const state = defaultState();
		state.links.push({ id: "l4", source: "n1", target: null, value: 1 });

		const layout = layoutDiagram(diagramOf(state));

		expect(layout?.nodes).toHaveLength(4);
		expect(layout?.links).toHaveLength(3);
	});

	it("gives every link a positive width in proportion to its value", () => {
		const state = defaultState();

		const layout = layoutDiagram(diagramOf(state));
		const links = layout?.links ?? [];

		for (const link of links) {
			expect(link.width).toBeGreaterThan(0);
		}
		// One scale factor maps value to width; links 1 and 2 carry 6 and 14.
		expect(links[2].width / links[1].width).toBeCloseTo(14 / 6, 5);
	});

	it("keeps each link's source and target as the same node objects the nodes array exposes", () => {
		const state = defaultState();

		const layout = layoutDiagram(diagramOf(state));
		const nodes = layout?.nodes ?? [];
		const links = layout?.links ?? [];

		expect(links.length).toBeGreaterThan(0);
		for (const link of links) {
			expect(nodes).toContain(link.source);
			expect(nodes).toContain(link.target);
		}
	});

	it("gives every link a non-empty path starting with a moveto command", () => {
		const state = defaultState();

		const layout = layoutDiagram(diagramOf(state));

		for (const link of layout?.links ?? []) {
			expect(link.d.length).toBeGreaterThan(0);
			expect(link.d.startsWith("M")).toBe(true);
		}
	});

	it("sizes the viewBox and layout extent from the aspect ratio setting", () => {
		const state = defaultState();
		state.settings.aspectRatio = "2:1";
		const twoToOne = layoutDiagram(diagramOf(state));

		state.settings.aspectRatio = "3:1";
		const threeToOne = layoutDiagram(diagramOf(state));

		expect(twoToOne).toMatchObject({ width: 960, height: 480 });
		expect(threeToOne).toMatchObject({ width: 1440, height: 480 });

		const x1s = threeToOne?.nodes.map((n) => n.x1) ?? [];
		const x0s = threeToOne?.nodes.map((n) => n.x0) ?? [];
		expect(Math.max(...x1s)).toBeCloseTo(1439);
		expect(Math.min(...x0s)).toBeCloseTo(1);
	});

	it("selects the node-alignment function from the alignment setting", () => {
		// A -> B -> C -> E is the deepest chain (depth 0..3); A -> D -> F is a
		// shorter one (D at depth 1, F at depth 2). D has an outgoing link, so
		// "justify" places it by depth like "left" does (column 1). "right"
		// places it by height-from-sink instead (column 2), distinguishing it
		// from both. F has no outgoing links, so "justify" places it at the
		// last column (3) like "right" does, distinguishing it from "left"
		// (column 2).
		const state = defaultState();
		const diagram: Diagram = {
			nodes: [
				{ id: "a", name: "A" },
				{ id: "b", name: "B" },
				{ id: "c", name: "C" },
				{ id: "e", name: "E" },
				{ id: "d", name: "D" },
				{ id: "f", name: "F" },
			],
			links: [
				{ id: "l1", source: "a", target: "b", value: 1 },
				{ id: "l2", source: "b", target: "c", value: 1 },
				{ id: "l3", source: "c", target: "e", value: 1 },
				{ id: "l4", source: "a", target: "d", value: 1 },
				{ id: "l5", source: "d", target: "f", value: 1 },
			],
			settings: { ...state.settings, alignment: "left" },
		};

		const x0For = (alignment: Diagram["settings"]["alignment"], id: string) => {
			const layout = layoutDiagram({ ...diagram, settings: { ...diagram.settings, alignment } });
			return layout?.nodes.find((n) => n.id === id)?.x0;
		};

		const dLeft = x0For("left", "d");
		const dRight = x0For("right", "d");
		const dJustify = x0For("justify", "d");

		expect(dLeft).not.toBeUndefined();
		expect(dLeft).toBeLessThan(dRight ?? Number.NaN);
		expect(dLeft).toBeCloseTo(dJustify ?? Number.NaN);
		expect(dRight).not.toBeCloseTo(dJustify ?? Number.NaN);

		const fLeft = x0For("left", "f");
		const fJustify = x0For("justify", "f");

		expect(fLeft).not.toBeUndefined();
		expect(fLeft).toBeLessThan(fJustify ?? Number.NaN);
	});

	it("places every link's source column left of its target column", () => {
		const state = defaultState();

		const layout = layoutDiagram(diagramOf(state));

		for (const link of layout?.links ?? []) {
			expect(link.source.x1).toBeLessThan(link.target.x0);
		}
	});

	it("leaves the input deep-unchanged, since d3-sankey mutates its input in place", () => {
		const state = defaultState();
		const diagram = diagramOf(state);
		const before = structuredClone(diagram);

		layoutDiagram(diagram);

		expect(diagram).toStrictEqual(before);
	});
});
