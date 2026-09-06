import { select } from "d3-selection";
import type { LinkColorMode } from "../../model/settings";
import { createNodeColorResolver } from "./colors";
import type { NodeColorResolver } from "./colors";
import { layoutDiagram } from "./layout";
import type { DiagramSnapshot, LayoutLink } from "./layout";

/**
 * Wraps the snapshot so SankeyCanvas can key its redraw off reference
 * identity: the controller hands out a new request only when the graph is
 * valid, so an unchanged reference means "keep the last-valid SVG".
 */
export interface DiagramRenderRequest {
	readonly state: DiagramSnapshot;
}

function linkStroke(mode: LinkColorMode, nodeColor: NodeColorResolver): (d: LayoutLink) => string {
	if (mode === "source") return (d) => nodeColor(d.source);
	if (mode === "target") return (d) => nodeColor(d.target);
	if (mode === "static") return () => "#aaa";
	return (d) => `url(#link-grad-${d.index})`;
}

export function renderDiagram(container: HTMLElement, snapshot: DiagramSnapshot): void {
	const root = select(container);
	root.html("");

	const layout = layoutDiagram(snapshot);
	if (!layout) return;
	const { width, height, nodes, links } = layout;

	const nodeColor = createNodeColorResolver(snapshot.nodes, snapshot.settings.palette);

	const svg = root.append("svg").attr("viewBox", `0 0 ${width} ${height}`);

	// One <g> per link so the source-target mode can nest a per-link
	// <linearGradient> next to its <path>. Gradient ids use d3-sankey's
	// `link.index`, unique within a render.
	const linkGroup = svg
		.append("g")
		.attr("fill", "none")
		.attr("stroke-opacity", 0.5)
		.selectAll("g")
		.data(links)
		.join("g");

	if (snapshot.settings.linkColor === "source-target") {
		linkGroup
			.append("linearGradient")
			.attr("id", (d) => `link-grad-${d.index}`)
			.attr("gradientUnits", "userSpaceOnUse")
			.attr("x1", (d) => d.source.x1)
			.attr("x2", (d) => d.target.x0)
			.call((g) =>
				g
					.append("stop")
					.attr("offset", "0%")
					.attr("stop-color", (d) => nodeColor(d.source)),
			)
			.call((g) =>
				g
					.append("stop")
					.attr("offset", "100%")
					.attr("stop-color", (d) => nodeColor(d.target)),
			);
	}

	linkGroup
		.append("path")
		.attr("d", (d) => d.d)
		.attr("stroke", linkStroke(snapshot.settings.linkColor, nodeColor))
		.attr("stroke-width", (d) => Math.max(1, d.width));

	svg
		.append("g")
		.selectAll("rect")
		.data(nodes)
		.join("rect")
		.attr("x", (d) => d.x0)
		.attr("y", (d) => d.y0)
		.attr("width", (d) => d.x1 - d.x0)
		.attr("height", (d) => Math.max(1, d.y1 - d.y0))
		.attr("fill", (d) => nodeColor(d));

	svg
		.append("g")
		.attr("font-family", "system-ui, sans-serif")
		.attr("font-size", 10)
		.selectAll("text")
		.data(nodes)
		.join("text")
		.attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
		.attr("y", (d) => (d.y0 + d.y1) / 2)
		.attr("dy", "0.35em")
		.attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
		.attr("fill", "currentColor")
		.text((d) => d.name);
}
