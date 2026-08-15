import type { SankeyLink, SankeyNode } from "d3-sankey";
import type { NodeColorResolver } from "./colors";
import type { Alignment, LinkColorMode, Node, State } from "./state";

export const DIAGRAM_WIDTH = 960;
export const DIAGRAM_HEIGHT = 480;

// No link fields beyond the ones d3-sankey's own SankeyLinkMinimal already
// declares (source/target/value) — the second type param exists for extras.
// `Record<string, unknown>` looks like the natural choice here but doesn't
// compile: SankeyLink<N, L> is `L & SankeyLinkMinimal<N, L>`, and assigning
// our plain `Link` into that intersection requires L's own index signature
// to be satisfied — `Link` (declared as an interface with no index
// signature) can't do that. `object`, the structurally-empty extras type,
// has no index signature to satisfy.
type LinkExtra = object;

// d3-sankey's own node/link types, before layout has run.
type SankeyGraphNode = SankeyNode<Node, LinkExtra>;
type SankeyGraphLink = SankeyLink<Node, LinkExtra>;

// @types/d3-sankey marks every layout-computed field optional, since it
// doesn't know layout() has already run by the time render code touches
// them. app.js leans on x0/x1/y0/y1/width/index/source/target being present
// unconditionally (no `??` fallbacks) — these aliases intersect in the
// non-optional shape so downstream code reads the same way app.js's does,
// without runtime fallbacks that would change behavior.
type LayoutNode = SankeyGraphNode & {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
};
type LayoutLink = Omit<SankeyGraphLink, "source" | "target"> & {
	source: LayoutNode;
	target: LayoutNode;
	width: number;
	index: number;
};

/**
 * Mirrors app.js's alignFn: a name-keyed lookup falling back to justify.
 * Rebuilt on every call (not hoisted to module scope) so nothing touches the
 * `d3` global at module-eval time.
 */
function alignFn(name: Alignment): typeof d3.sankeyJustify {
	const table: Partial<Record<Alignment, typeof d3.sankeyJustify>> = {
		left: d3.sankeyLeft,
		right: d3.sankeyRight,
		center: d3.sankeyCenter,
	};
	return table[name] ?? d3.sankeyJustify;
}

/**
 * Runs d3-sankey layout on a copy of the graph, since d3-sankey mutates
 * whatever it's given.
 */
function layout(state: State): { nodes: LayoutNode[]; links: LayoutLink[] } {
	const { nodes, links } = structuredClone({ nodes: state.nodes, links: state.links });
	const graph = d3
		.sankey<Node, LinkExtra>()
		.nodeId((d) => d.id)
		.nodeAlign(alignFn(state.settings.alignment))
		.nodeWidth(15)
		.nodePadding(10)
		.extent([
			[1, 5],
			[DIAGRAM_WIDTH - 1, DIAGRAM_HEIGHT - 5],
		])({ nodes, links });
	return graph as unknown as { nodes: LayoutNode[]; links: LayoutLink[] };
}

/**
 * Per-link stroke accessor for the given link-color mode. `source-target`
 * returns a gradient url referencing the per-link <linearGradient> that
 * renderDiagram appends (its id is keyed by d3-sankey's own `link.index`,
 * so it can't collide within a render).
 */
function linkStroke(mode: LinkColorMode, nodeColor: NodeColorResolver): (d: LayoutLink) => string {
	if (mode === "source") return (d) => nodeColor(d.source);
	if (mode === "target") return (d) => nodeColor(d.target);
	if (mode === "static") return () => "#aaa";
	return (d) => `url(#link-grad-${d.index})`;
}

export function renderDiagram(state: State, nodeColor: NodeColorResolver): void {
	const container = d3.select("#diagram");
	container.html("");

	// d3-sankey's internal bin-by-column step does `new Array(-1)` on an
	// empty node list, throwing RangeError before it ever gets to layout.
	if (state.nodes.length === 0) return;
	// Zero links collapses every node into a single column with zero value,
	// which d3-sankey turns into NaN geometry (0 * Infinity) rather than a
	// throw — nothing meaningful to draw anyway, so bail the same way.
	if (state.links.length === 0) return;

	const { nodes, links } = layout(state);

	const svg = container.append("svg").attr("viewBox", `0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`);

	// Paint order matches the reference example: link ribbons under node rects.
	// Each link gets its own <g> so the source-target mode can nest a
	// per-link <linearGradient> alongside its <path> (id-referenced by url()).
	const linkGroup = svg
		.append("g")
		.attr("fill", "none")
		.attr("stroke-opacity", 0.5)
		.selectAll("g")
		.data(links)
		.join("g");

	if (state.settings.linkColor === "source-target") {
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
		.attr("d", d3.sankeyLinkHorizontal())
		.attr("stroke", linkStroke(state.settings.linkColor, nodeColor))
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
		.attr("x", (d) => (d.x0 < DIAGRAM_WIDTH / 2 ? d.x1 + 6 : d.x0 - 6))
		.attr("y", (d) => (d.y0 + d.y1) / 2)
		.attr("dy", "0.35em")
		.attr("text-anchor", (d) => (d.x0 < DIAGRAM_WIDTH / 2 ? "start" : "end"))
		.attr("fill", "currentColor")
		.text((d) => d.name);
}
