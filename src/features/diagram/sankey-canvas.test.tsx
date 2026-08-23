// @vitest-environment happy-dom

import { render } from "preact";
import { describe, expect, it, vi } from "vitest";
import { defaultState } from "../../model/graph";
import type { DiagramRenderRequest } from "./render";
import * as renderModule from "./render";
import { SankeyCanvas } from "./sankey-canvas";

function requestOf(state: ReturnType<typeof defaultState>): DiagramRenderRequest {
	return { state: { nodes: state.nodes, links: state.links, settings: state.settings } };
}

function mount(container: HTMLElement, request: DiagramRenderRequest | null): void {
	render(<SankeyCanvas request={request} />, container);
}

describe("SankeyCanvas", () => {
	it("renders exactly one host div and lets D3 own its descendants", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, requestOf(defaultState()));

		expect(container.querySelectorAll(".sankey-canvas")).toHaveLength(1);
		expect(container.querySelector(".sankey-canvas svg")).not.toBeNull();
	});

	it("renders a childless host when the request is null", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);

		mount(container, null);

		const host = container.querySelector(".sankey-canvas");
		expect(host).not.toBeNull();
		expect(host?.childElementCount).toBe(0);
	});

	// Preact effects are keyed on request identity, not on every commit — a
	// rerender with the *same* request (e.g. from an unrelated theme change)
	// must not re-run D3, so an existing element's identity and drawing work
	// both survive untouched.
	it("does not rerun D3 on a rerender with the same request identity", () => {
		const spy = vi.spyOn(renderModule, "renderDiagram");
		try {
			const container = document.createElement("div");
			document.body.appendChild(container);
			const request = requestOf(defaultState());

			mount(container, request);
			const svgBefore = container.querySelector("svg");
			expect(spy).toHaveBeenCalledTimes(1);

			mount(container, request);

			expect(spy).toHaveBeenCalledTimes(1);
			expect(container.querySelector("svg")).toBe(svgBefore);
		} finally {
			spy.mockRestore();
		}
	});

	it("redraws exactly once when given a new request identity", () => {
		const spy = vi.spyOn(renderModule, "renderDiagram");
		try {
			const container = document.createElement("div");
			document.body.appendChild(container);
			mount(container, requestOf(defaultState()));
			const svgBefore = container.querySelector("svg");

			mount(container, requestOf(defaultState()));

			expect(spy).toHaveBeenCalledTimes(2);
			expect(container.querySelector("svg")).not.toBe(svgBefore);
		} finally {
			spy.mockRestore();
		}
	});

	it("clears the host when the request transitions from non-null to null", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		mount(container, requestOf(defaultState()));
		expect(container.querySelector("svg")).not.toBeNull();

		mount(container, null);

		expect(container.querySelector("svg")).toBeNull();
	});

	it("clears the SVG from the DOM on unmount", () => {
		const container = document.createElement("div");
		document.body.appendChild(container);
		mount(container, requestOf(defaultState()));
		expect(container.querySelector("svg")).not.toBeNull();

		render(null, container);

		expect(container.querySelector("svg")).toBeNull();
		expect(container.querySelector(".sankey-canvas")).toBeNull();
	});
});
