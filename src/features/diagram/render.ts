import {
	sankey,
	sankeyCenter,
	sankeyJustify,
	sankeyLeft,
	sankeyLinkHorizontal,
	sankeyRight,
} from "d3-sankey";
import type { SankeyLink, SankeyNode } from "d3-sankey";
import { select } from "d3-selection";
import type { Link, Node } from "../../model/graph";
import { isComplete } from "../../model/graph";
import type { Alignment, DiagramSettings, LinkColorMode } from "../../model/settings";
import { aspectRatioOption } from "../../model/settings";
import { createNodeColorResolver } from "./colors";
import type { NodeColorResolver } from "./colors";

type CompleteLink = Link & { source: string; target: string };

/** A point-in-time view rather than the live `State`, so nothing the renderer calls can mutate domain data. */
export interface DiagramSnapshot {
	readonly nodes: readonly Readonly<Node>[];
	readonly links: readonly Readonly<Link>[];
	readonly settings: Readonly<DiagramSettings>;
}

/**
 * Wraps the snapshot so SankeyCanvas can key its redraw off reference
 * identity: the controller hands out a new request only when the graph is
 * valid, so an unchanged reference means "keep the last-valid SVG".
 */
export interface DiagramRenderRequest {
	readonly state: DiagramSnapshot;
}

// Not `Record<string, unknown>`: SankeyLink<N, L> is `L & SankeyLinkMinimal`,
// and `Link`, an interface without an index signature, can't satisfy that
// intersection. `object` has no index signature to satisfy.
type LinkExtra = object;

type SankeyGraphNode = SankeyNode<Node, LinkExtra>;
type SankeyGraphLink = SankeyLink<Node, LinkExtra>;

// @types/d3-sankey marks every layout-computed field optional. Post-layout
// they are always present, and `??` fallbacks would paper over a real
// layout bug.
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

const ALIGN_FNS: Partial<Record<Alignment, typeof sankeyJustify>> = {
	left: sankeyLeft,
	right: sankeyRight,
	center: sankeyCenter,
};

function alignFn(name: Alignment): typeof sankeyJustify {
	return ALIGN_FNS[name] ?? sankeyJustify;
}

/**
 * d3-sankey mutates its input (rewrites link endpoints to node objects, adds
 * layout fields), hence the copies. `Node` and `Link` are flat, so a spread
 * is a full copy.
 */
function layout(
	nodes: readonly Readonly<Node>[],
	sourceLinks: readonly CompleteLink[],
	alignment: Alignment,
	width: number,
	height: number,
): { nodes: LayoutNode[]; links: LayoutLink[] } {
	const working = {
		nodes: nodes.map((n) => ({ ...n })),
		links: sourceLinks.map((l) => ({ ...l })),
	};
	const graph = sankey<Node, LinkExtra>()
		.nodeId((d) => d.id)
		.nodeAlign(alignFn(alignment))
		.nodeWidth(15)
		.nodePadding(10)
		.extent([
			[1, 5],
			[width - 1, height - 5],
		])(working);
	return graph as unknown as { nodes: LayoutNode[]; links: LayoutLink[] };
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

	// d3-sankey throws a RangeError (`new Array(-1)`) on an empty node list.
	if (snapshot.nodes.length === 0) return;
	// With zero complete links d3-sankey produces NaN geometry instead of
	// throwing.
	const completeLinks = snapshot.links.filter(isComplete);
	if (completeLinks.length === 0) return;

	const nodeColor = createNodeColorResolver(snapshot.nodes, snapshot.settings.palette);
	const { width, height } = aspectRatioOption(snapshot.settings.aspectRatio);
	const { nodes, links } = layout(
		snapshot.nodes,
		completeLinks,
		snapshot.settings.alignment,
		width,
		height,
	);

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
		.attr("d", sankeyLinkHorizontal())
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
