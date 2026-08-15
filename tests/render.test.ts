// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createNodeColorResolver } from "../src/colors";
import { renderDiagram } from "../src/render";
import { defaultState } from "../src/state";
import { loadD3Global } from "./helpers/d3-global";

beforeAll(() => {
	loadD3Global();
});

beforeEach(() => {
	document.body.innerHTML = '<section id="diagram" aria-label="Sankey diagram"></section>';
});

describe("renderDiagram", () => {
	it("renders an SVG with node rects and link paths for the default graph", () => {
		const state = defaultState();
		const nodeColor = createNodeColorResolver(state);

		renderDiagram(state, nodeColor);

		const diagram = document.getElementById("diagram");
		expect(diagram?.querySelector("svg")).not.toBeNull();
		expect(diagram?.querySelectorAll("rect")).toHaveLength(state.nodes.length);
		expect(diagram?.querySelectorAll("path")).toHaveLength(state.links.length);
	});

	it("wires up per-link gradients in source-target link-color mode", () => {
		const state = defaultState();
		const nodeColor = createNodeColorResolver(state);

		renderDiagram(state, nodeColor);

		const diagram = document.getElementById("diagram");
		const gradients = diagram?.querySelectorAll("linearGradient");
		expect(gradients).toHaveLength(state.links.length);
		for (let index = 0; index < state.links.length; index++) {
			expect(diagram?.querySelector(`linearGradient#link-grad-${index}`)).not.toBeNull();
		}
		expect(diagram?.querySelector('path[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("empty-graph guard: clears the container and renders nothing for zero nodes", () => {
		const state = defaultState();
		state.nodes = [];
		state.links = [];
		const nodeColor = createNodeColorResolver(state);

		const diagram = document.getElementById("diagram");
		if (diagram) diagram.innerHTML = "<p>stale content</p>";

		expect(() => renderDiagram(state, nodeColor)).not.toThrow();

		expect(diagram?.innerHTML).toBe("");
		expect(diagram?.querySelector("svg")).toBeNull();
	});

	it("linkless-graph guard: clears the container and renders nothing for zero links", () => {
		const state = defaultState();
		state.links = [];
		const nodeColor = createNodeColorResolver(state);

		const diagram = document.getElementById("diagram");
		if (diagram) diagram.innerHTML = "<p>stale content</p>";

		expect(() => renderDiagram(state, nodeColor)).not.toThrow();

		expect(diagram?.innerHTML).toBe("");
		expect(diagram?.querySelector("svg")).toBeNull();
	});
});
