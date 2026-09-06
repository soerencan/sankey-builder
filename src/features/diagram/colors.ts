import { scaleOrdinal } from "d3-scale";
import type { Node } from "../../model/graph";
import type { Palette } from "../../model/settings";
import { paletteColors } from "../settings/palettes";

export type NodeColorResolver = (node: Node) => string;

/**
 * Built fresh per caller rather than a module-level singleton, which would
 * leak state across app instances. Takes nodes and palette rather than a
 * State so the mutable domain state and the renderer's snapshot both fit.
 */
export function createNodeColorResolver(
	nodes: readonly Readonly<Node>[],
	palette: Palette,
): NodeColorResolver {
	// An explicit domain keeps colors from reshuffling as nodes are added,
	// removed, or renamed.
	const scale = scaleOrdinal(
		nodes.map((n) => n.id),
		paletteColors(palette),
	);
	return (node) => scale(node.id);
}
