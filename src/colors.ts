import {
	scaleOrdinal,
	schemeCategory10,
	schemeDark2,
	schemeObservable10,
	schemeSet2,
	schemeTableau10,
} from "d3";
import { isPaletteKey } from "./palette";
import type { Palette } from "./palette";
import type { Node, State } from "./state";

// Values are thunks, not the scheme arrays themselves, so a lookup by an
// unresolved palette key never evaluates the wrong scheme. Palette metadata
// (isPaletteKey, PALETTE_ORDER, PALETTE_LABELS) lives in ./palette instead,
// so persist.ts's pure-node palette validation never pulls this module — or
// the `d3` it imports — into its module graph.
const PALETTES: Record<Palette, () => readonly string[]> = {
	observable10: () => schemeObservable10,
	tableau10: () => schemeTableau10,
	category10: () => schemeCategory10,
	set2: () => schemeSet2,
	dark2: () => schemeDark2,
};

function activePalette(key: string): readonly string[] {
	return (isPaletteKey(key) ? PALETTES[key] : PALETTES.observable10)();
}

/**
 * The raw scheme array for a given palette, for building swatch strips.
 */
export function paletteColors(key: Palette): readonly string[] {
	return PALETTES[key]();
}

export type NodeColorResolver = (node: Node) => string;

/**
 * Built once per refresh pass and reused across the editors and the diagram,
 * rather than a module-level `currentColorScale` singleton (app.js:225) or
 * rebuilding an O(n) ordinal scale on every single lookup.
 */
export function createNodeColorResolver(state: State): NodeColorResolver {
	// Explicit domain (current node ids) so colors stay deterministic and
	// don't reshuffle as nodes are added/removed/renamed.
	const scale = scaleOrdinal(
		state.nodes.map((n) => n.id),
		activePalette(state.settings.palette),
	);
	// Single seam for palette switching — everything else calls the resolver
	// instead of touching a scale/state.settings.palette directly.
	return (node) => scale(node.id);
}
