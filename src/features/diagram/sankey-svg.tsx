import { useMemo } from "preact/hooks";
import type { Diagram } from "../../model/graph";
import type { LinkColorMode } from "../../model/settings";
import { createNodeColorResolver } from "./colors";
import type { NodeColorResolver } from "./colors";
import { layoutDiagram } from "./layout";
import type { LayoutLink } from "./layout";

// Not imported from render.ts: that module is deleted once this renderer
// replaces it.
function linkStroke(mode: LinkColorMode, nodeColor: NodeColorResolver): (d: LayoutLink) => string {
	if (mode === "source") return (d) => nodeColor(d.source);
	if (mode === "target") return (d) => nodeColor(d.target);
	if (mode === "static") return () => "#aaa";
	return (d) => `url(#link-grad-${d.index})`;
}

export interface SankeySvgProps {
	diagram: Diagram | null;
}

/**
 * Renders the same markup `renderDiagram` draws with d3-selection, but as a
 * vnode tree: an unchanged `diagram` reference yields an identical tree, so
 * Preact leaves the DOM alone and the last-valid diagram stays on screen
 * while the graph is invalid.
 */
export function SankeySvg({ diagram }: SankeySvgProps) {
	const layout = useMemo(() => diagram && layoutDiagram(diagram), [diagram]);
	const nodeColor = useMemo(
		() => diagram && createNodeColorResolver(diagram.nodes, diagram.settings.palette),
		[diagram],
	);

	if (!diagram || !layout || !nodeColor) return null;
	const { width, height, nodes, links } = layout;
	const stroke = linkStroke(diagram.settings.linkColor, nodeColor);

	return (
		// biome-ignore lint/a11y/noSvgWithoutTitle: the host element carries the accessible name (see app.tsx's #diagram aria-label); this reproduces render.ts's markup exactly, attribute for attribute.
		<svg viewBox={`0 0 ${width} ${height}`}>
			{/* One <g> per link so the source-target mode can nest a per-link
			    <linearGradient> next to its <path>. Gradient ids use d3-sankey's
			    `link.index`, unique within a render. */}
			<g fill="none" stroke-opacity={0.5}>
				{links.map((link) => (
					<g key={link.index}>
						{diagram.settings.linkColor === "source-target" && (
							<linearGradient
								id={`link-grad-${link.index}`}
								gradientUnits="userSpaceOnUse"
								x1={link.source.x1}
								x2={link.target.x0}
							>
								<stop offset="0%" stop-color={nodeColor(link.source)} />
								<stop offset="100%" stop-color={nodeColor(link.target)} />
							</linearGradient>
						)}
						<path d={link.d} stroke={stroke(link)} stroke-width={Math.max(1, link.width)} />
					</g>
				))}
			</g>
			<g>
				{nodes.map((node) => (
					<rect
						key={node.id}
						x={node.x0}
						y={node.y0}
						width={node.x1 - node.x0}
						height={Math.max(1, node.y1 - node.y0)}
						fill={nodeColor(node)}
					/>
				))}
			</g>
			<g font-family="system-ui, sans-serif" font-size={10}>
				{nodes.map((node) => (
					<text
						key={node.id}
						x={node.x0 < width / 2 ? node.x1 + 6 : node.x0 - 6}
						y={(node.y0 + node.y1) / 2}
						dy="0.35em"
						text-anchor={node.x0 < width / 2 ? "start" : "end"}
						fill="currentColor"
					>
						{node.name}
					</text>
				))}
			</g>
		</svg>
	);
}
