export interface Node {
	id: string;
	name: string;
	color?: string;
}

export interface Link {
	source: string | null;
	target: string | null;
	value: number;
}

/**
 * A link is complete once both endpoints are assigned. Incomplete links are
 * inert downstream — validate skips them and render filters them out — so an
 * "Add link" click never draws a flow the user didn't choose. Persistence
 * deliberately keeps them, so an in-progress row survives a reload.
 */
export function isComplete(link: Link): link is Link & { source: string; target: string } {
	return link.source !== null && link.target !== null;
}

// Closed value sets straight from app.js: PALETTES' keys, colorMode's two
// states, LINK_COLOR_MODES, ALIGNMENTS, and THEMES (app.js:83-101).
export type Palette = "observable10" | "tableau10" | "category10" | "set2" | "dark2";
export type ColorMode = "auto" | "manual";
export type LinkColorMode = "source" | "target" | "source-target" | "static";
export type Alignment = "left" | "right" | "center" | "justify";
export type Theme = "auto" | "light" | "dark";

export interface Settings {
	palette: Palette;
	colorMode: ColorMode;
	linkColor: LinkColorMode;
	alignment: Alignment;
	theme: Theme;
}

export interface State {
	nodes: Node[];
	links: Link[];
	settings: Settings;
}

export function defaultState(): State {
	return {
		nodes: [
			{ id: "n1", name: "Coal" },
			{ id: "n2", name: "Gas" },
			{ id: "n3", name: "Electricity" },
			{ id: "n4", name: "Homes" },
		],
		links: [
			{ source: "n1", target: "n3", value: 10 },
			{ source: "n2", target: "n3", value: 6 },
			{ source: "n3", target: "n4", value: 14 },
		],
		settings: {
			palette: "observable10",
			colorMode: "auto",
			linkColor: "source-target",
			alignment: "justify",
			theme: "auto",
		},
	};
}

/**
 * Next stable node id, derived from the current max numeric suffix rather
 * than a persisted counter — so ids stay correct after localStorage
 * hydration (Step 6) without any extra bookkeeping.
 */
export function nextNodeId(state: State): string {
	const maxSuffix = state.nodes.reduce((max, n) => {
		const match = /^n(\d+)$/.exec(n.id);
		return match ? Math.max(max, Number(match[1])) : max;
	}, 0);
	return `n${maxSuffix + 1}`;
}

export function addNode(state: State): void {
	const id = nextNodeId(state);
	state.nodes.push({ id, name: `Node ${id.slice(1)}` });
}

export function renameNode(state: State, id: string, name: string): void {
	const node = state.nodes.find((n) => n.id === id);
	if (node) node.name = name;
}

export function deleteNode(state: State, id: string): void {
	state.nodes = state.nodes.filter((n) => n.id !== id);
	// Cascade-prune links referencing the node now: d3-sankey throws
	// Error("missing: <id>") on a dangling reference during layout. Null
	// endpoints don't match `id`, so incomplete links are left intact.
	state.links = state.links.filter((l) => l.source !== id && l.target !== id);
}

export function updateNodeColor(state: State, id: string, color: string): void {
	const node = state.nodes.find((n) => n.id === id);
	if (node) node.color = color;
}

export function updateLink(state: State, index: number, patch: Partial<Link>): void {
	const link = state.links[index];
	if (link) Object.assign(link, patch);
}

/**
 * Adds an unassigned link — both endpoints null, value 1. The user picks
 * source and target from the row's dropdowns; until then the link is
 * incomplete and inert, so this works at any node count (including zero).
 */
export function addLink(state: State): void {
	state.links.push({ source: null, target: null, value: 1 });
}

export function deleteLink(state: State, index: number): void {
	state.links.splice(index, 1);
}

/**
 * Splice-move: pull the item at `from` and reinsert it at `to`. Out-of-range
 * indices clamp to the valid range; a no-op when the resolved indices match or
 * the array has fewer than two items. Row order IS array order — everything
 * downstream (editor rows, dropdown options, export, persistence) follows.
 */
function moveWithin<T>(items: T[], from: number, to: number): void {
	if (items.length < 2) return;
	const max = items.length - 1;
	const src = Math.max(0, Math.min(from, max));
	const dst = Math.max(0, Math.min(to, max));
	if (src === dst) return;
	const [moved] = items.splice(src, 1);
	items.splice(dst, 0, moved);
}

export function moveNode(state: State, from: number, to: number): void {
	moveWithin(state.nodes, from, to);
}

export function moveLink(state: State, from: number, to: number): void {
	moveWithin(state.links, from, to);
}
