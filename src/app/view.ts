import { createNodeColorResolver } from "../features/diagram/colors";
import type { Link, State } from "../model/graph";
import type { Alignment, AspectRatio, LinkColorMode, Palette } from "../model/settings";

/** Immutable per-node DTO handed to NodeEditor. */
export interface NodeView {
	readonly id: string;
	readonly name: string;
	readonly swatchColor: string;
}

/**
 * Projects the current node editor's view from domain state. Nodes are
 * already stably identified by id, so — unlike the deferred link projector —
 * this needs no weak key registry. Rebuilds the color resolver from
 * `state.nodes`/`state.settings.palette` on every call rather than accepting
 * a shared one (see createNodeColorResolver's own doc comment for why it's
 * built fresh per caller).
 */
export function projectNodes(state: State): readonly NodeView[] {
	const nodeColor = createNodeColorResolver(state.nodes, state.settings.palette);
	return state.nodes.map((node) => ({
		id: node.id,
		name: node.name,
		swatchColor: nodeColor(node),
	}));
}

/** Immutable per-link DTO handed to LinkEditor — see createLinkProjector's own doc comment for its key. */
export interface LinkView {
	readonly key: string;
	readonly index: number;
	readonly source: string | null;
	readonly target: string | null;
	readonly value: number;
}

/** DiagramPanel's settings slice — theme is a separate per-browser preference, not diagram data, so it's excluded. */
export interface SettingsView {
	readonly palette: Palette;
	readonly linkColor: LinkColorMode;
	readonly alignment: Alignment;
	readonly aspectRatio: AspectRatio;
}

/** Projects the diagram-relevant settings, same DTO-per-render approach as projectNodes. */
export function projectSettings(state: State): SettingsView {
	const { palette, linkColor, alignment, aspectRatio } = state.settings;
	return { palette, linkColor, alignment, aspectRatio };
}

/**
 * Creates a per-application-instance link view projector (see start-app.tsx,
 * which builds one alongside its `State`). It owns a `WeakMap<Link, string>`
 * that assigns each domain Link object a stable view key the first time it's
 * projected, and reuses that key on every later projection of the same
 * object — updateLink/moveLink (model/graph.ts) mutate/splice links in
 * place, so a value or endpoint edit and a reorder both keep their key (and
 * therefore their row-local draft), while replaceDiagram (import) pushes
 * brand new Link objects that correctly get fresh keys, resetting any draft.
 * Deleted links simply drop out of later projections and leave the registry
 * to GC. A fresh WeakMap/counter per call, not module-level state, so two
 * concurrent application instances (e.g. the cross-realm tests) never share
 * keys.
 */
export function createLinkProjector(): (state: State) => readonly LinkView[] {
	const keys = new WeakMap<Link, string>();
	let nextKey = 0;
	return (state: State): readonly LinkView[] =>
		state.links.map((link, index) => {
			let key = keys.get(link);
			if (key === undefined) {
				key = `link-${nextKey++}`;
				keys.set(link, key);
			}
			return { key, index, source: link.source, target: link.target, value: link.value };
		});
}
