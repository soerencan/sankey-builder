// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { defaultState } from "../../model/graph";
import type { DiagramSnapshot } from "./render";
import { renderDiagram } from "./render";

function snapshotOf(state: ReturnType<typeof defaultState>): DiagramSnapshot {
	return { nodes: state.nodes, links: state.links, settings: state.settings };
}

beforeEach(() => {
	document.body.innerHTML = '<section id="diagram" aria-label="Sankey diagram"></section>';
});

describe("renderDiagram", () => {
	it("renders an SVG with node rects and link paths for the default graph", () => {
		const state = defaultState();
		const diagram = document.getElementById("diagram") as HTMLElement;

		renderDiagram(diagram, snapshotOf(state));

		expect(diagram.querySelector("svg")).not.toBeNull();
		expect(diagram.querySelectorAll("rect")).toHaveLength(state.nodes.length);
		expect(diagram.querySelectorAll("path")).toHaveLength(state.links.length);
	});

	it("uses the selected aspect ratio for the viewBox and layout extent", () => {
		const state = defaultState();
		state.settings.aspectRatio = "3:1";
		const diagram = document.getElementById("diagram") as HTMLElement;

		renderDiagram(diagram, snapshotOf(state));

		const svg = diagram.querySelector("svg");
		expect(svg?.getAttribute("viewBox")).toBe("0 0 1440 480");
		const rightmostNode = Math.max(
			...Array.from(
				diagram.querySelectorAll("svg rect"),
				(rect) => Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")),
			),
		);
		expect(rightmostNode).toBeCloseTo(1439);
	});

	it("wires up per-link gradients in source-target link-color mode", () => {
		const state = defaultState();
		const diagram = document.getElementById("diagram") as HTMLElement;

		renderDiagram(diagram, snapshotOf(state));

		const gradients = diagram.querySelectorAll("linearGradient");
		expect(gradients).toHaveLength(state.links.length);
		for (let index = 0; index < state.links.length; index++) {
			expect(diagram.querySelector(`linearGradient#link-grad-${index}`)).not.toBeNull();
		}
		expect(diagram.querySelector('path[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("plots only complete links when the graph mixes complete and incomplete ones", () => {
		const state = defaultState();
		// One extra row the user hasn't finished assigning.
		state.links.push({ id: "l4", source: "n1", target: null, value: 1 });
		const diagram = document.getElementById("diagram") as HTMLElement;

		renderDiagram(diagram, snapshotOf(state));

		expect(diagram.querySelector("svg")).not.toBeNull();
		expect(diagram.querySelectorAll("rect")).toHaveLength(4);
		expect(diagram.querySelectorAll("path")).toHaveLength(3);
	});

	it("linkless guard: renders nothing when every link is incomplete", () => {
		const state = defaultState();
		state.links = [
			{ id: "l1", source: "n1", target: null, value: 1 },
			{ id: "l2", source: null, target: null, value: 1 },
		];
		const diagram = document.getElementById("diagram") as HTMLElement;
		diagram.innerHTML = "<p>stale content</p>";

		expect(() => renderDiagram(diagram, snapshotOf(state))).not.toThrow();

		expect(diagram.innerHTML).toBe("");
		expect(diagram.querySelector("svg")).toBeNull();
	});

	it("empty-graph guard: clears the container and renders nothing for zero nodes", () => {
		const state = defaultState();
		state.nodes = [];
		state.links = [];
		const diagram = document.getElementById("diagram") as HTMLElement;
		diagram.innerHTML = "<p>stale content</p>";

		expect(() => renderDiagram(diagram, snapshotOf(state))).not.toThrow();

		expect(diagram.innerHTML).toBe("");
		expect(diagram.querySelector("svg")).toBeNull();
	});

	it("linkless-graph guard: clears the container and renders nothing for zero links", () => {
		const state = defaultState();
		state.links = [];
		const diagram = document.getElementById("diagram") as HTMLElement;
		diagram.innerHTML = "<p>stale content</p>";

		expect(() => renderDiagram(diagram, snapshotOf(state))).not.toThrow();

		expect(diagram.innerHTML).toBe("");
		expect(diagram.querySelector("svg")).toBeNull();
	});

	it("never clears or replaces the container element itself, only its descendants", () => {
		const state = defaultState();
		const diagram = document.getElementById("diagram") as HTMLElement;

		renderDiagram(diagram, snapshotOf(state));

		expect(document.getElementById("diagram")).toBe(diagram);
		expect(diagram.getAttribute("aria-label")).toBe("Sankey diagram");
	});

	it("leaves the request it was given deep-unchanged, since d3-sankey mutates its input in place", () => {
		const state = defaultState();
		const request = snapshotOf(state);
		const before = structuredClone(request);
		const diagram = document.getElementById("diagram") as HTMLElement;

		renderDiagram(diagram, request);

		expect(request).toStrictEqual(before);
	});
});
