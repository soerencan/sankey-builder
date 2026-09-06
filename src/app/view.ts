import { createNodeColorResolver } from "../features/diagram/colors";
import type { NodeView } from "../features/editor/node-editor";
import type { State } from "../model/graph";

/** Unlike links, which LinkEditor takes as plain `State.links`, nodes need a DTO to carry the derived swatch color. */
export function projectNodes(state: State): readonly NodeView[] {
	const nodeColor = createNodeColorResolver(state.nodes, state.settings.palette);
	return state.nodes.map((node) => ({
		id: node.id,
		name: node.name,
		swatchColor: nodeColor(node),
	}));
}
