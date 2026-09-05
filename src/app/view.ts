import { createNodeColorResolver } from "../features/diagram/colors";
import type { State } from "../model/graph";

/** Immutable per-node DTO handed to NodeEditor. */
export interface NodeView {
	readonly id: string;
	readonly name: string;
	readonly swatchColor: string;
}

/**
 * Projects the current node editor's view from domain state. Nodes are
 * already stably identified by id, so — unlike links, which are handed to
 * LinkEditor as plain `State.links` — this needs its own DTO to carry the
 * derived swatch color. Rebuilds the color resolver from
 * `state.nodes`/`state.settings.palette` on every call rather than accepting
 * a shared one, since a module-level singleton would leak state across app
 * instances.
 */
export function projectNodes(state: State): readonly NodeView[] {
	const nodeColor = createNodeColorResolver(state.nodes, state.settings.palette);
	return state.nodes.map((node) => ({
		id: node.id,
		name: node.name,
		swatchColor: nodeColor(node),
	}));
}
