import { DIAGRAM_HEIGHT, DIAGRAM_WIDTH } from "./render";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface SerializeSvgOptions {
	labelColor: string;
	background: string;
}

/**
 * Turns the live, on-screen diagram svg into a standalone document: explicit
 * pixel dimensions (the live svg only has a viewBox, which opens at an
 * arbitrary size in a bare viewer), currentColor labels resolved to a
 * concrete color (currentColor falls back to black outside the page), and an
 * opaque background rect (the live svg is transparent, relying on the page's
 * surface color showing through). Operates on a clone — never mutates the
 * svg passed in.
 */
export function serializeDiagramSvg(
	svg: SVGSVGElement,
	opts: { labelColor: string; background: string },
): string {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	clone.setAttribute("xmlns", SVG_NS);
	clone.setAttribute("width", String(DIAGRAM_WIDTH));
	clone.setAttribute("height", String(DIAGRAM_HEIGHT));

	for (const el of Array.from(clone.querySelectorAll('[fill="currentColor"]'))) {
		el.setAttribute("fill", opts.labelColor);
	}

	const background = clone.ownerDocument.createElementNS(SVG_NS, "rect");
	background.setAttribute("x", "0");
	background.setAttribute("y", "0");
	background.setAttribute("width", String(DIAGRAM_WIDTH));
	background.setAttribute("height", String(DIAGRAM_HEIGHT));
	background.setAttribute("fill", opts.background);
	clone.insertBefore(background, clone.firstChild);

	const xml = new XMLSerializer().serializeToString(clone);
	return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
}
