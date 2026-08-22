// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { serializeDiagramSvg } from "../src/export";
import { DIAGRAM_HEIGHT, DIAGRAM_WIDTH } from "../src/render";

const SVG_NS = "http://www.w3.org/2000/svg";

// Mirrors the shape renderDiagram produces: a viewBox-only root, a
// currentColor label, and a link path — enough to exercise every
// transformation without depending on d3-sankey layout.
function buildFixture(): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
	svg.setAttribute("viewBox", `0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`);

	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", "M0,0L10,10");
	svg.appendChild(path);

	const text = document.createElementNS(SVG_NS, "text");
	text.setAttribute("fill", "currentColor");
	text.textContent = "Node A";
	svg.appendChild(text);

	document.body.appendChild(svg);
	return svg;
}

beforeEach(() => {
	document.body.innerHTML = "";
});

describe("serializeDiagramSvg", () => {
	it("includes the xml declaration, xmlns, and explicit pixel dimensions", () => {
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
		expect(xml).toContain(`xmlns="${SVG_NS}"`);
		expect(xml).toContain(`width="${DIAGRAM_WIDTH}"`);
		expect(xml).toContain(`height="${DIAGRAM_HEIGHT}"`);
	});

	it("prepends an opaque background rect as the first child", () => {
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "rgb(10, 20, 30)" });

		const parsed = new DOMParser().parseFromString(xml, "image/svg+xml");
		const root = parsed.documentElement;
		const firstChild = root.firstElementChild;
		expect(firstChild?.tagName).toBe("rect");
		expect(firstChild?.getAttribute("width")).toBe(String(DIAGRAM_WIDTH));
		expect(firstChild?.getAttribute("height")).toBe(String(DIAGRAM_HEIGHT));
		expect(firstChild?.getAttribute("fill")).toBe("rgb(10, 20, 30)");
	});

	it("replaces currentColor fills with the resolved label color", () => {
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml).not.toContain("currentColor");
		expect(xml).toContain('fill="#123456"');
	});

	it("declares xmlns exactly once", () => {
		// setAttribute("xmlns") plus XMLSerializer's own namespace handling is
		// engine-dependent; a duplicate attribute would make the file malformed XML.
		const svg = buildFixture();

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(xml.match(new RegExp(`xmlns="${SVG_NS}"`, "g"))).toHaveLength(1);
	});

	it("keeps nested gradient defs and their url() references intact", () => {
		// The source-target link mode nests per-link <linearGradient> elements
		// inside the svg, referenced by stroke="url(#id)" — the PNG slice's
		// rasterization depends on both surviving serialization.
		const svg = buildFixture();
		const gradient = document.createElementNS(SVG_NS, "linearGradient");
		gradient.setAttribute("id", "link-grad-0");
		svg.appendChild(gradient);
		const link = document.createElementNS(SVG_NS, "path");
		link.setAttribute("stroke", "url(#link-grad-0)");
		svg.appendChild(link);

		const xml = serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		const parsed = new DOMParser().parseFromString(xml, "image/svg+xml");
		expect(parsed.querySelector("linearGradient")?.getAttribute("id")).toBe("link-grad-0");
		expect(parsed.querySelector('[stroke="url(#link-grad-0)"]')).not.toBeNull();
	});

	it("does not mutate the live input svg", () => {
		const svg = buildFixture();

		serializeDiagramSvg(svg, { labelColor: "#123456", background: "#fff" });

		expect(svg.hasAttribute("width")).toBe(false);
		expect(svg.hasAttribute("height")).toBe(false);
		expect(svg.querySelector("rect")).toBeNull();
		expect(svg.querySelector("text")?.getAttribute("fill")).toBe("currentColor");
	});
});
