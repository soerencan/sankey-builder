import { isComplete } from "./graph";
import type { State } from "./graph";

// d3-sankey multiplies y-coordinates by link values; near Number.MAX_VALUE
// that overflows into NaN geometry even though the value itself is finite.
// Capped far below that, with room for column sums of several such links.
export const MAX_LINK_VALUE = 1e15;

export interface ValidationResult {
	ok: boolean;
	error?: string;
}

/** Keeps d3-sankey's failure modes (throws on cycles/self-links, silent NaN geometry on bad values) from reaching layout. */
export function validate(state: State): ValidationResult {
	const nameById = new Map(state.nodes.map((n) => [n.id, n.name]));

	for (const [index, link] of state.links.entries()) {
		if (!isComplete(link)) continue;
		if (link.source === link.target) {
			// Safety net: the link editor's selects already make this unchoosable.
			return {
				ok: false,
				error: `A link cannot connect ${nameById.get(link.source) ?? link.source} to itself.`,
			};
		}
		if (!Number.isFinite(link.value) || link.value <= 0) {
			// The row number disambiguates duplicate links between the same pair.
			const sourceName = nameById.get(link.source) ?? link.source;
			const targetName = nameById.get(link.target) ?? link.target;
			return {
				ok: false,
				error: `Link ${index + 1} (${sourceName} to ${targetName}) needs a value greater than 0.`,
			};
		}
		if (link.value > MAX_LINK_VALUE) {
			const sourceName = nameById.get(link.source) ?? link.source;
			const targetName = nameById.get(link.target) ?? link.target;
			return {
				ok: false,
				error: `Link ${index + 1} (${sourceName} to ${targetName}) value is too large (maximum ${MAX_LINK_VALUE}).`,
			};
		}
	}

	const adjacency = new Map<string, string[]>();
	for (const link of state.links) {
		if (!isComplete(link)) continue;
		if (!adjacency.has(link.source)) adjacency.set(link.source, []);
		adjacency.get(link.source)?.push(link.target);
	}

	// `pathIndex` tracks the nodes on the current DFS path; reaching one of
	// them again, the path from it onward is the cycle reported.
	const visited = new Set<string>();
	const path: string[] = [];
	const pathIndex = new Map<string, number>();

	function visit(id: string): string[] | null {
		path.push(id);
		pathIndex.set(id, path.length - 1);
		visited.add(id);

		for (const next of adjacency.get(id) ?? []) {
			const nextIndex = pathIndex.get(next);
			if (nextIndex !== undefined) {
				return [...path.slice(nextIndex), next].map((nodeId) => nameById.get(nodeId) ?? nodeId);
			}
			if (!visited.has(next)) {
				const cycle = visit(next);
				if (cycle) return cycle;
			}
		}

		path.pop();
		pathIndex.delete(id);
		return null;
	}

	for (const node of state.nodes) {
		if (!visited.has(node.id)) {
			const cycle = visit(node.id);
			if (cycle) {
				return { ok: false, error: `This link would create a cycle: ${cycle.join(" → ")}` };
			}
		}
	}

	return { ok: true };
}
