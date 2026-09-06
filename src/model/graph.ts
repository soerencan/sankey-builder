import type { DiagramSettings, Settings } from "./settings";
import { DEFAULT_SETTINGS } from "./settings";

export interface Node {
	id: string;
	name: string;
}

/**
 * `id` is in-memory identity, not data: nothing references it, the codec
 * assigns a fresh one to every link it normalizes, and export/storage omit it.
 */
export interface Link {
	id: string;
	source: string | null;
	target: string | null;
	value: number;
}

/**
 * Incomplete links are inert (validation skips them, rendering omits them)
 * so "Add link" never draws a flow the user didn't choose. Persistence keeps
 * them so an in-progress row survives a reload.
 */
export function isComplete(link: Link): link is Link & { source: string; target: string } {
	return link.source !== null && link.target !== null;
}

export function withoutLinkId(link: Readonly<Link>): Omit<Link, "id"> {
	const { source, target, value } = link;
	return { source, target, value };
}

export interface State {
	nodes: Node[];
	links: Link[];
	settings: Settings;
}

let linkIdSequence = 0;

/**
 * A monotonic counter rather than nextNodeId's "max existing + 1": a
 * replaced diagram (import, storage load) must never reuse an id a
 * still-mounted LinkRow holds.
 */
export function nextLinkId(): string {
	linkIdSequence += 1;
	return `link-${linkIdSequence}`;
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
			{ id: nextLinkId(), source: "n1", target: "n3", value: 10 },
			{ id: nextLinkId(), source: "n2", target: "n3", value: 6 },
			{ id: nextLinkId(), source: "n3", target: "n4", value: 14 },
		],
		settings: { ...DEFAULT_SETTINGS },
	};
}

/** Derived from the current max suffix rather than a persisted counter, so it stays correct after localStorage hydration. */
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
	// d3-sankey throws on a dangling reference during layout.
	state.links = state.links.filter((l) => l.source !== id && l.target !== id);
}

export function updateLink(state: State, id: string, patch: Partial<Link>): void {
	const link = state.links.find((l) => l.id === id);
	if (link) Object.assign(link, patch);
}

export function addLink(state: State): void {
	state.links.push({ id: nextLinkId(), source: null, target: null, value: 1 });
}

export function deleteLink(state: State, id: string): void {
	state.links = state.links.filter((l) => l.id !== id);
}

// Array order is row order everywhere downstream: editor rows, dropdown
// options, export, persistence.
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

export interface Diagram {
	nodes: Node[];
	links: Link[];
	settings: DiagramSettings;
}

/** Mutates in place rather than replacing `state`, so closures holding the State reference keep seeing live data. */
export function replaceDiagram(state: State, diagram: Diagram): void {
	state.nodes.length = 0;
	state.nodes.push(...diagram.nodes);
	state.links.length = 0;
	state.links.push(...diagram.links);
	state.settings.palette = diagram.settings.palette;
	state.settings.linkColor = diagram.settings.linkColor;
	state.settings.alignment = diagram.settings.alignment;
	state.settings.aspectRatio = diagram.settings.aspectRatio;
}
