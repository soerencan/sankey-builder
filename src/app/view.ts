import { createNodeColorResolver } from "../features/diagram/colors";
import type { State } from "../model/graph";

export interface NodeView {
	readonly id: string;
	readonly name: string;
	readonly swatchColor: string;
}

/** Unlike links, which LinkEditor takes as plain `State.links`, nodes need a DTO to carry the derived swatch color. */
export function projectNodes(state: State): readonly NodeView[] {
	const nodeColor = createNodeColorResolver(state.nodes, state.settings.palette);
	return state.nodes.map((node) => ({
		id: node.id,
		name: node.name,
		swatchColor: nodeColor(node),
	}));
}
