import { isRawDiagram, normalizeDiagram } from "../../model/codec";
import type { Diagram, State } from "../../model/graph";
import { isComplete, withoutLinkId } from "../../model/graph";
import { pickDiagramSettings } from "../../model/settings";

export type ImportResult =
	| { ok: true; diagram: Diagram; repairs: string[] }
	| { ok: false; error: string };

/** Incomplete links are local working state and never travel. Pretty-printed for hand-editability. */
export function serializeState(state: State): string {
	const exported = {
		nodes: state.nodes,
		links: state.links.filter(isComplete).map(withoutLinkId),
		settings: pickDiagramSettings(state.settings),
	};
	return JSON.stringify(exported, null, 2);
}

const NOT_JSON = "This file isn't valid JSON, so it can't be a diagram export.";
const NOT_A_DIAGRAM =
	'This file doesn\'t look like a diagram export (expected "nodes" and "links" arrays).';

/**
 * The structural gate hard-rejects unrelated files so an import can't
 * silently empty the diagram; field-level problems are repaired and reported.
 */
export function parseImport(text: string): ImportResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, error: NOT_JSON };
	}
	if (!isRawDiagram(parsed)) {
		return { ok: false, error: NOT_A_DIAGRAM };
	}

	const repairs: string[] = [];
	const diagram = normalizeDiagram(parsed, repairs);
	return { ok: true, diagram, repairs };
}
