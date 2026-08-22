import type { Node, Palette, State } from "./state";

// Values are thunks, not the scheme arrays themselves — resolving `d3.scheme*`
// only inside `activePalette()` (never at module-eval time) keeps this module
// importable with no `d3` global loaded, e.g. persist.ts's pure-node palette
// validation reuses `isPaletteKey` without pulling in the vendored UMD build.
const PALETTES: Record<Palette, () => readonly string[]> = {
	observable10: () => d3.schemeObservable10,
	tableau10: () => d3.schemeTableau10,
	category10: () => d3.schemeCategory10,
	set2: () => d3.schemeSet2,
	dark2: () => d3.schemeDark2,
};

/**
 * Own-property guard against the prototype chain (e.g. a palette key of
 * "toString" resolving to `Object.prototype.toString` instead of failing
 * the lookup) — mirrors app.js's `Object.hasOwn(PALETTES, ...)` checks
 * (app.js:96, 113).
 */
export function isPaletteKey(key: unknown): key is Palette {
	return typeof key === "string" && Object.hasOwn(PALETTES, key);
}

function activePalette(key: string): readonly string[] {
	return (isPaletteKey(key) ? PALETTES[key] : PALETTES.observable10)();
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
	const scale = d3.scaleOrdinal(
		state.nodes.map((n) => n.id),
		activePalette(state.settings.palette),
	);
	// Single seam for palette switching — everything else calls the resolver
	// instead of touching a scale/state.settings.palette directly.
	return (node) => scale(node.id);
}
