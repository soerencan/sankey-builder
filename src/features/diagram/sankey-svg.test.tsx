// @vitest-environment happy-dom

import { render } from "preact";
import { beforeEach, describe, expect, it } from "vitest";
import type { Diagram, State } from "../../model/graph";
import { defaultState } from "../../model/graph";
import type { LinkColorMode } from "../../model/settings";
import { renderDiagram } from "./render";
import { SankeySvg } from "./sankey-svg";

function diagramOf(state: State): Diagram {
	return { nodes: state.nodes, links: state.links, settings: state.settings };
}

function mount(container: HTMLElement, diagram: Diagram | null): void {
	render(<SankeySvg diagram={diagram} />, container);
}

/**
 * Reduces an element subtree to tag names, sorted attribute lists, and text,
 * in document order, so the two renderers can be compared for equivalence
 * without depending on happy-dom's attribute ordering or on which of them
 * happened to build the DOM.
 */
function canonical(root: Element): unknown {
	function describe(el: Element): unknown {
		const attrs = Array.from(el.attributes)
			.map((a) => [a.name, a.value] as const)
			.sort(([a], [b]) => a.localeCompare(b));
		const children = Array.from(el.children).map(describe);
		const text = el.children.length === 0 ? (el.textContent ?? "") : "";
		return { tag: el.tagName.toLowerCase(), attrs, text, children };
	}
	return describe(root);
}

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("SankeySvg", () => {
	it("renders an SVG with node rects, link paths, and labels for the default graph", () => {
		const state = defaultState();
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, diagramOf(state));

		expect(container.querySelectorAll("svg")).toHaveLength(1);
		expect(container.querySelectorAll("rect")).toHaveLength(state.nodes.length);
		expect(container.querySelectorAll("path")).toHaveLength(state.links.length);
		expect(container.querySelectorAll("text")).toHaveLength(state.nodes.length);
	});

	it("renders nothing for a null diagram", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, null);

		expect(container.querySelector("svg")).toBeNull();
	});

	it("renders nothing for zero nodes", () => {
		const state = defaultState();
		state.nodes = [];
		state.links = [];
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, diagramOf(state));

		expect(container.querySelector("svg")).toBeNull();
	});

	it("renders nothing when every link is incomplete", () => {
		const state = defaultState();
		state.links = [
			{ id: "l1", source: "n1", target: null, value: 1 },
			{ id: "l2", source: null, target: null, value: 1 },
		];
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, diagramOf(state));

		expect(container.querySelector("svg")).toBeNull();
	});

	describe.each<LinkColorMode>(["source", "source-target", "target", "static"])(
		"link color mode %s",
		(linkColor) => {
			it("wires up strokes and gradients as expected", () => {
				const state = defaultState();
				state.settings.linkColor = linkColor;
				const container = document.createElement("div");
				document.body.appendChild(container);

				mount(container, diagramOf(state));

				const gradients = container.querySelectorAll("linearGradient");
				const paths = Array.from(container.querySelectorAll("path"));

				if (linkColor === "source-target") {
					expect(gradients).toHaveLength(state.links.length);
					for (let index = 0; index < state.links.length; index++) {
						const gradient = container.querySelector(`linearGradient#link-grad-${index}`);
						expect(gradient).not.toBeNull();
						expect(gradient?.querySelectorAll("stop")).toHaveLength(2);
					}
					for (const path of paths) {
						expect(path.getAttribute("stroke")).toMatch(/^url\(#link-grad-\d+\)$/);
					}
				} else {
					expect(gradients).toHaveLength(0);
					const expectedStroke = linkColor === "static" ? "#aaa" : undefined;
					for (const path of paths) {
						const stroke = path.getAttribute("stroke");
						expect(stroke).not.toBeNull();
						if (expectedStroke) expect(stroke).toBe(expectedStroke);
					}
				}
			});
		},
	);

	it("keeps the same svg element and markup on a rerender with the same diagram reference", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const diagram = diagramOf(defaultState());

		mount(container, diagram);
		const svgBefore = container.querySelector("svg");
		const markupBefore = svgBefore?.outerHTML;

		mount(container, diagram);

		expect(container.querySelector("svg")).toBe(svgBefore);
		expect(container.querySelector("svg")?.outerHTML).toBe(markupBefore);
	});

	it("reuses the svg element but updates markup on a rerender with an equal-content new reference", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, diagramOf(defaultState()));
		const svgBefore = container.querySelector("svg");
		const markupBefore = svgBefore?.outerHTML;

		mount(container, diagramOf(defaultState()));

		expect(container.querySelector("svg")).toBe(svgBefore);
		expect(container.querySelector("svg")?.outerHTML).toBe(markupBefore);
	});

	it("changes markup when a diagram setting changes on a new reference", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, diagramOf(defaultState()));
		const markupBefore = container.querySelector("svg")?.outerHTML;

		// The default graph's depths are fixed regardless of alignment, so
		// alignment alone wouldn't move a pixel; palette reliably repaints.
		const changed = defaultState();
		changed.settings.palette = "tableau10";
		mount(container, diagramOf(changed));

		expect(container.querySelector("svg")?.outerHTML).not.toBe(markupBefore);
	});

	describe("parity with renderDiagram", () => {
		const linkColors: LinkColorMode[] = ["source", "source-target", "target", "static"];
		const aspectRatios: Array<State["settings"]["aspectRatio"]> = ["a-series", "16:9"];

		for (const linkColor of linkColors) {
			for (const aspectRatio of aspectRatios) {
				it(`matches for linkColor=${linkColor} aspectRatio=${aspectRatio}`, () => {
					const state = defaultState();
					state.settings.linkColor = linkColor;
					state.settings.aspectRatio = aspectRatio;

					const preactContainer = document.createElement("div");
					document.body.appendChild(preactContainer);
					mount(preactContainer, diagramOf(state));
					const preactSvg = preactContainer.querySelector("svg");
					expect(preactSvg).not.toBeNull();

					const d3Host = document.createElement("div");
					document.body.appendChild(d3Host);
					renderDiagram(d3Host, diagramOf(state));
					const d3Svg = d3Host.querySelector("svg");
					expect(d3Svg).not.toBeNull();

					expect(canonical(preactSvg as Element)).toEqual(canonical(d3Svg as Element));
				});
			}
		}
	});
});
