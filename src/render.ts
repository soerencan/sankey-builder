import { select } from "d3";
import {
	sankey,
	sankeyCenter,
	sankeyJustify,
	sankeyLeft,
	sankeyLinkHorizontal,
	sankeyRight,
} from "d3-sankey";
import type { SankeyLink, SankeyNode } from "d3-sankey";
import { aspectRatioOption } from "./aspect-ratio";
import type { NodeColorResolver } from "./colors";
import type { Alignment, Link, LinkColorMode, Node, State } from "./state";
import { isComplete } from "./state";

// A link with both endpoints assigned — the only kind d3-sankey ever lays out.
type CompleteLink = Link & { source: string; target: string };

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
// them. The pre-migration bundle leaned on x0/x1/y0/y1/width/index/source/
// target being present unconditionally (no `??` fallbacks) — these aliases
// intersect in the non-optional shape so downstream code reads the same way,
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

// Mirrors the pre-migration bundle's alignFn: a name-keyed lookup falling
// back to justify.
const ALIGN_FNS: Partial<Record<Alignment, typeof sankeyJustify>> = {
	left: sankeyLeft,
	right: sankeyRight,
	center: sankeyCenter,
};

function alignFn(name: Alignment): typeof sankeyJustify {
	return ALIGN_FNS[name] ?? sankeyJustify;
}

/**
 * Runs d3-sankey layout on a copy of the graph, since d3-sankey mutates
 * whatever it's given.
 */
function layout(
	state: State,
	sourceLinks: CompleteLink[],
	width: number,
	height: number,
): { nodes: LayoutNode[]; links: LayoutLink[] } {
	const { nodes, links } = structuredClone({ nodes: state.nodes, links: sourceLinks });
	const graph = sankey<Node, LinkExtra>()
		.nodeId((d) => d.id)
		.nodeAlign(alignFn(state.settings.alignment))
		.nodeWidth(15)
		.nodePadding(10)
		.extent([
			[1, 5],
			[width - 1, height - 5],
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

export function renderDiagram(doc: Document, state: State, nodeColor: NodeColorResolver): void {
	const container = select(doc.getElementById("diagram"));
	container.html("");

	// d3-sankey's internal bin-by-column step does `new Array(-1)` on an
	// empty node list, throwing RangeError before it ever gets to layout.
	if (state.nodes.length === 0) return;
	// Only complete links have geometry; incomplete ones are omitted. Zero
	// complete links collapses every node into a single column with zero value,
	// which d3-sankey turns into NaN geometry (0 * Infinity) rather than a
	// throw — nothing meaningful to draw anyway, so bail the same way.
	const completeLinks = state.links.filter(isComplete);
	if (completeLinks.length === 0) return;

	const { width, height } = aspectRatioOption(state.settings.aspectRatio);
	const { nodes, links } = layout(state, completeLinks, width, height);

	const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`);

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
		.attr("d", sankeyLinkHorizontal())
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
		.attr("x", (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
		.attr("y", (d) => (d.y0 + d.y1) / 2)
		.attr("dy", "0.35em")
		.attr("text-anchor", (d) => (d.x0 < width / 2 ? "start" : "end"))
		.attr("fill", "currentColor")
		.text((d) => d.name);
}
