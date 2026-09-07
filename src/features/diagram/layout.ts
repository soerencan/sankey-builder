import {
	sankey,
	sankeyCenter,
	sankeyJustify,
	sankeyLeft,
	sankeyLinkHorizontal,
	sankeyRight,
} from "d3-sankey";
import type { SankeyLink, SankeyNode } from "d3-sankey";
import type { CompleteLink, Diagram, Node } from "../../model/graph";
import { isComplete } from "../../model/graph";
import type { Alignment } from "../../model/settings";
import { aspectRatioOption } from "../../model/settings";

// Not `Record<string, unknown>`: SankeyLink<N, L> is `L & SankeyLinkMinimal`,
// and `Link`, an interface without an index signature, can't satisfy that
// intersection. `object` has no index signature to satisfy.
type LinkExtra = object;

type SankeyGraphNode = SankeyNode<Node, LinkExtra>;
type SankeyGraphLink = SankeyLink<Node, LinkExtra>;

// @types/d3-sankey marks every layout-computed field optional. Post-layout
// they are always present, and `??` fallbacks would paper over a real
// layout bug.
type PositionedNode = SankeyGraphNode & {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
};
type PositionedLink = Omit<SankeyGraphLink, "source" | "target"> & {
	source: PositionedNode;
	target: PositionedNode;
	width: number;
	index: number;
};

const ALIGN_FNS: Record<Alignment, typeof sankeyJustify> = {
	left: sankeyLeft,
	right: sankeyRight,
	center: sankeyCenter,
	justify: sankeyJustify,
};

export interface LayoutNode {
	id: string;
	name: string;
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

export interface LayoutLink {
	index: number;
	source: LayoutNode;
	target: LayoutNode;
	width: number;
	d: string;
}

export interface SankeyLayout {
	width: number;
	height: number;
	nodes: LayoutNode[];
	links: LayoutLink[];
}

function toLayoutNode(node: PositionedNode): LayoutNode {
	const { id, name, x0, x1, y0, y1 } = node;
	return { id, name, x0, x1, y0, y1 };
}

/**
 * Positions nodes and links for the given diagram, returning plain data the
 * caller can draw without recomputing anything. `null` when there is nothing
 * to draw: d3-sankey throws a RangeError (`new Array(-1)`) on an empty node
 * list, and produces NaN geometry rather than throwing on zero complete
 * links.
 */
export function layoutDiagram(diagram: Readonly<Diagram>): SankeyLayout | null {
	if (diagram.nodes.length === 0) return null;
	const completeLinks: CompleteLink[] = diagram.links.filter(isComplete);
	if (completeLinks.length === 0) return null;

	const { width, height } = aspectRatioOption(diagram.settings.aspectRatio);

	// d3-sankey mutates its input (rewrites link endpoints to node objects,
	// adds layout fields), hence the copies. `Node` and `Link` are flat, so a
	// spread is a full copy.
	const working = {
		nodes: diagram.nodes.map((n) => ({ ...n })),
		links: completeLinks.map((l) => ({ ...l })),
	};
	const graph = sankey<Node, LinkExtra>()
		.nodeId((d) => d.id)
		.nodeAlign(ALIGN_FNS[diagram.settings.alignment])
		// Preserve editor order within each column while D3 computes positions.
		.nodeSort(null)
		// Preserve link editor order at both incoming and outgoing endpoints.
		.linkSort(null)
		.nodeWidth(15)
		.nodePadding(10)
		.extent([
			[1, 5],
			[width - 1, height - 5],
		])(working) as unknown as { nodes: PositionedNode[]; links: PositionedLink[] };

	// Links reference the same LayoutNode objects the nodes array exposes,
	// not fresh copies per endpoint, so consumers can compare a link's
	// endpoints to a node by identity.
	const byPositioned = new Map(graph.nodes.map((n) => [n, toLayoutNode(n)]));
	const nodes = [...byPositioned.values()];

	function lookup(node: PositionedNode): LayoutNode {
		const found = byPositioned.get(node);
		if (!found) throw new Error("layoutDiagram: link endpoint missing from positioned nodes");
		return found;
	}

	const pathGenerator = sankeyLinkHorizontal<Node, LinkExtra>();
	return {
		width,
		height,
		nodes,
		links: graph.links.map((link) => ({
			index: link.index,
			source: lookup(link.source),
			target: lookup(link.target),
			width: link.width,
			// d3-shape declares `string | null`, but the horizontal curve
			// never yields an empty path, so the fallback only satisfies
			// the type; it is unreachable.
			d: pathGenerator(link) ?? "",
		})),
	};
}
