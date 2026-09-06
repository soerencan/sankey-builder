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

export function paletteColors(key: Palette): readonly string[] {
	return PALETTES[key];
}

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
		PALETTES[palette],
	);
	return (node) => scale(node.id);
}
