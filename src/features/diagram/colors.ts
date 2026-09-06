import { scaleOrdinal } from "d3-scale";
import {
	schemeCategory10,
	schemeDark2,
	schemeObservable10,
	schemeSet2,
	schemeTableau10,
} from "d3-scale-chromatic";
import type { Node } from "../../model/graph";
import type { Palette } from "../../model/settings";

const PALETTES: Record<Palette, readonly string[]> = {
	observable10: schemeObservable10,
	tableau10: schemeTableau10,
	category10: schemeCategory10,
	set2: schemeSet2,
	dark2: schemeDark2,
};

/**
 * The raw scheme array for a given palette, for building swatch strips.
 */
export function paletteColors(key: Palette): readonly string[] {
	return PALETTES[key];
}

export type NodeColorResolver = (node: Node) => string;

/**
 * Built fresh each time a caller needs one (the node editor projector and the
 * diagram renderer each build their own) rather than a module-level
 * singleton (which would leak state across app instances) — cheap because
 * it's an O(n) ordinal scale, and the explicit-domain construction below
 * makes any two resolvers built from the same nodes/palette interchangeable.
 * Takes nodes + palette rather than a whole `State`/snapshot so it works
 * unchanged for both the mutable domain state (editors) and the renderer's
 * readonly `DiagramSnapshot`.
 */
export function createNodeColorResolver(
	nodes: readonly Readonly<Node>[],
	palette: Palette,
): NodeColorResolver {
	// Explicit domain (current node ids) so colors stay deterministic and
	// don't reshuffle as nodes are added/removed/renamed.
	const scale = scaleOrdinal(
		nodes.map((n) => n.id),
		PALETTES[palette],
	);
	// Single seam for palette switching — everything else calls the resolver
	// instead of touching a scale/palette directly.
	return (node) => scale(node.id);
}
