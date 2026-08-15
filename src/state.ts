export interface Node {
	id: string;
	name: string;
	color?: string;
}

export interface Link {
	source: string;
	target: string;
	value: number;
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
	// Error("missing: <id>") on a dangling reference during layout.
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
 * Defaults to the first two distinct nodes and value 1; no-ops when fewer
 * than two nodes exist (the Add-link button is disabled in that case too —
 * this is just a defensive backstop for the state mutation itself).
 */
export function addLink(state: State): void {
	if (state.nodes.length < 2) return;
	const [source, target] = state.nodes;
	state.links.push({ source: source.id, target: target.id, value: 1 });
}

export function deleteLink(state: State, index: number): void {
	state.links.splice(index, 1);
}
