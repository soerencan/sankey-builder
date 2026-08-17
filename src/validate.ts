import type { State } from "./state";

// d3-sankey's relaxation passes multiply a y-coordinate (up to ~475) by a
// link's value; above ~Number.MAX_VALUE/475 (~3.8e305) that product overflows
// to Infinity and cascades into NaN geometry — even though the value itself
// is finite. Capped many orders of magnitude below that, with room to spare
// even after column sums of several such links.
export const MAX_LINK_VALUE = 1e15;

export interface ValidationResult {
	ok: boolean;
	error?: string;
}

export type LinkValueParse =
	| { kind: "empty" }
	| { kind: "valid"; value: number }
	| { kind: "invalid" };

// Plain decimal only: no sign, exponent, comma, or inner whitespace. "5." and
// ".5" are deliberately allowed (Number() reads them as 5 and 0.5).
const LINK_VALUE_RE = /^(\d+(\.\d*)?|\.\d+)$/;
const MAX_FRACTION_DIGITS = 4;

/**
 * Strict parse for the link-value text input, keeping NaN out of state
 * entirely. The fractional-digit cap is counted from the raw string, not the
 * parsed float, so trailing-zero precision ("0.00001") is rejected before it
 * rounds away — it's an input-format rule, not a value-magnitude one.
 */
export function parseLinkValue(raw: string): LinkValueParse {
	const trimmed = raw.trim();
	if (trimmed === "") return { kind: "empty" };
	if (!LINK_VALUE_RE.test(trimmed)) return { kind: "invalid" };

	const dot = trimmed.indexOf(".");
	if (dot !== -1 && trimmed.length - dot - 1 > MAX_FRACTION_DIGITS) {
		return { kind: "invalid" };
	}

	const value = Number(trimmed);
	if (!(value > 0) || value > MAX_LINK_VALUE) return { kind: "invalid" };
	return { kind: "valid", value };
}

/**
 * True when `raw` is a well-formed plain decimal whose fractional part exceeds
 * the 4-digit cap — the one invalid case the link editor intercepts at the
 * keystroke (maxlength-style) instead of merely highlighting after the fact.
 * Not trimmed: it inspects the raw prospective field value verbatim.
 */
export function exceedsFractionDigits(raw: string): boolean {
	if (!LINK_VALUE_RE.test(raw)) return false;
	const dot = raw.indexOf(".");
	return dot !== -1 && raw.length - dot - 1 > MAX_FRACTION_DIGITS;
}

/** Truncates (never rounds) a decimal's fractional part to the 4-digit cap. */
export function truncateFractionDigits(raw: string): string {
	const dot = raw.indexOf(".");
	return dot === -1 ? raw : raw.slice(0, dot + 1 + MAX_FRACTION_DIGITS);
}

/**
 * Pre-validates the graph so d3-sankey's failure modes (hard throws on
 * cycles/self-links, silent NaN geometry on bad values) never reach layout.
 */
export function validate(state: State): ValidationResult {
	const nameById = new Map(state.nodes.map((n) => [n.id, n.name]));

	for (const [index, link] of state.links.entries()) {
		if (link.source === link.target) {
			// Safety net only — the link-editor selects already make a self-link
			// impossible to choose.
			return {
				ok: false,
				error: `A link cannot connect ${nameById.get(link.source) ?? link.source} to itself.`,
			};
		}
		if (!Number.isFinite(link.value) || link.value <= 0) {
			// d3-sankey doesn't throw on NaN/zero values — it silently produces
			// NaN geometry, so this has to be caught here rather than at layout.
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
		if (!adjacency.has(link.source)) adjacency.set(link.source, []);
		adjacency.get(link.source)?.push(link.target);
	}

	// Standard DFS cycle detection with an explicit path stack: `pathIndex`
	// tracks nodes currently on the stack (gray), `visited` tracks nodes
	// fully explored (black). Hitting a gray node means the stack from that
	// point on IS the cycle, which we return directly for the error message.
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
