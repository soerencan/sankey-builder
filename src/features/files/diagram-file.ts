import { normalizeLinks, normalizeNodes, normalizeSettings } from "../../model/codec";
import type { Diagram, State } from "../../model/graph";
import { isComplete, withoutLinkId } from "../../model/graph";

export type ImportResult =
	| { ok: true; diagram: Diagram; repairs: string[] }
	| { ok: false; error: string };

/**
 * Serializes to the bare {nodes, links, settings} export schema: complete links
 * only (incomplete rows are local working state and never travel), link ids
 * omitted (in-memory identity, not data), settings without theme,
 * pretty-printed for hand-editability.
 */
export function serializeState(state: State): string {
	const exported = {
		nodes: state.nodes,
		links: state.links.filter(isComplete).map(withoutLinkId),
		settings: {
			palette: state.settings.palette,
			linkColor: state.settings.linkColor,
			alignment: state.settings.alignment,
			aspectRatio: state.settings.aspectRatio,
		},
	};
	return JSON.stringify(exported, null, 2);
}

const NOT_JSON = "This file isn't valid JSON, so it can't be a diagram export.";
const NOT_A_DIAGRAM =
	'This file doesn\'t look like a diagram export (expected "nodes" and "links" arrays).';

/**
 * Parses an imported file leniently. The structural gate (valid JSON, plain
 * object, nodes/links arrays) hard-rejects unrelated files so an import can't
 * silently empty the diagram; field-level problems are repaired and reported
 * using the same normalizers the localStorage load path uses. Any `theme` key
 * in the file is ignored entirely — never applied, never a repair.
 */
export function parseImport(text: string): ImportResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, error: NOT_JSON };
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return { ok: false, error: NOT_A_DIAGRAM };
	}
	const obj = parsed as Record<string, unknown>;
	if (!Array.isArray(obj.nodes) || !Array.isArray(obj.links)) {
		return { ok: false, error: NOT_A_DIAGRAM };
	}

	const repairs: string[] = [];
	const nodes = normalizeNodes(obj.nodes, repairs);
	const nodeIds = new Set(nodes.map((n) => n.id));
	const links = normalizeLinks(obj.links, nodeIds, repairs);
	const normalized = normalizeSettings(obj.settings, repairs);
	const diagram: Diagram = {
		nodes,
		links,
		settings: {
			palette: normalized.palette,
			linkColor: normalized.linkColor,
			alignment: normalized.alignment,
			aspectRatio: normalized.aspectRatio,
		},
	};
	return { ok: true, diagram, repairs };
}
