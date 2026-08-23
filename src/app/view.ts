import { createNodeColorResolver } from "../features/diagram/colors";
import type { State } from "../model/graph";

/** Immutable per-node DTO handed to NodeEditor — see PLAN.md's view-snapshot rationale. */
export interface NodeView {
	readonly id: string;
	readonly name: string;
	readonly swatchColor: string;
}

/**
 * Projects the current node editor's view from domain state. Nodes are
 * already stably identified by id, so — unlike the deferred link projector —
 * this needs no weak key registry. Rebuilds the color resolver from `state`
 * on every call rather than accepting a shared one (see
 * createNodeColorResolver's own doc comment for why it's rebuilt per pass).
 */
export function projectNodes(state: State): readonly NodeView[] {
	const nodeColor = createNodeColorResolver(state);
	return state.nodes.map((node) => ({
		id: node.id,
		name: node.name,
		swatchColor: nodeColor(node),
	}));
}
