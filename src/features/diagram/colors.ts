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
	// Keyed by id, not position, so colors don't reshuffle as nodes are
	// added, removed, or renamed. The codec doesn't dedupe imported node
	// ids, so a duplicate keeps the index (and color) of its first
	// occurrence rather than getting one of its own. An id outside `nodes`
	// can't occur in practice, since both callers resolve nodes from the
	// same list they built this resolver from; the `?? 0` is just a
	// fallback, not d3's implicit-domain append.
	const colors = paletteColors(palette);
	const index = new Map<string, number>();
	for (const node of nodes) {
		if (!index.has(node.id)) index.set(node.id, index.size);
	}
	return (node) => colors[(index.get(node.id) ?? 0) % colors.length];
}
