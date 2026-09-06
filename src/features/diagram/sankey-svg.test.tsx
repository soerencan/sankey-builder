// @vitest-environment happy-dom

import { render } from "preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram, State } from "../../model/graph";
import { defaultState } from "../../model/graph";
import type { LinkColorMode } from "../../model/settings";
import { layoutDiagram } from "./layout";
import { SankeySvg } from "./sankey-svg";

// Memoization has no observable but its call count: an unchanged reference
// produces the same markup with or without it.
vi.mock("./layout", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./layout")>();
	return { ...actual, layoutDiagram: vi.fn(actual.layoutDiagram) };
});

function diagramOf(state: State): Diagram {
	return { nodes: state.nodes, links: state.links, settings: state.settings };
}

function mount(container: HTMLElement, diagram: Diagram | null): void {
	render(<SankeySvg diagram={diagram} />, container);
}

beforeEach(() => {
	document.body.innerHTML = "";
	vi.mocked(layoutDiagram).mockClear();
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
		const labels = Array.from(container.querySelectorAll("text"));
		expect(labels).toHaveLength(state.nodes.length);
		// export.ts recolors labels by selecting on this attribute.
		for (const label of labels) {
			expect(label.getAttribute("fill")).toBe("currentColor");
		}
		expect(container.querySelector("svg")?.getAttribute("role")).toBe("img");
		expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe("Sankey diagram");
	});

	it("renders nothing for a null diagram", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, null);

		expect(container.childNodes).toHaveLength(0);
	});

	it("renders nothing for zero nodes", () => {
		const state = defaultState();
		state.nodes = [];
		state.links = [];
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, diagramOf(state));

		expect(container.childNodes).toHaveLength(0);
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

		expect(container.childNodes).toHaveLength(0);
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

	it("lays out once for a repeated diagram reference and again for a new one", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		const diagram = diagramOf(defaultState());

		mount(container, diagram);
		mount(container, diagram);
		expect(layoutDiagram).toHaveBeenCalledTimes(1);

		mount(container, diagramOf(defaultState()));
		expect(layoutDiagram).toHaveBeenCalledTimes(2);
	});

	it("reuses the svg element and produces identical markup for an equal-content new reference", () => {
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
});
