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
	// Resolve by id so layout nodes and editor swatches share the saved slot.
	const colors = paletteColors(palette);
	const index = new Map<string, number>();
	for (const node of nodes) {
		if (!index.has(node.id)) index.set(node.id, node.colorIndex ?? index.size);
	}
	return (node) => colors[(index.get(node.id) ?? 0) % colors.length];
}
